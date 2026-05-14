import * as fc from 'fast-check';
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

/**
 * Property 23: Bulk Read Status Update
 * **Validates: Requirement 12.4**
 *
 * WHEN messages are marked as read, THE Messages_Service SHALL update the `isRead` field
 * for all customer messages in that location.
 */

describe('Property 23: Bulk Read Status Update', () => {
    let service: MessagesService;
    let prisma: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MessagesService, PrismaService],
        }).compile();

        service = module.get<MessagesService>(MessagesService);
        prisma = module.get<PrismaService>(PrismaService);

        prisma.message.updateMany.mockReset();
    });

    it('for any locationId, markAsRead always calls prisma.message.updateMany with the correct where clause', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (locationId) => {
                    prisma.message.updateMany.mockReset();
                    prisma.message.updateMany.mockResolvedValue({ count: 0 });

                    await service.markAsRead(locationId);

                    expect(prisma.message.updateMany).toHaveBeenCalledTimes(1);
                    const callArgs = prisma.message.updateMany.mock.calls[0][0];
                    expect(callArgs.where.locationId).toBe(locationId);
                    expect(callArgs.where.senderType).toBe('customer');
                    expect(callArgs.where.isRead).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('the where clause always includes locationId, senderType: customer, isRead: false', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.stringMatching(/^[a-z0-9-]{1,50}$/),
                async (locationId) => {
                    prisma.message.updateMany.mockReset();
                    prisma.message.updateMany.mockResolvedValue({ count: 0 });

                    await service.markAsRead(locationId);

                    const callArgs = prisma.message.updateMany.mock.calls[0][0];
                    expect(callArgs.where).toEqual({
                        locationId,
                        senderType: 'customer',
                        isRead: false,
                    });
                },
            ),
            { numRuns: 100 },
        );
    });

    it('the data always sets isRead: true', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (locationId) => {
                    prisma.message.updateMany.mockReset();
                    prisma.message.updateMany.mockResolvedValue({ count: 0 });

                    await service.markAsRead(locationId);

                    const callArgs = prisma.message.updateMany.mock.calls[0][0];
                    expect(callArgs.data).toEqual({ isRead: true });
                },
            ),
            { numRuns: 100 },
        );
    });

    it('only customer messages are targeted (never admin messages)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (locationId) => {
                    prisma.message.updateMany.mockReset();
                    prisma.message.updateMany.mockResolvedValue({ count: 0 });

                    await service.markAsRead(locationId);

                    const callArgs = prisma.message.updateMany.mock.calls[0][0];
                    expect(callArgs.where.senderType).toBe('customer');
                    expect(callArgs.where.senderType).not.toBe('admin');
                },
            ),
            { numRuns: 100 },
        );
    });
});
