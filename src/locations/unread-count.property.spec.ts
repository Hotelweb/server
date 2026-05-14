import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 9: Unread Count Accuracy
 * **Validates: Requirements 4.2, 12.3**
 *
 * The unread count returned by getAllWithUnreadCount always equals the number
 * of unread customer messages. The query always filters by senderType: 'customer'
 * and isRead: false. The unread count is never negative and is always an integer.
 */

jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            location = {
                create: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            };
        },
    };
});

import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Property 9: Unread Count Accuracy', () => {
    let locationsService: LocationsService;
    let prismaService: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [LocationsService, PrismaService],
        }).compile();

        locationsService = module.get<LocationsService>(LocationsService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Arbitrary for generating a list of messages with mixed sender types and read statuses
    const messageArb = fc.record({
        id: fc.uuid(),
        senderType: fc.constantFrom('customer', 'admin'),
        isRead: fc.boolean(),
    });

    const locationArb = fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        slug: fc.string({ minLength: 1, maxLength: 50 }),
        qrCodeUrl: fc.option(fc.webUrl(), { nil: null }),
        createdAt: fc.date(),
    });

    it('unread count always equals the number of unread customer messages filtered by the query', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(locationArb, fc.array(messageArb, { minLength: 0, maxLength: 20 })),
                    { minLength: 1, maxLength: 10 },
                ),
                async (locationsWithMessages) => {
                    jest.clearAllMocks();

                    // Simulate what Prisma returns: locations with only the messages
                    // that match the where clause (isRead: false, senderType: 'customer')
                    const mockPrismaResult = locationsWithMessages.map(([loc, messages]) => {
                        // Filter messages the same way the Prisma query does
                        const unreadCustomerMessages = messages.filter(
                            (m) => m.senderType === 'customer' && m.isRead === false,
                        );

                        return {
                            ...loc,
                            messages: unreadCustomerMessages.map((m) => ({ id: m.id })),
                        };
                    });

                    prismaService.location.findMany.mockResolvedValue(mockPrismaResult);

                    const result = await locationsService.getAllWithUnreadCount();

                    // Verify the unread count for each location matches the filtered messages count
                    for (let i = 0; i < locationsWithMessages.length; i++) {
                        const [, messages] = locationsWithMessages[i];
                        const expectedUnreadCount = messages.filter(
                            (m) => m.senderType === 'customer' && m.isRead === false,
                        ).length;

                        expect(result[i].unreadCount).toBe(expectedUnreadCount);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('the query always filters by senderType customer and isRead false', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(locationArb, { minLength: 1, maxLength: 5 }),
                async (locations) => {
                    jest.clearAllMocks();

                    prismaService.location.findMany.mockResolvedValue(
                        locations.map((loc) => ({ ...loc, messages: [] })),
                    );

                    await locationsService.getAllWithUnreadCount();

                    // Verify findMany was called with the correct include/where clause
                    expect(prismaService.location.findMany).toHaveBeenCalledTimes(1);
                    const callArgs = prismaService.location.findMany.mock.calls[0][0];

                    expect(callArgs.include.messages.where).toEqual({
                        isRead: false,
                        senderType: 'customer',
                    });
                },
            ),
            { numRuns: 100 },
        );
    });

    it('unread count is never negative', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(locationArb, fc.array(messageArb, { minLength: 0, maxLength: 20 })),
                    { minLength: 1, maxLength: 10 },
                ),
                async (locationsWithMessages) => {
                    jest.clearAllMocks();

                    const mockPrismaResult = locationsWithMessages.map(([loc, messages]) => {
                        const unreadCustomerMessages = messages.filter(
                            (m) => m.senderType === 'customer' && m.isRead === false,
                        );

                        return {
                            ...loc,
                            messages: unreadCustomerMessages.map((m) => ({ id: m.id })),
                        };
                    });

                    prismaService.location.findMany.mockResolvedValue(mockPrismaResult);

                    const result = await locationsService.getAllWithUnreadCount();

                    for (const location of result) {
                        expect(location.unreadCount).toBeGreaterThanOrEqual(0);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('unread count is always an integer', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(locationArb, fc.array(messageArb, { minLength: 0, maxLength: 20 })),
                    { minLength: 1, maxLength: 10 },
                ),
                async (locationsWithMessages) => {
                    jest.clearAllMocks();

                    const mockPrismaResult = locationsWithMessages.map(([loc, messages]) => {
                        const unreadCustomerMessages = messages.filter(
                            (m) => m.senderType === 'customer' && m.isRead === false,
                        );

                        return {
                            ...loc,
                            messages: unreadCustomerMessages.map((m) => ({ id: m.id })),
                        };
                    });

                    prismaService.location.findMany.mockResolvedValue(mockPrismaResult);

                    const result = await locationsService.getAllWithUnreadCount();

                    for (const location of result) {
                        expect(Number.isInteger(location.unreadCount)).toBe(true);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });
});
