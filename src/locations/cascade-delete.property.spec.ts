import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';

/**
 * Property 11: Cascade Delete Integrity
 * **Validates: Requirements 5.3, 7.4**
 *
 * For any location deletion, all associated messages SHALL be deleted along
 * with the location. Since the Prisma schema has onDelete: Cascade on the
 * Message.location relation, deleting a location cascades to its messages.
 * The service correctly delegates to prisma.location.delete without manually
 * deleting messages.
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

describe('Property 11: Cascade Delete Integrity', () => {
    let locationsService: LocationsService;
    let prismaService: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [LocationsService, PrismaService],
        }).compile();

        locationsService = module.get<LocationsService>(LocationsService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should always call prisma.location.delete with the correct where clause for any location id', async () => {
        await fc.assert(
            fc.asyncProperty(fc.uuid(), async (locationId) => {
                jest.clearAllMocks();

                prismaService.location.delete.mockResolvedValue({
                    id: locationId,
                    name: 'Test Location',
                    slug: 'test-location',
                    qrCodeUrl: null,
                    createdAt: new Date(),
                });

                await locationsService.delete(locationId);

                // The delete method must be called exactly once
                expect(prismaService.location.delete).toHaveBeenCalledTimes(1);

                // The delete must use the correct where clause with the given id
                expect(prismaService.location.delete).toHaveBeenCalledWith({
                    where: { id: locationId },
                });
            }),
            { numRuns: 100 },
        );
    });

    it('should not attempt to manually delete messages (Prisma handles cascade)', async () => {
        await fc.assert(
            fc.asyncProperty(fc.uuid(), async (locationId) => {
                jest.clearAllMocks();

                prismaService.location.delete.mockResolvedValue({
                    id: locationId,
                    name: 'Test Location',
                    slug: 'test-location',
                    qrCodeUrl: null,
                    createdAt: new Date(),
                });

                await locationsService.delete(locationId);

                // The service should only interact with prisma.location.delete
                // It should NOT call any message-related operations for deletion
                // since cascade is handled by the database via Prisma schema
                expect(prismaService.location.delete).toHaveBeenCalledTimes(1);

                // Verify no other prisma.location methods were called during delete
                expect(prismaService.location.create).not.toHaveBeenCalled();
                expect(prismaService.location.findMany).not.toHaveBeenCalled();
                expect(prismaService.location.findUnique).not.toHaveBeenCalled();
                expect(prismaService.location.update).not.toHaveBeenCalled();
            }),
            { numRuns: 100 },
        );
    });

    it('should delegate deletion to Prisma for any valid id string without pre-processing', async () => {
        await fc.assert(
            fc.asyncProperty(fc.uuid(), async (locationId) => {
                jest.clearAllMocks();

                prismaService.location.delete.mockResolvedValue({
                    id: locationId,
                    name: 'Deleted',
                    slug: 'deleted',
                    qrCodeUrl: null,
                    createdAt: new Date(),
                });

                await locationsService.delete(locationId);

                // The id passed to prisma.location.delete must be exactly the
                // same id that was passed to the service method (no transformation)
                const callArgs = prismaService.location.delete.mock.calls[0][0];
                expect(callArgs.where.id).toBe(locationId);
            }),
            { numRuns: 100 },
        );
    });
});
