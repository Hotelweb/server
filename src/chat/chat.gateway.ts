import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service.js';
import { ChatSessionStatus } from './entities/chat.entity.js';
import { TokenService, type TokenPayload } from '../auth/token.service.js';
import { assertHotelAccess } from '../auth/hotel-access.js';

interface SocketData {
  role?: 'customer' | 'staff';
  user?: TokenPayload;
}

type TypedSocket = Socket<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  SocketData
>;

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly tokenService: TokenService,
  ) {}

  handleConnection(client: TypedSocket) {
    const raw = client.handshake.auth?.token;
    if (typeof raw === 'string' && raw.length > 0) {
      try {
        client.data.user = this.tokenService.verify(raw);
      } catch {
        this.logger.warn(`Invalid socket token for ${client.id}`);
      }
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private requireStaff(client: TypedSocket): TokenPayload {
    const user = client.data.user;
    if (!user) {
      throw new UnauthorizedException('Staff authentication required');
    }
    return user;
  }

  // ---------------------------------------------------------------------------
  // Rooms
  // ---------------------------------------------------------------------------

  @SubscribeMessage('joinSession')
  handleJoinSession(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { sessionId: number; role?: 'customer' | 'staff' },
  ) {
    const room = `session_${data.sessionId}`;
    void client.join(room);
    if (data.role) client.data.role = data.role;
    return { event: 'joinedSession', data: { sessionId: data.sessionId } };
  }

  @SubscribeMessage('leaveSession')
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: number },
  ) {
    const room = `session_${data.sessionId}`;
    void client.leave(room);
    return { event: 'leftSession', data: { sessionId: data.sessionId } };
  }

  @SubscribeMessage('joinHotel')
  handleJoinHotel(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { hotelId: number },
  ) {
    const user = this.requireStaff(client);
    assertHotelAccess(user, data.hotelId);
    const room = `hotel_${data.hotelId}`;
    void client.join(room);
    return { event: 'joinedHotel', data: { hotelId: data.hotelId } };
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody()
    data: {
      sessionId: number;
      message: string;
      source_language: string;
      sender_type: 'CUSTOMER' | 'STAFF';
      sender_user_id?: number;
      client_message_id?: string;
      message_type?: 'TEXT' | 'IMAGE';
      image_url?: string;
    },
  ) {
    const savedMessage =
      data.sender_type === 'CUSTOMER'
        ? await this.chatService.sendCustomerMessage(data.sessionId, {
            message: data.message,
            source_language: data.source_language,
            message_type: data.message_type,
            image_url: data.image_url,
            client_message_id: data.client_message_id,
          })
        : await this.sendStaffMessage(client, data);

    const room = `session_${data.sessionId}`;
    this.server.to(room).emit('newMessage', savedMessage);

    const session = await this.chatService.getSession(data.sessionId);
    this.server.to(`hotel_${session.hotel_id}`).emit('sessionUpdate', {
      sessionId: data.sessionId,
      message: savedMessage,
      session,
    });

    return { event: 'messageSent', data: savedMessage };
  }

  private async sendStaffMessage(
    client: TypedSocket,
    data: {
      sessionId: number;
      message: string;
      source_language: string;
      client_message_id?: string;
      message_type?: 'TEXT' | 'IMAGE';
      image_url?: string;
    },
  ) {
    const user = this.requireStaff(client);
    const session = await this.chatService.getSession(data.sessionId);
    assertHotelAccess(user, Number(session.hotel_id));
    return this.chatService.sendStaffMessage(data.sessionId, user.sub, {
      message: data.message,
      source_language: data.source_language,
      message_type: data.message_type,
      image_url: data.image_url,
      client_message_id: data.client_message_id,
    });
  }

  // ---------------------------------------------------------------------------
  // Typing
  // ---------------------------------------------------------------------------

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: number;
      sender_type: 'CUSTOMER' | 'STAFF';
      isTyping: boolean;
    },
  ) {
    const room = `session_${data.sessionId}`;
    client.to(room).emit('typing', {
      sessionId: data.sessionId,
      sender_type: data.sender_type,
      isTyping: data.isTyping,
    });
  }

  // ---------------------------------------------------------------------------
  // Read receipts
  // ---------------------------------------------------------------------------

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody()
    data: { sessionId: number; by: 'customer' | 'staff' },
  ) {
    if (data.by === 'staff') {
      const user = this.requireStaff(client);
      const session = await this.chatService.getSession(data.sessionId);
      assertHotelAccess(user, Number(session.hotel_id));
    }

    const result = await this.chatService.markMessagesRead(
      data.sessionId,
      data.by,
    );
    const room = `session_${data.sessionId}`;
    this.server.to(room).emit('messagesRead', {
      sessionId: data.sessionId,
      by: data.by,
      updated: result.updated,
    });

    const session = await this.chatService.getSession(data.sessionId);
    this.server.to(`hotel_${session.hotel_id}`).emit('sessionUnreadUpdate', {
      sessionId: data.sessionId,
      unread_count: session.unread_count,
    });

    return { event: 'markedRead', data: result };
  }

  // ---------------------------------------------------------------------------
  // Session status
  // ---------------------------------------------------------------------------

  @SubscribeMessage('updateSessionStatus')
  async handleUpdateStatus(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { sessionId: number; status: ChatSessionStatus },
  ) {
    const user = this.requireStaff(client);
    const existing = await this.chatService.getSession(data.sessionId);
    assertHotelAccess(user, Number(existing.hotel_id));

    const session = await this.chatService.updateSessionStatus(
      data.sessionId,
      data.status,
    );
    this.server
      .to(`hotel_${session.hotel_id}`)
      .emit('sessionStatusChanged', { sessionId: data.sessionId, session });
    this.server
      .to(`session_${data.sessionId}`)
      .emit('sessionStatusChanged', { sessionId: data.sessionId, session });
  }
}
