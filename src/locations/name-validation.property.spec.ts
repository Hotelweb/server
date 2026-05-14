import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as fc from 'fast-check';
import { CreateLocationDto } from './dto/create-location.dto';

/**
 * Property 12: Location Name Validation
 * **Validates: Requirement 5.4**
 *
 * THE Locations_Service SHALL validate that location names are non-empty strings
 * with a maximum length of 255 characters.
 */

describe('Property 12: Location Name Validation', () => {
    it('should reject any string longer than 255 characters', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 256, maxLength: 1000 }),
                async (longName) => {
                    const dto = plainToInstance(CreateLocationDto, { name: longName });
                    const errors = await validate(dto);
                    expect(errors.length).toBeGreaterThan(0);
                    const nameErrors = errors.filter((e) => e.property === 'name');
                    expect(nameErrors.length).toBeGreaterThan(0);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should accept any non-empty string of 255 characters or less', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 255 }),
                async (validName) => {
                    const dto = plainToInstance(CreateLocationDto, { name: validName });
                    const errors = await validate(dto);
                    const nameErrors = errors.filter((e) => e.property === 'name');
                    expect(nameErrors.length).toBe(0);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('should reject empty strings', async () => {
        const dto = plainToInstance(CreateLocationDto, { name: '' });
        const errors = await validate(dto);
        const nameErrors = errors.filter((e) => e.property === 'name');
        expect(nameErrors.length).toBeGreaterThan(0);
    });

    it('should reject non-string values', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.oneof(
                    fc.integer(),
                    fc.boolean(),
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.array(fc.anything()),
                    fc.dictionary(fc.string(), fc.anything()),
                ),
                async (nonStringValue) => {
                    const dto = plainToInstance(CreateLocationDto, { name: nonStringValue });
                    const errors = await validate(dto);
                    const nameErrors = errors.filter((e) => e.property === 'name');
                    expect(nameErrors.length).toBeGreaterThan(0);
                },
            ),
            { numRuns: 100 },
        );
    });
});
