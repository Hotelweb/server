import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 17: Pagination Correctness
 * **Validates: Requirement 7.3**
 *
 * The Messages_Service SHALL support pagination with a default limit of 50 messages
 * and optional cursor-based pagination. For any positive limit value, findByLocation
 * always passes that limit as 'take' to Prisma. When no limit is provided, the default
 * of 50 is always used. When a cursor is provided, skip:1 and cursor:{id} are always
 * included in the query. When no cursor is provided, skip and cursor are never included.
 * The orderBy is always { createdAt: 'desc' }.
 */

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

describe('Property 17: Pagination Correctness', () => {
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
    const positiveLimitArb = fc.integer({ min: 1, max: 1000 });
    const cursorIdArb = fc.uuid();

    it('should always pass a positive limit value as take to Prisma', async () => {
        await fc.assert(
            fc.asyncProperty(locationIdArb, positiveLimitArb, async (locationId, limit) => {
                prisma.message.findMany.mockResolvedValue([]);

                await service.findByLocation(locationId, { limit });

                const callArgs = prisma.message.findMany.mock.calls[0][0];
                expect(callArgs.take).toBe(limit);

                prisma.message.findMany.mockReset();
                prisma.message.findMany.mockResolvedValue([]);
            }),
            { numRuns: 50 },
        );
    });

    it('should always use default limit of 50 when no limit is provided', async () => {
        await fc.assert(
            fc.asyncProperty(locationIdArb, async (locationId) => {
                prisma.message.findMany.mockResolvedValue([]);

                await service.findByLocation(locationId);

                const callArgs = prisma.message.findMany.mock.calls[0][0];
                expect(callArgs.take).toBe(50);

                prisma.message.findMany.mockReset();
                prisma.message.findMany.mockResolvedValue([]);
            }),
            { numRuns: 50 },
        );
    });

    it('should always include skip:1 and cursor:{id} when cursor is provided', async () => {
        await fc.assert(
            fc.asyncProperty(locationIdArb, cursorIdArb, async (locationId, cursor) => {
                prisma.message.findMany.mockResolvedValue([]);

                await service.findByLocation(locationId, { cursor });

                const callArgs = prisma.message.findMany.mock.calls[0][0];
                expect(callArgs.skip).toBe(1);
                expect(callArgs.cursor).toEqual({ id: cursor });

                prisma.message.findMany.mockReset();
                prisma.message.findMany.mockResolvedValue([]);
            }),
            { numRuns: 50 },
        );
    });

    it('should never include skip or cursor when no cursor is provided', async () => {
        await fc.assert(
            fc.asyncProperty(locationIdArb, positiveLimitArb, async (locationId, limit) => {
                prisma.message.findMany.mockResolvedValue([]);

                await service.findByLocation(locationId, { limit });

                const callArgs = prisma.message.findMany.mock.calls[0][0];
                expect(callArgs.skip).toBeUndefined();
                expect(callArgs.cursor).toBeUndefined();

                prisma.message.findMany.mockReset();
                prisma.message.findMany.mockResolvedValue([]);
            }),
            { numRuns: 50 },
        );
    });

    it('should always order by createdAt descending', async () => {
        const optionsArb = fc.record({
            limit: fc.option(positiveLimitArb, { nil: undefined }),
            cursor: fc.option(cursorIdArb, { nil: undefined }),
        });

        await fc.assert(
            fc.asyncProperty(locationIdArb, optionsArb, async (locationId, options) => {
                prisma.message.findMany.mockResolvedValue([]);

                const opts: { limit?: number; cursor?: string } = {};
                if (options.limit !== undefined) opts.limit = options.limit;
                if (options.cursor !== undefined) opts.cursor = options.cursor;

                await service.findByLocation(locationId, Object.keys(opts).length > 0 ? opts : undefined);

                const callArgs = prisma.message.findMany.mock.calls[0][0];
                expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });

                prisma.message.findMany.mockReset();
                prisma.message.findMany.mockResolvedValue([]);
            }),
            { numRuns: 50 },
        );
    });
});
