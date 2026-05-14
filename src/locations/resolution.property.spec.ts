import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 2: Location Resolution Correctness
 * **Validates: Requirements 1.1, 1.2**
 *
 * For any valid slug, findBySlug always returns the correct location or null.
 * For any valid id, findOne always returns the correct location or null.
 * The service never returns a different location than the one matching the query.
 * If a location exists with a given slug, findBySlug always finds it.
 * If a location exists with a given id, findOne always finds it.
 */

jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class MockPrismaService {
        location = {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
    },
}));

import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Property 2: Location Resolution Correctness', () => {
    let service: LocationsService;
    let prisma: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [LocationsService, PrismaService],
        }).compile();

        service = module.get<LocationsService>(LocationsService);
        prisma = module.get<PrismaService>(PrismaService);

        prisma.location.findUnique.mockReset();
    });

    // Arbitrary for generating valid location data
    const locationArbitrary = fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 255 }),
        slug: fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/),
        qrCodeUrl: fc.option(fc.webUrl(), { nil: null }),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    });

    // Arbitrary for valid slugs (URL-safe: lowercase alphanumeric with hyphens)
    const slugArbitrary = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/);

    it('findBySlug should return the correct location when it exists', async () => {
        await fc.assert(
            fc.asyncProperty(locationArbitrary, async (location) => {
                // Mock: when queried with the location's slug, return that location
                prisma.location.findUnique.mockImplementation(
                    ({ where }: { where: { slug?: string; id?: string } }) => {
                        if (where.slug === location.slug) {
                            return Promise.resolve(location);
                        }
                        return Promise.resolve(null);
                    },
                );

                const result = await service.findBySlug(location.slug);

                // The returned location must be the exact same location
                expect(result).not.toBeNull();
                expect(result!.id).toBe(location.id);
                expect(result!.slug).toBe(location.slug);
                expect(result!.name).toBe(location.name);
            }),
            { numRuns: 50 },
        );
    });

    it('findBySlug should return null for non-existent slugs', async () => {
        await fc.assert(
            fc.asyncProperty(slugArbitrary, async (slug) => {
                // Mock: no location exists for any slug
                prisma.location.findUnique.mockResolvedValue(null);

                const result = await service.findBySlug(slug);

                // Must return null when location does not exist
                expect(result).toBeNull();
            }),
            { numRuns: 50 },
        );
    });

    it('findBySlug should never return a location with a different slug than queried', async () => {
        await fc.assert(
            fc.asyncProperty(locationArbitrary, async (location) => {
                // Mock returns the correct location for the matching slug
                prisma.location.findUnique.mockImplementation(
                    ({ where }: { where: { slug?: string; id?: string } }) => {
                        if (where.slug === location.slug) {
                            return Promise.resolve(location);
                        }
                        return Promise.resolve(null);
                    },
                );

                const result = await service.findBySlug(location.slug);

                // If a result is returned, its slug must match the queried slug
                if (result !== null) {
                    expect(result.slug).toBe(location.slug);
                }
            }),
            { numRuns: 50 },
        );
    });

    it('findOne should return the correct location when it exists', async () => {
        await fc.assert(
            fc.asyncProperty(locationArbitrary, async (location) => {
                // Mock: when queried with the location's id, return that location
                prisma.location.findUnique.mockImplementation(
                    ({ where }: { where: { slug?: string; id?: string } }) => {
                        if (where.id === location.id) {
                            return Promise.resolve(location);
                        }
                        return Promise.resolve(null);
                    },
                );

                const result = await service.findOne(location.id);

                // The returned location must be the exact same location
                expect(result).not.toBeNull();
                expect(result!.id).toBe(location.id);
                expect(result!.slug).toBe(location.slug);
                expect(result!.name).toBe(location.name);
            }),
            { numRuns: 50 },
        );
    });

    it('findOne should return null for non-existent ids', async () => {
        await fc.assert(
            fc.asyncProperty(fc.uuid(), async (id) => {
                // Mock: no location exists for any id
                prisma.location.findUnique.mockResolvedValue(null);

                const result = await service.findOne(id);

                // Must return null when location does not exist
                expect(result).toBeNull();
            }),
            { numRuns: 50 },
        );
    });

    it('findOne should never return a location with a different id than queried', async () => {
        await fc.assert(
            fc.asyncProperty(locationArbitrary, async (location) => {
                // Mock returns the correct location for the matching id
                prisma.location.findUnique.mockImplementation(
                    ({ where }: { where: { slug?: string; id?: string } }) => {
                        if (where.id === location.id) {
                            return Promise.resolve(location);
                        }
                        return Promise.resolve(null);
                    },
                );

                const result = await service.findOne(location.id);

                // If a result is returned, its id must match the queried id
                if (result !== null) {
                    expect(result.id).toBe(location.id);
                }
            }),
            { numRuns: 50 },
        );
    });
});
