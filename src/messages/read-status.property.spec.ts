import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 15: Read Status by Sender Type
 * **Validates: Requirements 6.3, 12.1**
 *
 * For any message with senderType 'admin', isRead is always set to true on creation.
 * For any message with senderType 'customer', isRead is always set to false on creation.
 * This property holds regardless of the content or locationId.
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

describe('Property 15: Read Status by Sender Type', () => {
    let service: MessagesService;
    let prisma: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MessagesService, PrismaService],
        }).compile();

        service = module.get<MessagesService>(MessagesService);
        prisma = module.get<PrismaService>(PrismaService);

        prisma.message.create.mockReset();
    });

    // Arbitraries for generating message data
    const contentArbitrary = fc.string({ minLength: 1, maxLength: 2000 });
    const locationIdArbitrary = fc.uuid();

    it('should always set isRead to true for admin messages regardless of content or locationId', async () => {
        await fc.assert(
            fc.asyncProperty(
                contentArbitrary,
                locationIdArbitrary,
                async (content, locationId) => {
                    // Mock prisma to capture the data passed and return it
                    prisma.message.create.mockImplementation(
                        async ({ data }: { data: any }) => ({
                            id: 'mock-id',
                            ...data,
                            createdAt: new Date(),
                        }),
                    );

                    const result = await service.create({
                        content,
                        locationId,
                        senderType: 'admin' as const,
                    });

                    // isRead must always be true for admin messages
                    expect(result.isRead).toBe(true);

                    // Verify the correct data was passed to prisma
                    expect(prisma.message.create).toHaveBeenCalledWith({
                        data: expect.objectContaining({
                            isRead: true,
                            senderType: 'admin',
                        }),
                    });
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should always set isRead to false for customer messages regardless of content or locationId', async () => {
        await fc.assert(
            fc.asyncProperty(
                contentArbitrary,
                locationIdArbitrary,
                async (content, locationId) => {
                    // Mock prisma to capture the data passed and return it
                    prisma.message.create.mockImplementation(
                        async ({ data }: { data: any }) => ({
                            id: 'mock-id',
                            ...data,
                            createdAt: new Date(),
                        }),
                    );

                    const result = await service.create({
                        content,
                        locationId,
                        senderType: 'customer' as const,
                    });

                    // isRead must always be false for customer messages
                    expect(result.isRead).toBe(false);

                    // Verify the correct data was passed to prisma
                    expect(prisma.message.create).toHaveBeenCalledWith({
                        data: expect.objectContaining({
                            isRead: false,
                            senderType: 'customer',
                        }),
                    });
                },
            ),
            { numRuns: 100 },
        );
    });
});
