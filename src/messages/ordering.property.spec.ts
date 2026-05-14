import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 16: Message Ordering Consistency
 * **Validates: Requirements 6.6, 7.2**
 *
 * For any call to findByLocation, the orderBy is always { createdAt: 'desc' }.
 * This property holds regardless of locationId, limit, or cursor values.
 * The ordering is consistent across all pagination scenarios.
 */

jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class MockPrismaService {
        message = {
            create: jest.fn(),
            findMany: jest.fn(),
            updateMany: jest.fn(),
            count: jest.fn(),
        };
    },
}));

import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Property 16: Message Ordering Consistency', () => {
    let service: MessagesService;
    let prisma: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MessagesService, PrismaService],
        }).compile();

        service = module.get<MessagesService>(MessagesService);
        prisma = module.get<PrismaService>(PrismaService);

        prisma.message.findMany.mockReset();
        prisma.message.findMany.mockResolvedValue([]);
    });

    const locationIdArb = fc.uuid();
    const limitArb = fc.integer({ min: 1, max: 100 });
    const cursorArb = fc.uuid();

    it('should always use orderBy { createdAt: "desc" } regardless of locationId, limit, or cursor', async () => {
        await fc.assert(
            fc.asyncProperty(
                locationIdArb,
                fc.option(limitArb),
                fc.option(cursorArb),
                async (locationId, limit, cursor) => {
                    prisma.message.findMany.mockReset();
                    prisma.message.findMany.mockResolvedValue([]);

                    const options: { limit?: number; cursor?: string } = {};
                    if (limit !== null) options.limit = limit;
                    if (cursor !== null) options.cursor = cursor;

                    await service.findByLocation(locationId, options);

                    expect(prisma.message.findMany).toHaveBeenCalledTimes(1);
                    const callArgs = prisma.message.findMany.mock.calls[0][0];
                    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should maintain consistent ordering when no options are provided', async () => {
        await fc.assert(
            fc.asyncProperty(locationIdArb, async (locationId) => {
                prisma.message.findMany.mockReset();
                prisma.message.findMany.mockResolvedValue([]);

                await service.findByLocation(locationId);

                const callArgs = prisma.message.findMany.mock.calls[0][0];
                expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
            }),
            { numRuns: 100 },
        );
    });

    it('should maintain consistent ordering across all pagination scenarios', async () => {
        await fc.assert(
            fc.asyncProperty(
                locationIdArb,
                limitArb,
                cursorArb,
                fc.boolean(),
                async (locationId, limit, cursor, useCursor) => {
                    prisma.message.findMany.mockReset();
                    prisma.message.findMany.mockResolvedValue([]);

                    const options: { limit?: number; cursor?: string } = { limit };
                    if (useCursor) options.cursor = cursor;

                    await service.findByLocation(locationId, options);

                    const callArgs = prisma.message.findMany.mock.calls[0][0];
                    // Ordering must always be createdAt desc regardless of pagination params
                    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
                },
            ),
            { numRuns: 100 },
        );
    });
});
