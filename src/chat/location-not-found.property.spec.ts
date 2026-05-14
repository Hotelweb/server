import { Test, TestingModule } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import * as fc from 'fast-check';

/**
 * Property 22: Location Not Found Error
 *
 * For any locationId where the location does not exist, handleJoinRoom always
 * throws WsException with message 'Location not found'. The client never joins
 * a room and the message_history event is never emitted when the location doesn't exist.
 *
 * **Validates: Requirement 11.1**
 */

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

describe('Property 22: Location Not Found Error', () => {
    let gateway: ChatGateway;
    let locationsService: { findOne: jest.Mock; findBySlug: jest.Mock };
    let messagesService: { create: jest.Mock; findByLocation: jest.Mock };

    beforeEach(async () => {
        locationsService = {
            findOne: jest.fn(),
            findBySlug: jest.fn(),
        };

        messagesService = {
            create: jest.fn(),
            findByLocation: jest.fn(),
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

    const createMockClient = (id = 'client-1') => ({
        id,
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
    });

    describe('handleJoinRoom always throws WsException for non-existent locations', () => {
        it('for any locationId where location does not exist, handleJoinRoom always throws WsException', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    async (locationId) => {
                        // Mock location not found
                        locationsService.findOne.mockResolvedValue(null);

                        const client = createMockClient();

                        try {
                            await gateway.handleJoinRoom(client as any, { locationId });
                            // If handleJoinRoom succeeds, the property is violated
                            return false;
                        } catch (error) {
                            // Must throw WsException
                            return error instanceof WsException;
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('WsException message is always "Location not found"', () => {
        it('the error message is always "Location not found" for any non-existent locationId', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    async (locationId) => {
                        locationsService.findOne.mockResolvedValue(null);

                        const client = createMockClient();

                        try {
                            await gateway.handleJoinRoom(client as any, { locationId });
                            return false;
                        } catch (error) {
                            if (error instanceof WsException) {
                                return error.message === 'Location not found';
                            }
                            return false;
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('Client never joins a room when location does not exist', () => {
        it('for any non-existent locationId, client.join is never called', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    async (locationId) => {
                        locationsService.findOne.mockResolvedValue(null);

                        const client = createMockClient();

                        try {
                            await gateway.handleJoinRoom(client as any, { locationId });
                        } catch {
                            // expected
                        }

                        // client.join must never be called
                        return client.join.mock.calls.length === 0;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('message_history event is never emitted when location does not exist', () => {
        it('for any non-existent locationId, client never receives message_history', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    async (locationId) => {
                        locationsService.findOne.mockResolvedValue(null);

                        const client = createMockClient();

                        try {
                            await gateway.handleJoinRoom(client as any, { locationId });
                        } catch {
                            // expected
                        }

                        // client.emit must never be called with 'message_history'
                        const messageHistoryCalls = client.emit.mock.calls.filter(
                            (call: any[]) => call[0] === 'message_history',
                        );
                        return messageHistoryCalls.length === 0;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});
