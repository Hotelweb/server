import { Test, TestingModule } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';

// Mock PrismaService to avoid import.meta issues with generated Prisma client
jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            message = { create: jest.fn(), findMany: jest.fn() };
            location = { findUnique: jest.fn() };
        },
    };
});

import { ChatGateway } from './chat.gateway';
import { MessagesService } from '../messages/messages.service';
import { LocationsService } from '../locations/locations.service';

describe('ChatGateway - handleSendMessage', () => {
    let gateway: ChatGateway;
    let messagesService: { create: jest.Mock; findByLocation: jest.Mock };
    let locationsService: { findOne: jest.Mock; findBySlug: jest.Mock };
    let mockServer: { to: jest.Mock };
    let mockEmit: jest.Mock;

    beforeEach(async () => {
        mockEmit = jest.fn();
        mockServer = {
            to: jest.fn().mockReturnValue({ emit: mockEmit }),
        };

        messagesService = {
            create: jest.fn(),
            findByLocation: jest.fn(),
        };

        locationsService = {
            findOne: jest.fn(),
            findBySlug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                { provide: MessagesService, useValue: messagesService },
                { provide: LocationsService, useValue: locationsService },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);
        (gateway as any).server = mockServer;
    });

    const createMockClient = (id = 'client-1') => ({
        id,
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
    });

    describe('valid senderType', () => {
        it('should persist a customer message and broadcast to room', async () => {
            const client = createMockClient();
            const payload = {
                locationId: 'loc-123',
                content: 'Hello from customer',
                senderType: 'customer',
            };
            const createdMessage = {
                id: 'msg-1',
                locationId: 'loc-123',
                content: 'Hello from customer',
                senderType: 'customer',
                isRead: false,
                createdAt: new Date(),
            };
            messagesService.create.mockResolvedValue(createdMessage);

            const result = await gateway.handleSendMessage(client as any, payload);

            expect(messagesService.create).toHaveBeenCalledWith({
                content: 'Hello from customer',
                locationId: 'loc-123',
                senderType: 'customer',
            });
            expect(mockServer.to).toHaveBeenCalledWith('location_loc-123');
            expect(mockEmit).toHaveBeenCalledWith('receive_message', { message: createdMessage });
            expect(result).toEqual(createdMessage);
        });

        it('should persist an admin message and broadcast to room', async () => {
            const client = createMockClient();
            const payload = {
                locationId: 'loc-456',
                content: 'Hello from admin',
                senderType: 'admin',
            };
            const createdMessage = {
                id: 'msg-2',
                locationId: 'loc-456',
                content: 'Hello from admin',
                senderType: 'admin',
                isRead: true,
                createdAt: new Date(),
            };
            messagesService.create.mockResolvedValue(createdMessage);

            const result = await gateway.handleSendMessage(client as any, payload);

            expect(messagesService.create).toHaveBeenCalledWith({
                content: 'Hello from admin',
                locationId: 'loc-456',
                senderType: 'admin',
            });
            expect(mockServer.to).toHaveBeenCalledWith('location_loc-456');
            expect(mockEmit).toHaveBeenCalledWith('receive_message', { message: createdMessage });
            expect(result).toEqual(createdMessage);
        });
    });

    describe('invalid senderType', () => {
        it('should throw WsException for invalid senderType', async () => {
            const client = createMockClient();
            const payload = {
                locationId: 'loc-123',
                content: 'Hello',
                senderType: 'hacker',
            };

            await expect(
                gateway.handleSendMessage(client as any, payload),
            ).rejects.toThrow(WsException);
        });

        it('should throw WsException for empty senderType', async () => {
            const client = createMockClient();
            const payload = {
                locationId: 'loc-123',
                content: 'Hello',
                senderType: '',
            };

            await expect(
                gateway.handleSendMessage(client as any, payload),
            ).rejects.toThrow(WsException);
        });

        it('should not persist message when senderType is invalid', async () => {
            const client = createMockClient();
            const payload = {
                locationId: 'loc-123',
                content: 'Hello',
                senderType: 'unknown',
            };

            try {
                await gateway.handleSendMessage(client as any, payload);
            } catch {
                // expected
            }

            expect(messagesService.create).not.toHaveBeenCalled();
        });

        it('should not broadcast when senderType is invalid', async () => {
            const client = createMockClient();
            const payload = {
                locationId: 'loc-123',
                content: 'Hello',
                senderType: 'invalid',
            };

            try {
                await gateway.handleSendMessage(client as any, payload);
            } catch {
                // expected
            }

            expect(mockServer.to).not.toHaveBeenCalled();
        });
    });

    describe('room isolation', () => {
        it('should broadcast only to the correct room', async () => {
            const client = createMockClient();
            const payload = {
                locationId: 'loc-room-A',
                content: 'Message for room A',
                senderType: 'customer',
            };
            const createdMessage = {
                id: 'msg-3',
                locationId: 'loc-room-A',
                content: 'Message for room A',
                senderType: 'customer',
                isRead: false,
                createdAt: new Date(),
            };
            messagesService.create.mockResolvedValue(createdMessage);

            await gateway.handleSendMessage(client as any, payload);

            // Verify it broadcasts to the correct room only
            expect(mockServer.to).toHaveBeenCalledWith('location_loc-room-A');
            expect(mockServer.to).toHaveBeenCalledTimes(1);
        });
    });
});

describe('ChatGateway - Typing Indicators', () => {
    let gateway: ChatGateway;
    let messagesService: { create: jest.Mock; findByLocation: jest.Mock };
    let locationsService: { findOne: jest.Mock; findBySlug: jest.Mock };

    beforeEach(async () => {
        messagesService = {
            create: jest.fn(),
            findByLocation: jest.fn(),
        };

        locationsService = {
            findOne: jest.fn(),
            findBySlug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                { provide: MessagesService, useValue: messagesService },
                { provide: LocationsService, useValue: locationsService },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);
    });

    const createMockClient = (id = 'client-1') => {
        const mockRoomEmit = jest.fn();
        return {
            id,
            join: jest.fn(),
            leave: jest.fn(),
            emit: jest.fn(),
            to: jest.fn().mockReturnValue({ emit: mockRoomEmit }),
            _roomEmit: mockRoomEmit,
        };
    };

    describe('handleTypingStart', () => {
        it('should broadcast user_typing with isTyping true to other clients in room', () => {
            const client = createMockClient();
            const payload = { locationId: 'loc-123', senderType: 'customer' };

            gateway.handleTypingStart(client as any, payload);

            expect(client.to).toHaveBeenCalledWith('location_loc-123');
            expect(client._roomEmit).toHaveBeenCalledWith('user_typing', {
                senderType: 'customer',
                isTyping: true,
            });
        });

        it('should broadcast typing_start for admin senderType', () => {
            const client = createMockClient();
            const payload = { locationId: 'loc-456', senderType: 'admin' };

            gateway.handleTypingStart(client as any, payload);

            expect(client.to).toHaveBeenCalledWith('location_loc-456');
            expect(client._roomEmit).toHaveBeenCalledWith('user_typing', {
                senderType: 'admin',
                isTyping: true,
            });
        });

        it('should use client.to() to exclude sender from receiving the event', () => {
            const client = createMockClient();
            const payload = { locationId: 'loc-789', senderType: 'customer' };

            gateway.handleTypingStart(client as any, payload);

            // Verify client.to is used (excludes sender) instead of server.to
            expect(client.to).toHaveBeenCalledWith('location_loc-789');
        });
    });

    describe('handleTypingStop', () => {
        it('should broadcast user_typing with isTyping false to other clients in room', () => {
            const client = createMockClient();
            const payload = { locationId: 'loc-123', senderType: 'customer' };

            gateway.handleTypingStop(client as any, payload);

            expect(client.to).toHaveBeenCalledWith('location_loc-123');
            expect(client._roomEmit).toHaveBeenCalledWith('user_typing', {
                senderType: 'customer',
                isTyping: false,
            });
        });

        it('should broadcast typing_stop for admin senderType', () => {
            const client = createMockClient();
            const payload = { locationId: 'loc-456', senderType: 'admin' };

            gateway.handleTypingStop(client as any, payload);

            expect(client.to).toHaveBeenCalledWith('location_loc-456');
            expect(client._roomEmit).toHaveBeenCalledWith('user_typing', {
                senderType: 'admin',
                isTyping: false,
            });
        });

        it('should use client.to() to exclude sender from receiving the event', () => {
            const client = createMockClient();
            const payload = { locationId: 'loc-789', senderType: 'admin' };

            gateway.handleTypingStop(client as any, payload);

            // Verify client.to is used (excludes sender) instead of server.to
            expect(client.to).toHaveBeenCalledWith('location_loc-789');
        });
    });
});
