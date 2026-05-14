import * as fc from 'fast-check';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { WsException } from '@nestjs/websockets';
import { ArgumentsHost } from '@nestjs/common';

/**
 * Property 21: Invalid Payload Error Handling
 *
 * For any invalid payload received via WebSocket, the WebSocket_Gateway SHALL
 * throw a WsException with a descriptive error message.
 *
 * This test verifies:
 * - For any invalid DTO input (violating constraints), validation always fails
 * - For SendMessageDto: empty content, content > 2000 chars, invalid senderType always fail
 * - For JoinRoomDto: empty locationId always fails
 * - The WsExceptionFilter always emits an 'error' event to the client
 *
 * **Validates: Requirement 10.5**
 */

import { SendMessageDto, SenderType } from '../chat/dto/send-message.dto';
import { JoinRoomDto } from '../chat/dto/join-room.dto';
import { WsExceptionFilter } from './filters/ws-exception.filter';

describe('Property 21: Invalid Payload Error Handling', () => {
    describe('SendMessageDto validation always fails for empty content', () => {
        it('for any SendMessageDto with empty content, validation always produces errors', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.constantFrom(SenderType.customer, SenderType.admin),
                    async (locationId, senderType) => {
                        const dto = plainToInstance(SendMessageDto, {
                            locationId,
                            content: '',
                            senderType,
                        });

                        const errors = await validate(dto);
                        return errors.length > 0;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('SendMessageDto validation always fails for content exceeding 2000 characters', () => {
        it('for any content longer than 2000 chars, validation always produces errors', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.constantFrom(SenderType.customer, SenderType.admin),
                    fc.string({ minLength: 2001, maxLength: 5000 }),
                    async (locationId, senderType, content) => {
                        const dto = plainToInstance(SendMessageDto, {
                            locationId,
                            content,
                            senderType,
                        });

                        const errors = await validate(dto);
                        return errors.length > 0;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('SendMessageDto validation always fails for invalid senderType', () => {
        it('for any senderType that is not "customer" or "admin", validation always produces errors', async () => {
            const invalidSenderTypeArb = fc
                .string({ minLength: 1, maxLength: 50 })
                .filter((s) => s !== 'customer' && s !== 'admin');

            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    invalidSenderTypeArb,
                    async (locationId, content, senderType) => {
                        const dto = plainToInstance(SendMessageDto, {
                            locationId,
                            content,
                            senderType,
                        });

                        const errors = await validate(dto);
                        return errors.length > 0;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('JoinRoomDto validation always fails for empty locationId', () => {
        it('for any JoinRoomDto with empty locationId, validation always produces errors', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(''),
                    async (locationId) => {
                        const dto = plainToInstance(JoinRoomDto, {
                            locationId,
                        });

                        const errors = await validate(dto);
                        return errors.length > 0;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('WsExceptionFilter always emits an error event to the client', () => {
        it('for any WsException message, the filter always emits an "error" event with the message', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 200 }),
                    async (errorMessage) => {
                        const filter = new WsExceptionFilter();
                        const exception = new WsException(errorMessage);

                        const mockClient = {
                            emit: jest.fn(),
                        };

                        const mockHost = {
                            switchToWs: () => ({
                                getClient: () => mockClient,
                                getData: () => ({}),
                            }),
                            switchToHttp: () => ({}),
                            switchToRpc: () => ({}),
                            getType: () => 'ws',
                            getArgs: () => [],
                            getArgByIndex: () => ({}),
                        } as unknown as ArgumentsHost;

                        filter.catch(exception, mockHost);

                        // The filter must always emit an 'error' event
                        expect(mockClient.emit).toHaveBeenCalledWith('error', {
                            message: errorMessage,
                        });

                        return mockClient.emit.mock.calls.length === 1 &&
                            mockClient.emit.mock.calls[0][0] === 'error' &&
                            mockClient.emit.mock.calls[0][1].message === errorMessage;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});
