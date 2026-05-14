import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 14: Room Isolation
 * **Validates: Requirements 6.2, 6.5**
 *
 * For any message sent to a room, the broadcast always targets only that specific room.
 * The room name is always `location_${locationId}` (correctly derived from locationId).
 * server.to() is always called with the correct room name.
 */

jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class MockPrismaService {
        message = { create: jest.fn(), findMany: jest.fn() };
        location = { findUnique: jest.fn() };
    },
}));

import { ChatGateway } from './chat.gateway';
import { MessagesService } from '../messages/messages.service';
import { LocationsService } from '../locations/locations.service';

describe('Property 14: Room Isolation', () => {
    let gateway: ChatGateway;
    let messagesService: { create: jest.Mock; findByLocation: jest.Mock };
    let locationsService: { findOne: jest.Mock; findBySlug: jest.Mock };
    let mockEmit: jest.Mock;
    let mockServer: { to: jest.Mock };

    beforeEach(async () => {
        mockEmit = jest.fn();
        mockServer = {
            to: jest.fn().mockReturnValue({ emit: mockEmit }),
        };

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
        (gateway as any).server = mockServer;
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

    // Arbitrary for generating valid locationIds
    const locationIdArbitrary = fc.uuid();

    // Arbitrary for valid sender types
    const senderTypeArbitrary = fc.constantFrom('customer', 'admin');

    // Arbitrary for valid message content
    const contentArbitrary = fc.string({ minLength: 1, maxLength: 200 });

    it('should always broadcast to room `location_${locationId}` for any locationId', async () => {
        await fc.assert(
            fc.asyncProperty(
                locationIdArbitrary,
                contentArbitrary,
                senderTypeArbitrary,
                async (locationId, content, senderType) => {
                    mockServer.to.mockClear();
                    mockEmit.mockClear();
                    messagesService.create.mockReset();

                    const mockCreatedMessage = {
                        id: 'msg-id',
                        locationId,
                        content,
                        senderType,
                        isRead: senderType === 'admin',
                        createdAt: new Date(),
                    };
                    messagesService.create.mockResolvedValue(mockCreatedMessage);

                    const client = createMockClient();
                    await gateway.handleSendMessage(client as any, {
                        locationId,
                        content,
                        senderType,
                    });

                    // The room name must always be `location_${locationId}`
                    const expectedRoom = `location_${locationId}`;
                    expect(mockServer.to).toHaveBeenCalledWith(expectedRoom);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should always call server.to() exactly once per message send (targeting only one room)', async () => {
        await fc.assert(
            fc.asyncProperty(
                locationIdArbitrary,
                contentArbitrary,
                senderTypeArbitrary,
                async (locationId, content, senderType) => {
                    mockServer.to.mockClear();
                    mockEmit.mockClear();
                    messagesService.create.mockReset();

                    const mockCreatedMessage = {
                        id: 'msg-id',
                        locationId,
                        content,
                        senderType,
                        isRead: senderType === 'admin',
                        createdAt: new Date(),
                    };
                    messagesService.create.mockResolvedValue(mockCreatedMessage);

                    const client = createMockClient();
                    await gateway.handleSendMessage(client as any, {
                        locationId,
                        content,
                        senderType,
                    });

                    // server.to() must be called exactly once (only one room targeted)
                    expect(mockServer.to).toHaveBeenCalledTimes(1);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should never broadcast a message to a different room than the one derived from locationId', async () => {
        await fc.assert(
            fc.asyncProperty(
                locationIdArbitrary,
                locationIdArbitrary,
                contentArbitrary,
                senderTypeArbitrary,
                async (locationId, otherLocationId, content, senderType) => {
                    // Only test when locationIds are different
                    fc.pre(locationId !== otherLocationId);

                    mockServer.to.mockClear();
                    mockEmit.mockClear();
                    messagesService.create.mockReset();

                    const mockCreatedMessage = {
                        id: 'msg-id',
                        locationId,
                        content,
                        senderType,
                        isRead: senderType === 'admin',
                        createdAt: new Date(),
                    };
                    messagesService.create.mockResolvedValue(mockCreatedMessage);

                    const client = createMockClient();
                    await gateway.handleSendMessage(client as any, {
                        locationId,
                        content,
                        senderType,
                    });

                    // The other room must NOT have been targeted
                    const otherRoom = `location_${otherLocationId}`;
                    expect(mockServer.to).not.toHaveBeenCalledWith(otherRoom);
                },
            ),
            { numRuns: 100 },
        );
    });
});
