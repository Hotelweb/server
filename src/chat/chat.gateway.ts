import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinSession')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: number },
  ) {
    const room = `session_${data.sessionId}`;
    client.join(room);
    return { event: 'joinedSession', data: { sessionId: data.sessionId } };
  }

  @SubscribeMessage('joinHotel')
  handleJoinHotel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { hotelId: number },
  ) {
    const room = `hotel_${data.hotelId}`;
    client.join(room);
    return { event: 'joinedHotel', data: { hotelId: data.hotelId } };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: number;
      message: string;
      source_language: string;
      sender_type: 'CUSTOMER' | 'STAFF';
      sender_user_id?: number;
    },
  ) {
    let savedMessage;

    if (data.sender_type === 'CUSTOMER') {
      savedMessage = await this.chatService.sendCustomerMessage(
        data.sessionId,
        { message: data.message, source_language: data.source_language },
      );
    } else {
      savedMessage = await this.chatService.sendStaffMessage(
        data.sessionId,
        data.sender_user_id!,
        { message: data.message, source_language: data.source_language },
      );
    }

    // Broadcast to session room
    const room = `session_${data.sessionId}`;
    this.server.to(room).emit('newMessage', savedMessage);

    // Also notify hotel room for staff dashboard
    const session = await this.chatService.getSession(data.sessionId);
    this.server
      .to(`hotel_${session.hotel_id}`)
      .emit('sessionUpdate', {
        sessionId: data.sessionId,
        message: savedMessage,
      });

    return { event: 'messageSent', data: savedMessage };
  }
}
