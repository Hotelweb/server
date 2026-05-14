import { Test, TestingModule } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import * as fc from 'fast-check';

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

/**
 * Property 4: Sender Type Validation
 * **Validates: Requirement 2.9**
 *
 * IF a message is received with an invalid senderType (not 'customer' or 'admin'),
 * THEN THE WebSocket_Gateway SHALL reject the message.
 */

describe('Property 4: Sender Type Validation', () => {
    let gateway: ChatGateway;
    let messagesService: { create: jest.Mock; findByLocation: jest.Mock };
    let mockServer: { to: jest.Mock };
    let mockEmit: jest.Mock;

    beforeEach(async () => {
        mockEmit = jest.fn();
        mockServer = {
            to: jest.fn().mockReturnValue({ emit: mockEmit }),
        };

        messagesService = {
            create: jest.fn().mockResolvedValue({
                id: 'msg-1',
                locationId: 'loc-123',
                content: 'test',
                senderType: 'customer',
                isRead: false,
                createdAt: new Date(),
            }),
            findByLocation: jest.fn().mockResolvedValue([]),
        };

        const locationsService = {
            findOne: jest.fn().mockResolvedValue({ id: 'loc-123', name: 'Test', slug: 'test' }),
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

    // Arbitrary for invalid sender types: any string that is NOT 'customer' or 'admin'
    const invalidSenderTypeArb = fc.string({ minLength: 0, maxLength: 50 }).filter(
        (s) => s !== 'customer' && s !== 'admin',
    );

    // Arbitrary for valid sender types
    const validSenderTypeArb = fc.constantFrom('customer', 'admin');

    // Arbitrary for valid message content
    const validContentArb = fc.string({ minLength: 1, maxLength: 200 });

    // Arbitrary for valid location IDs
    const validLocationIdArb = fc.uuid();

    it('should always throw WsException for any invalid senderType', async () => {
        await fc.assert(
            fc.asyncProperty(
                invalidSenderTypeArb,
                validContentArb,
                validLocationIdArb,
                async (senderType, content, locationId) => {
                    const client = createMockClient();
                    const payload = { locationId, content, senderType };

                    await expect(
                        gateway.handleSendMessage(client as any, payload),
                    ).rejects.toThrow(WsException);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should always succeed for valid senderType with valid content and locationId', async () => {
        await fc.assert(
            fc.asyncProperty(
                validSenderTypeArb,
                validContentArb,
                validLocationIdArb,
                async (senderType, content, locationId) => {
                    const client = createMockClient();
                    const payload = { locationId, content, senderType };

                    // Should not throw
                    const result = await gateway.handleSendMessage(client as any, payload);
                    expect(result).toBeDefined();
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should never persist a message when senderType is invalid', async () => {
        await fc.assert(
            fc.asyncProperty(
                invalidSenderTypeArb,
                validContentArb,
                validLocationIdArb,
                async (senderType, content, locationId) => {
                    const client = createMockClient();
                    const payload = { locationId, content, senderType };

                    // Reset mock call count
                    messagesService.create.mockClear();

                    try {
                        await gateway.handleSendMessage(client as any, payload);
                    } catch {
                        // expected to throw
                    }

                    expect(messagesService.create).not.toHaveBeenCalled();
                },
            ),
            { numRuns: 100 },
        );
    });
});
