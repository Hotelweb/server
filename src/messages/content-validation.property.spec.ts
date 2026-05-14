import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as fc from 'fast-check';
import { CreateMessageDto, SenderType } from './dto/create-message.dto';

/**
 * Property 18: Message Content Validation
 * **Validates: Requirement 7.5**
 *
 * THE Messages_Service SHALL validate that message content is required and max 2000 characters,
 * and IF content validation fails, THEN THE Messages_Service SHALL reject the message creation entirely.
 */

describe('Property 18: Message Content Validation', () => {
    const validLocationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const validSenderType = SenderType.customer;

    it('should reject any string longer than 2000 characters', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 2001, maxLength: 5000 }),
                async (longContent) => {
                    const dto = plainToInstance(CreateMessageDto, {
                        content: longContent,
                        locationId: validLocationId,
                        senderType: validSenderType,
                    });
                    const errors = await validate(dto);
                    const contentErrors = errors.filter((e) => e.property === 'content');
                    expect(contentErrors.length).toBeGreaterThan(0);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should accept any non-empty string of 2000 characters or less', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 2000 }),
                async (validContent) => {
                    const dto = plainToInstance(CreateMessageDto, {
                        content: validContent,
                        locationId: validLocationId,
                        senderType: validSenderType,
                    });
                    const errors = await validate(dto);
                    const contentErrors = errors.filter((e) => e.property === 'content');
                    expect(contentErrors.length).toBe(0);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should reject empty strings', async () => {
        const dto = plainToInstance(CreateMessageDto, {
            content: '',
            locationId: validLocationId,
            senderType: validSenderType,
        });
        const errors = await validate(dto);
        const contentErrors = errors.filter((e) => e.property === 'content');
        expect(contentErrors.length).toBeGreaterThan(0);
    });
});
