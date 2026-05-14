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

import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MessagesService', () => {
    let service: MessagesService;
    let prisma: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MessagesService, PrismaService],
        }).compile();

        service = module.get<MessagesService>(MessagesService);
        prisma = module.get<PrismaService>(PrismaService);

        prisma.message.create.mockReset();
        prisma.message.findMany.mockReset();
        prisma.message.updateMany.mockReset();
        prisma.message.count.mockReset();
    });

    describe('create', () => {
        it('should set isRead to true for admin messages', async () => {
            const dto = {
                content: 'Hello from admin',
                locationId: 'loc-1',
                senderType: 'admin' as const,
            };
            const mockMessage = {
                id: 'msg-1',
                ...dto,
                isRead: true,
                createdAt: new Date(),
            };
            prisma.message.create.mockResolvedValue(mockMessage);

            const result = await service.create(dto);

            expect(prisma.message.create).toHaveBeenCalledWith({
                data: {
                    content: 'Hello from admin',
                    locationId: 'loc-1',
                    senderType: 'admin',
                    isRead: true,
                },
            });
            expect(result.isRead).toBe(true);
        });

        it('should set isRead to false for customer messages', async () => {
            const dto = {
                content: 'Hello from customer',
                locationId: 'loc-1',
                senderType: 'customer' as const,
            };
            const mockMessage = {
                id: 'msg-2',
                ...dto,
                isRead: false,
                createdAt: new Date(),
            };
            prisma.message.create.mockResolvedValue(mockMessage);

            const result = await service.create(dto);

            expect(prisma.message.create).toHaveBeenCalledWith({
                data: {
                    content: 'Hello from customer',
                    locationId: 'loc-1',
                    senderType: 'customer',
                    isRead: false,
                },
            });
            expect(result.isRead).toBe(false);
        });

        it('should persist message with all required fields', async () => {
            const dto = {
                content: 'Test message',
                locationId: 'loc-123',
                senderType: 'customer' as const,
            };
            const mockMessage = {
                id: 'msg-uuid',
                content: 'Test message',
                locationId: 'loc-123',
                senderType: 'customer',
                isRead: false,
                createdAt: new Date('2025-01-15T10:00:00Z'),
            };
            prisma.message.create.mockResolvedValue(mockMessage);

            const result = await service.create(dto);

            expect(result).toEqual(mockMessage);
            expect(result.id).toBeDefined();
            expect(result.createdAt).toBeDefined();
        });
    });

    describe('findByLocation', () => {
        it('should return messages ordered by createdAt descending', async () => {
            const mockMessages = [
                { id: 'msg-2', content: 'Newer', createdAt: new Date('2025-01-02') },
                { id: 'msg-1', content: 'Older', createdAt: new Date('2025-01-01') },
            ];
            prisma.message.findMany.mockResolvedValue(mockMessages);

            const result = await service.findByLocation('loc-1');

            expect(prisma.message.findMany).toHaveBeenCalledWith({
                where: { locationId: 'loc-1' },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });
            expect(result).toEqual(mockMessages);
        });

        it('should use default limit of 50 when no options provided', async () => {
            prisma.message.findMany.mockResolvedValue([]);

            await service.findByLocation('loc-1');

            expect(prisma.message.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 50 }),
            );
        });

        it('should use custom limit when provided', async () => {
            prisma.message.findMany.mockResolvedValue([]);

            await service.findByLocation('loc-1', { limit: 20 });

            expect(prisma.message.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 20 }),
            );
        });

        it('should apply cursor-based pagination when cursor is provided', async () => {
            prisma.message.findMany.mockResolvedValue([]);

            await service.findByLocation('loc-1', { cursor: 'msg-cursor-id' });

            expect(prisma.message.findMany).toHaveBeenCalledWith({
                where: { locationId: 'loc-1' },
                orderBy: { createdAt: 'desc' },
                take: 50,
                skip: 1,
                cursor: { id: 'msg-cursor-id' },
            });
        });

        it('should apply both custom limit and cursor together', async () => {
            prisma.message.findMany.mockResolvedValue([]);

            await service.findByLocation('loc-1', { limit: 10, cursor: 'msg-abc' });

            expect(prisma.message.findMany).toHaveBeenCalledWith({
                where: { locationId: 'loc-1' },
                orderBy: { createdAt: 'desc' },
                take: 10,
                skip: 1,
                cursor: { id: 'msg-abc' },
            });
        });

        it('should not include skip/cursor when cursor is not provided', async () => {
            prisma.message.findMany.mockResolvedValue([]);

            await service.findByLocation('loc-1', { limit: 25 });

            const callArgs = prisma.message.findMany.mock.calls[0][0];
            expect(callArgs.skip).toBeUndefined();
            expect(callArgs.cursor).toBeUndefined();
        });

        it('should return empty array when no messages exist for location', async () => {
            prisma.message.findMany.mockResolvedValue([]);

            const result = await service.findByLocation('loc-empty');

            expect(result).toEqual([]);
        });
    });

    describe('markAsRead', () => {
        it('should update all unread customer messages for a location', async () => {
            prisma.message.updateMany.mockResolvedValue({ count: 5 });

            await service.markAsRead('loc-1');

            expect(prisma.message.updateMany).toHaveBeenCalledWith({
                where: {
                    locationId: 'loc-1',
                    senderType: 'customer',
                    isRead: false,
                },
                data: { isRead: true },
            });
        });

        it('should only target customer messages, not admin messages', async () => {
            prisma.message.updateMany.mockResolvedValue({ count: 0 });

            await service.markAsRead('loc-1');

            const callArgs = prisma.message.updateMany.mock.calls[0][0];
            expect(callArgs.where.senderType).toBe('customer');
        });

        it('should only target unread messages', async () => {
            prisma.message.updateMany.mockResolvedValue({ count: 0 });

            await service.markAsRead('loc-1');

            const callArgs = prisma.message.updateMany.mock.calls[0][0];
            expect(callArgs.where.isRead).toBe(false);
        });

        it('should handle case when no unread messages exist', async () => {
            prisma.message.updateMany.mockResolvedValue({ count: 0 });

            // Should not throw
            await expect(service.markAsRead('loc-no-unread')).resolves.toBeUndefined();
        });
    });

    describe('getUnreadCount', () => {
        it('should count unread customer messages for a location', async () => {
            prisma.message.count.mockResolvedValue(3);

            const result = await service.getUnreadCount('loc-1');

            expect(prisma.message.count).toHaveBeenCalledWith({
                where: {
                    locationId: 'loc-1',
                    senderType: 'customer',
                    isRead: false,
                },
            });
            expect(result).toBe(3);
        });

        it('should return 0 when no unread messages exist', async () => {
            prisma.message.count.mockResolvedValue(0);

            const result = await service.getUnreadCount('loc-1');

            expect(result).toBe(0);
        });

        it('should only count customer messages, not admin messages', async () => {
            prisma.message.count.mockResolvedValue(2);

            await service.getUnreadCount('loc-1');

            const callArgs = prisma.message.count.mock.calls[0][0];
            expect(callArgs.where.senderType).toBe('customer');
        });

        it('should only count unread messages', async () => {
            prisma.message.count.mockResolvedValue(1);

            await service.getUnreadCount('loc-1');

            const callArgs = prisma.message.count.mock.calls[0][0];
            expect(callArgs.where.isRead).toBe(false);
        });
    });
});
