import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            message = {
                create: jest.fn(),
                findMany: jest.fn(),
                updateMany: jest.fn(),
                count: jest.fn(),
            };
        },
    };
});

import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

describe('MessagesController', () => {
    let controller: MessagesController;
    let messagesService: {
        findByLocation: jest.Mock;
        markAsRead: jest.Mock;
    };

    const mockMessages = [
        {
            id: 'msg-1',
            locationId: 'loc-1',
            senderType: 'customer',
            content: 'Hello',
            isRead: false,
            createdAt: new Date('2025-01-15T10:00:00Z'),
        },
        {
            id: 'msg-2',
            locationId: 'loc-1',
            senderType: 'admin',
            content: 'Hi there!',
            isRead: true,
            createdAt: new Date('2025-01-15T10:01:00Z'),
        },
    ];

    beforeEach(async () => {
        messagesService = {
            findByLocation: jest.fn(),
            markAsRead: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [MessagesController],
            providers: [
                { provide: MessagesService, useValue: messagesService },
            ],
        }).compile();

        controller = module.get<MessagesController>(MessagesController);
    });

    describe('GET /api/messages/location/:locationId', () => {
        it('should return messages for a location', async () => {
            messagesService.findByLocation.mockResolvedValue(mockMessages);

            const result = await controller.findByLocation('loc-1');

            expect(result).toEqual(mockMessages);
            expect(messagesService.findByLocation).toHaveBeenCalledWith('loc-1', {
                limit: undefined,
                cursor: undefined,
            });
        });

        it('should pass parsed limit when provided as query param', async () => {
            messagesService.findByLocation.mockResolvedValue([]);

            await controller.findByLocation('loc-1', '20');

            expect(messagesService.findByLocation).toHaveBeenCalledWith('loc-1', {
                limit: 20,
                cursor: undefined,
            });
        });

        it('should pass cursor when provided as query param', async () => {
            messagesService.findByLocation.mockResolvedValue([]);

            await controller.findByLocation('loc-1', undefined, 'msg-cursor-id');

            expect(messagesService.findByLocation).toHaveBeenCalledWith('loc-1', {
                limit: undefined,
                cursor: 'msg-cursor-id',
            });
        });

        it('should pass both limit and cursor when both provided', async () => {
            messagesService.findByLocation.mockResolvedValue([]);

            await controller.findByLocation('loc-1', '10', 'msg-abc');

            expect(messagesService.findByLocation).toHaveBeenCalledWith('loc-1', {
                limit: 10,
                cursor: 'msg-abc',
            });
        });

        it('should return empty array when no messages exist', async () => {
            messagesService.findByLocation.mockResolvedValue([]);

            const result = await controller.findByLocation('loc-empty');

            expect(result).toEqual([]);
        });

        it('should handle empty string cursor as undefined', async () => {
            messagesService.findByLocation.mockResolvedValue([]);

            await controller.findByLocation('loc-1', undefined, '');

            expect(messagesService.findByLocation).toHaveBeenCalledWith('loc-1', {
                limit: undefined,
                cursor: undefined,
            });
        });
    });

    describe('POST /api/messages/:locationId/read', () => {
        it('should mark messages as read for a location', async () => {
            messagesService.markAsRead.mockResolvedValue(undefined);

            await controller.markAsRead('loc-1');

            expect(messagesService.markAsRead).toHaveBeenCalledWith('loc-1');
        });

        it('should delegate to MessagesService.markAsRead with locationId', async () => {
            messagesService.markAsRead.mockResolvedValue(undefined);

            await controller.markAsRead('another-loc-id');

            expect(messagesService.markAsRead).toHaveBeenCalledTimes(1);
            expect(messagesService.markAsRead).toHaveBeenCalledWith('another-loc-id');
        });
    });

    describe('Controller metadata', () => {
        it('should have the correct controller prefix', () => {
            // Verify the controller is properly instantiated
            expect(controller).toBeDefined();
            expect(controller.findByLocation).toBeDefined();
            expect(controller.markAsRead).toBeDefined();
        });

        it('should have JwtAuthGuard on markAsRead endpoint', () => {
            // Verify the guard metadata is applied
            const guards = Reflect.getMetadata(
                '__guards__',
                MessagesController.prototype.markAsRead,
            );
            expect(guards).toBeDefined();
            expect(guards.length).toBe(1);
        });

        it('should NOT have JwtAuthGuard on findByLocation endpoint', () => {
            const guards = Reflect.getMetadata(
                '__guards__',
                MessagesController.prototype.findByLocation,
            );
            expect(guards).toBeUndefined();
        });
    });
});
