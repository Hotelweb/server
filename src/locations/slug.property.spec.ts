import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 1: Slug Uniqueness and URL-Safety
 * **Validates: Requirements 1.4, 1.5, 5.1, 5.5**
 *
 * For any location name, the generated slug:
 * - Contains only lowercase letters, digits, and hyphens
 * - Never starts or ends with a hyphen
 * - Is never empty (falls back to 'location' for names with no valid chars)
 * - When creating multiple locations with the same name, all slugs are unique (counter suffix)
 * - Is URL-safe (can be used in a URL path without encoding)
 */

jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            location = {
                create: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            };
        },
    };
});

import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Property 1: Slug Uniqueness and URL-Safety', () => {
    let service: LocationsService;
    let prisma: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [LocationsService, PrismaService],
        }).compile();

        service = module.get<LocationsService>(LocationsService);
        prisma = module.get<PrismaService>(PrismaService);

        prisma.location.create.mockReset();
        prisma.location.findMany.mockReset();
        prisma.location.findUnique.mockReset();
        prisma.location.update.mockReset();
        prisma.location.delete.mockReset();
    });

    // Arbitrary for generating diverse location names including unicode, special chars, etc.
    const locationNameArbitrary = fc.string({ minLength: 1, maxLength: 255 });

    it('should always produce a slug containing only lowercase letters, digits, and hyphens', async () => {
        await fc.assert(
            fc.asyncProperty(locationNameArbitrary, async (name) => {
                // Mock: no existing slug conflicts
                prisma.location.findUnique.mockResolvedValue(null);
                prisma.location.create.mockImplementation(({ data }) => ({
                    id: 'uuid-1',
                    ...data,
                    qrCodeUrl: null,
                    createdAt: new Date(),
                }));

                const result = await service.create({ name });

                // Slug must only contain lowercase letters, digits, and hyphens
                const validSlugRegex = /^[a-z0-9-]+$/;
                expect(result.slug).toMatch(validSlugRegex);
            }),
            { numRuns: 100 },
        );
    });

    it('should never produce a slug that starts or ends with a hyphen', async () => {
        await fc.assert(
            fc.asyncProperty(locationNameArbitrary, async (name) => {
                prisma.location.findUnique.mockResolvedValue(null);
                prisma.location.create.mockImplementation(({ data }) => ({
                    id: 'uuid-1',
                    ...data,
                    qrCodeUrl: null,
                    createdAt: new Date(),
                }));

                const result = await service.create({ name });

                // Slug must not start or end with a hyphen
                expect(result.slug).not.toMatch(/^-/);
                expect(result.slug).not.toMatch(/-$/);
            }),
            { numRuns: 100 },
        );
    });

    it('should never produce an empty slug (falls back to "location" for names with no valid chars)', async () => {
        await fc.assert(
            fc.asyncProperty(locationNameArbitrary, async (name) => {
                prisma.location.findUnique.mockResolvedValue(null);
                prisma.location.create.mockImplementation(({ data }) => ({
                    id: 'uuid-1',
                    ...data,
                    qrCodeUrl: null,
                    createdAt: new Date(),
                }));

                const result = await service.create({ name });

                // Slug must never be empty
                expect(result.slug.length).toBeGreaterThan(0);
            }),
            { numRuns: 100 },
        );
    });

    it('should produce unique slugs when creating multiple locations with the same name', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.integer({ min: 2, max: 5 }),
                async (name, count) => {
                    // Track created slugs to simulate existing records
                    const createdSlugs: string[] = [];

                    prisma.location.findUnique.mockImplementation(({ where }) => {
                        if (createdSlugs.includes(where.slug)) {
                            return Promise.resolve({ id: `existing-${where.slug}`, slug: where.slug });
                        }
                        return Promise.resolve(null);
                    });

                    prisma.location.create.mockImplementation(({ data }) => {
                        createdSlugs.push(data.slug);
                        return Promise.resolve({
                            id: `uuid-${createdSlugs.length}`,
                            ...data,
                            qrCodeUrl: null,
                            createdAt: new Date(),
                        });
                    });

                    // Create multiple locations with the same name
                    const results: string[] = [];
                    for (let i = 0; i < count; i++) {
                        const result = await service.create({ name });
                        results.push(result.slug);
                    }

                    // All slugs must be unique
                    const uniqueSlugs = new Set(results);
                    expect(uniqueSlugs.size).toBe(results.length);
                },
            ),
            { numRuns: 30 },
        );
    });

    it('should always produce a URL-safe slug (no encoding needed in URL path)', async () => {
        await fc.assert(
            fc.asyncProperty(locationNameArbitrary, async (name) => {
                prisma.location.findUnique.mockResolvedValue(null);
                prisma.location.create.mockImplementation(({ data }) => ({
                    id: 'uuid-1',
                    ...data,
                    qrCodeUrl: null,
                    createdAt: new Date(),
                }));

                const result = await service.create({ name });

                // A URL-safe slug should not change when encoded
                const encoded = encodeURIComponent(result.slug);
                expect(encoded).toBe(result.slug);
            }),
            { numRuns: 100 },
        );
    });
});
