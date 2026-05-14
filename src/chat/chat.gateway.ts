import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WsException,
} from '@nestjs/websockets';
import { Logger, UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter.js';
import { MessagesService } from '../messages/messages.service.js';
import { LocationsService } from '../locations/locations.service.js';
import { SenderType } from '../messages/dto/create-message.dto.js';

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/chat',
})
@UseFilters(new WsExceptionFilter())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);
    private readonly connectedClients = new Map<string, { connectedAt: Date; rooms: Set<string> }>();

    constructor(
        private readonly messagesService: MessagesService,
        private readonly locationsService: LocationsService,
    ) { }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
        this.connectedClients.set(client.id, {
            connectedAt: new Date(),
            rooms: new Set<string>(),
        });
    }

    handleDisconnect(client: Socket) {
        const clientData = this.connectedClients.get(client.id);
        if (clientData) {
            for (const room of clientData.rooms) {
                client.leave(room);
            }
            this.connectedClients.delete(client.id);
        }
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    /**
     * Track a room join for a client (used by room operations in subsequent tasks).
     */
    trackClientRoom(clientId: string, room: string) {
        const clientData = this.connectedClients.get(clientId);
        if (clientData) {
            clientData.rooms.add(room);
        }
    }

    /**
     * Remove a room from client tracking (used by leave_room operations).
     */
    untrackClientRoom(clientId: string, room: string) {
        const clientData = this.connectedClients.get(clientId);
        if (clientData) {
            clientData.rooms.delete(room);
        }
    }

    /**
     * Get the set of rooms a client has joined.
     */
    getClientRooms(clientId: string): Set<string> | undefined {
        return this.connectedClients.get(clientId)?.rooms;
    }

    @SubscribeMessage('join_room')
    async handleJoinRoom(client: Socket, payload: { locationId: string }) {
        const { locationId } = payload;

        // Validate location exists
        const location = await this.locationsService.findOne(locationId);
        if (!location) {
            throw new WsException('Location not found');
        }

        // Join client to the room
        const roomName = `location_${locationId}`;
        client.join(roomName);

        // Track the room for this client
        this.trackClientRoom(client.id, roomName);

        // Send message history (last 50 messages) to client
        const messages = await this.messagesService.findByLocation(locationId);
        client.emit('message_history', { messages });

        // Emit room_joined acknowledgment
        client.emit('room_joined', { locationId });

        this.logger.log(`Client ${client.id} joined room ${roomName}`);
    }

    @SubscribeMessage('leave_room')
    handleLeaveRoom(client: Socket, payload: { locationId: string }) {
        const { locationId } = payload;
        const roomName = `location_${locationId}`;

        // Leave the room
        client.leave(roomName);

        // Untrack the room for this client
        this.untrackClientRoom(client.id, roomName);

        this.logger.log(`Client ${client.id} left room ${roomName}`);
    }

    @SubscribeMessage('send_message')
    async handleSendMessage(
        client: Socket,
        payload: { locationId: string; content: string; senderType: string },
    ) {
        const { locationId, content, senderType } = payload;

        // Validate senderType is 'customer' or 'admin'
        if (senderType !== 'customer' && senderType !== 'admin') {
            throw new WsException('Invalid senderType: must be "customer" or "admin"');
        }

        // Persist message to database via MessagesService
        const createdMessage = await this.messagesService.create({
            content,
            locationId,
            senderType: senderType as SenderType,
        });

        // Broadcast message to all clients in room via 'receive_message' event
        const roomName = `location_${locationId}`;
        this.server.to(roomName).emit('receive_message', { message: createdMessage });

        this.logger.log(`Message sent in room ${roomName} by ${senderType}`);

        return createdMessage;
    }

    @SubscribeMessage('typing_start')
    handleTypingStart(
        client: Socket,
        payload: { locationId: string; senderType: string },
    ) {
        const { locationId, senderType } = payload;
        const roomName = `location_${locationId}`;
        client.to(roomName).emit('user_typing', {
            senderType,
            isTyping: true,
        });
    }

    @SubscribeMessage('typing_stop')
    handleTypingStop(
        client: Socket,
        payload: { locationId: string; senderType: string },
    ) {
        const { locationId, senderType } = payload;
        const roomName = `location_${locationId}`;
        client.to(roomName).emit('user_typing', {
            senderType,
            isTyping: false,
        });
    }
}
