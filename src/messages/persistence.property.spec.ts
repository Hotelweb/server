import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 13: Message Persistence Guarantee
 * **Validates: Requirements 6.1, 7.1**
 *
 * For any valid message DTO (content, locationId, senderType), create() always
 * calls prisma.message.create with the correct data. The created message always
 * has the content, locationId, and senderType from the DTO. The isRead field is
 * always set correctly based on senderType (admin=true, customer=false).
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
import { SenderType } from './dto/create-message.dto';

describe('Property 13: Message Persistence Guarantee', () => {
    let messagesService: MessagesService;
    let prismaService: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MessagesService, PrismaService],
        }).compile();

        messagesService = module.get<MessagesService>(MessagesService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Arbitrary for generating valid message DTOs
    const messageArbitrary = fc.record({
        content: fc.string({ minLength: 1, maxLength: 2000 }),
        locationId: fc.uuid(),
        senderType: fc.constantFrom(SenderType.customer, SenderType.admin),
    });

    it('should always call prisma.message.create with the correct data from the DTO', async () => {
        await fc.assert(
            fc.asyncProperty(messageArbitrary, async (dto) => {
                prismaService.message.create.mockReset();

                const mockCreatedMessage = {
                    id: 'mock-uuid',
                    content: dto.content,
                    locationId: dto.locationId,
                    senderType: dto.senderType,
                    isRead: dto.senderType === 'admin',
                    createdAt: new Date(),
                };

                prismaService.message.create.mockResolvedValue(mockCreatedMessage);

                await messagesService.create(dto);

                // Verify prisma.message.create was called exactly once
                expect(prismaService.message.create).toHaveBeenCalledTimes(1);

                // Verify it was called with the correct data
                const callArgs = prismaService.message.create.mock.calls[0][0];
                expect(callArgs.data.content).toBe(dto.content);
                expect(callArgs.data.locationId).toBe(dto.locationId);
                expect(callArgs.data.senderType).toBe(dto.senderType);
            }),
            { numRuns: 100 },
        );
    });

    it('should always return a message with content, locationId, and senderType matching the DTO', async () => {
        await fc.assert(
            fc.asyncProperty(messageArbitrary, async (dto) => {
                const mockCreatedMessage = {
                    id: 'mock-uuid',
                    content: dto.content,
                    locationId: dto.locationId,
                    senderType: dto.senderType,
                    isRead: dto.senderType === 'admin',
                    createdAt: new Date(),
                };

                prismaService.message.create.mockResolvedValue(mockCreatedMessage);

                const result = await messagesService.create(dto);

                // The returned message must have the same content, locationId, and senderType
                expect(result.content).toBe(dto.content);
                expect(result.locationId).toBe(dto.locationId);
                expect(result.senderType).toBe(dto.senderType);
            }),
            { numRuns: 100 },
        );
    });

    it('should always set isRead to true for admin messages and false for customer messages', async () => {
        await fc.assert(
            fc.asyncProperty(messageArbitrary, async (dto) => {
                prismaService.message.create.mockReset();

                const expectedIsRead = dto.senderType === 'admin';

                const mockCreatedMessage = {
                    id: 'mock-uuid',
                    content: dto.content,
                    locationId: dto.locationId,
                    senderType: dto.senderType,
                    isRead: expectedIsRead,
                    createdAt: new Date(),
                };

                prismaService.message.create.mockResolvedValue(mockCreatedMessage);

                await messagesService.create(dto);

                // Verify the isRead field passed to prisma.message.create
                const callArgs = prismaService.message.create.mock.calls[0][0];
                expect(callArgs.data.isRead).toBe(expectedIsRead);
            }),
            { numRuns: 100 },
        );
    });
});
