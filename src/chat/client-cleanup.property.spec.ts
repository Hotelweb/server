import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 19: Client Cleanup on Disconnect
 * **Validates: Requirement 9.3**
 *
 * When a client disconnects, it is removed from the connectedClients map.
 * When a client disconnects, client.leave() is called for all rooms it was in.
 * After disconnect, getClientRooms returns undefined for that client.
 */

jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class MockPrismaService {
        message = {
            create: jest.fn(),
            findMany: jest.fn(),
            updateMany: jest.fn(),
            count: jest.fn(),
        };
        location = { findUnique: jest.fn() };
    },
}));

import { ChatGateway } from './chat.gateway';
import { MessagesService } from '../messages/messages.service';
import { LocationsService } from '../locations/locations.service';

describe('Property 19: Client Cleanup on Disconnect', () => {
    let gateway: ChatGateway;

    beforeEach(async () => {
        const messagesService = {
            create: jest.fn(),
            findByLocation: jest.fn(),
        };

        const locationsService = {
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

    const createMockClient = (id: string) => ({
        id,
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
    });

    // Arbitraries
    const clientIdArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
    const roomNameArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
    const roomSetArbitrary = fc.uniqueArray(roomNameArbitrary, { minLength: 0, maxLength: 10 });

    it('should remove client from connectedClients map after disconnect', async () => {
        await fc.assert(
            fc.asyncProperty(
                clientIdArbitrary,
                roomSetArbitrary,
                async (clientId, rooms) => {
                    const client = createMockClient(clientId);

                    // Connect the client
                    gateway.handleConnection(client as any);

                    // Track rooms for the client
                    for (const room of rooms) {
                        gateway.trackClientRoom(clientId, room);
                    }

                    // Verify client is tracked before disconnect
                    expect(gateway.getClientRooms(clientId)).toBeDefined();

                    // Disconnect the client
                    gateway.handleDisconnect(client as any);

                    // After disconnect, client should be removed from connectedClients
                    expect(gateway.getClientRooms(clientId)).toBeUndefined();
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should call client.leave() for all rooms the client was in on disconnect', async () => {
        await fc.assert(
            fc.asyncProperty(
                clientIdArbitrary,
                roomSetArbitrary,
                async (clientId, rooms) => {
                    const client = createMockClient(clientId);

                    // Connect the client
                    gateway.handleConnection(client as any);

                    // Track rooms for the client
                    for (const room of rooms) {
                        gateway.trackClientRoom(clientId, room);
                    }

                    // Disconnect the client
                    gateway.handleDisconnect(client as any);

                    // client.leave() should have been called for each room
                    expect(client.leave).toHaveBeenCalledTimes(rooms.length);
                    for (const room of rooms) {
                        expect(client.leave).toHaveBeenCalledWith(room);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should return undefined from getClientRooms after disconnect', async () => {
        await fc.assert(
            fc.asyncProperty(
                clientIdArbitrary,
                roomSetArbitrary,
                async (clientId, rooms) => {
                    const client = createMockClient(clientId);

                    // Connect the client
                    gateway.handleConnection(client as any);

                    // Track rooms for the client
                    for (const room of rooms) {
                        gateway.trackClientRoom(clientId, room);
                    }

                    // Disconnect the client
                    gateway.handleDisconnect(client as any);

                    // getClientRooms should return undefined for disconnected client
                    const result = gateway.getClientRooms(clientId);
                    expect(result).toBeUndefined();
                },
            ),
            { numRuns: 100 },
        );
    });
});
