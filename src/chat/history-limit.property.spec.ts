import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 3: Message History Limit
 * **Validates: Requirement 2.4**
 *
 * When a client joins a room, the message history sent always calls
 * findByLocation with the locationId. The findByLocation is called with
 * default limit (no explicit limit param, which defaults to 50). The
 * message_history event is always emitted to the client after joining.
 */

jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class MockPrismaService {
        message = {
            create: jest.fn(),
            findMany: jest.fn(),
            updateMany: jest.fn(),
            count: jest.fn(),
        };
        location = {
            findUnique: jest.fn(),
        };
    },
}));

import { ChatGateway } from './chat.gateway';
import { MessagesService } from '../messages/messages.service';
import { LocationsService } from '../locations/locations.service';

describe('Property 3: Message History Limit', () => {
    let gateway: ChatGateway;
    let messagesService: { findByLocation: jest.Mock; create: jest.Mock };
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

    afterEach(() => {
        jest.clearAllMocks();
    });

    const createMockClient = (id = 'client-1') => ({
        id,
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
    });

    // Arbitrary for generating valid location IDs (UUIDs)
    const locationIdArbitrary = fc.uuid();

    it('should always call findByLocation with the locationId when a client joins a room', async () => {
        await fc.assert(
            fc.asyncProperty(locationIdArbitrary, async (locationId) => {
                messagesService.findByLocation.mockReset();
                locationsService.findOne.mockReset();

                // Mock location exists
                locationsService.findOne.mockResolvedValue({
                    id: locationId,
                    name: 'Test Location',
                    slug: 'test-location',
                    createdAt: new Date(),
                });

                // Mock message history
                messagesService.findByLocation.mockResolvedValue([]);

                const client = createMockClient();

                await gateway.handleJoinRoom(client as any, { locationId });

                // findByLocation must be called with the locationId
                expect(messagesService.findByLocation).toHaveBeenCalledTimes(1);
                expect(messagesService.findByLocation).toHaveBeenCalledWith(locationId);
            }),
            { numRuns: 100 },
        );
    });

    it('should always call findByLocation with no explicit limit param (defaults to 50)', async () => {
        await fc.assert(
            fc.asyncProperty(locationIdArbitrary, async (locationId) => {
                messagesService.findByLocation.mockReset();
                locationsService.findOne.mockReset();

                // Mock location exists
                locationsService.findOne.mockResolvedValue({
                    id: locationId,
                    name: 'Test Location',
                    slug: 'test-location',
                    createdAt: new Date(),
                });

                // Mock message history
                messagesService.findByLocation.mockResolvedValue([]);

                const client = createMockClient();

                await gateway.handleJoinRoom(client as any, { locationId });

                // findByLocation is called with only the locationId (no second argument)
                // This means the default limit of 50 is used internally by the service
                const callArgs = messagesService.findByLocation.mock.calls[0];
                expect(callArgs.length).toBe(1);
                expect(callArgs[0]).toBe(locationId);
            }),
            { numRuns: 100 },
        );
    });

    it('should always emit message_history event to the client after joining', async () => {
        // Generate arbitrary messages to return from findByLocation
        const messageArbitrary = fc.array(
            fc.record({
                id: fc.uuid(),
                content: fc.string({ minLength: 1, maxLength: 200 }),
                senderType: fc.constantFrom('customer', 'admin'),
                isRead: fc.boolean(),
                createdAt: fc.date(),
            }),
            { minLength: 0, maxLength: 10 },
        );

        await fc.assert(
            fc.asyncProperty(
                locationIdArbitrary,
                messageArbitrary,
                async (locationId, messages) => {
                    messagesService.findByLocation.mockReset();
                    locationsService.findOne.mockReset();

                    // Mock location exists
                    locationsService.findOne.mockResolvedValue({
                        id: locationId,
                        name: 'Test Location',
                        slug: 'test-location',
                        createdAt: new Date(),
                    });

                    // Mock message history with generated messages
                    const messagesWithLocationId = messages.map((m) => ({
                        ...m,
                        locationId,
                    }));
                    messagesService.findByLocation.mockResolvedValue(messagesWithLocationId);

                    const client = createMockClient();

                    await gateway.handleJoinRoom(client as any, { locationId });

                    // message_history event must always be emitted to the client
                    const emitCalls = (client.emit as jest.Mock).mock.calls;
                    const historyEmit = emitCalls.find(
                        (call) => call[0] === 'message_history',
                    );
                    expect(historyEmit).toBeDefined();
                    expect(historyEmit![1]).toEqual({ messages: messagesWithLocationId });
                },
            ),
            { numRuns: 100 },
        );
    });
});
