import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service.js';
import { ChatSessionStatus } from './entities/chat.entity.js';

interface SocketData {
  role?: 'customer' | 'staff';
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

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
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
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { hotelId: number },
  ) {
    const room = `hotel_${data.hotelId}`;
    void client.join(room);
    return { event: 'joinedHotel', data: { hotelId: data.hotelId } };
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() _client: Socket,
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
        : await this.chatService.sendStaffMessage(
            data.sessionId,
            data.sender_user_id ?? 1,
            {
              message: data.message,
              source_language: data.source_language,
              message_type: data.message_type,
              image_url: data.image_url,
              client_message_id: data.client_message_id,
            },
          );

    // Broadcast to session room
    const room = `session_${data.sessionId}`;
    this.server.to(room).emit('newMessage', savedMessage);

    // Notify hotel room for staff dashboard
    const session = await this.chatService.getSession(data.sessionId);
    this.server.to(`hotel_${session.hotel_id}`).emit('sessionUpdate', {
      sessionId: data.sessionId,
      message: savedMessage,
      session,
    });

    return { event: 'messageSent', data: savedMessage };
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
    // Broadcast to everyone in the room except the sender
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
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: { sessionId: number; by: 'customer' | 'staff' },
  ) {
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

    // Let admin dashboard refresh its sidebar counters too
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
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { sessionId: number; status: ChatSessionStatus },
  ) {
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
