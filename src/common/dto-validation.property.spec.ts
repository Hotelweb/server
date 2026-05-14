import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as fc from 'fast-check';
import { LoginDto } from '../auth/dto/login.dto';
import { CreateLocationDto } from '../locations/dto/create-location.dto';
import {
    CreateMessageDto,
    SenderType,
} from '../messages/dto/create-message.dto';

/**
 * Property 20: DTO Validation Enforcement
 * **Validates: Requirement 10.1**
 *
 * THE System SHALL validate all DTOs using class-validator before processing.
 * For any valid DTO input (matching all constraints), validation always passes.
 */

describe('Property 20: DTO Validation Enforcement', () => {
    describe('LoginDto: valid email + non-empty password always passes', () => {
        it('should pass validation for any valid email and non-empty password', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.emailAddress(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    async (email, password) => {
                        const dto = plainToInstance(LoginDto, {
                            email,
                            password,
                        });
                        const errors = await validate(dto);
                        expect(errors.length).toBe(0);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('CreateLocationDto: non-empty string <= 255 chars always passes', () => {
        it('should pass validation for any non-empty name up to 255 characters', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 255 }),
                    async (name) => {
                        const dto = plainToInstance(CreateLocationDto, {
                            name,
                        });
                        const errors = await validate(dto);
                        expect(errors.length).toBe(0);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('CreateMessageDto: non-empty content <= 2000 chars + valid locationId + valid senderType always passes', () => {
        it('should pass validation for any valid combination of content, locationId, and senderType', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 2000 }),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    fc.constantFrom(SenderType.customer, SenderType.admin),
                    async (content, locationId, senderType) => {
                        const dto = plainToInstance(CreateMessageDto, {
                            content,
                            locationId,
                            senderType,
                        });
                        const errors = await validate(dto);
                        expect(errors.length).toBe(0);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});
