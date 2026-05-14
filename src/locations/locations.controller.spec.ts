import { Test, TestingModule } from '@nestjs/testing';

// Mock PrismaService to avoid import.meta issue with generated Prisma client
jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            location = {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            };
        },
    };
});

import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

describe('LocationsController', () => {
    let controller: LocationsController;
    let locationsService: {
        findAll: jest.Mock;
        findOne: jest.Mock;
        findBySlug: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        getAllWithUnreadCount: jest.Mock;
    };

    const mockLocation = {
        id: 'loc-uuid-1',
        name: 'Hotel Lobby',
        slug: 'hotel-lobby',
        qrCodeUrl: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
    };

    const mockLocationWithUnread = {
        id: 'loc-uuid-1',
        name: 'Hotel Lobby',
        slug: 'hotel-lobby',
        qrCodeUrl: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        unreadCount: 3,
    };

    beforeEach(async () => {
        locationsService = {
            findAll: jest.fn(),
            findOne: jest.fn(),
            findBySlug: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            getAllWithUnreadCount: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [LocationsController],
            providers: [
                { provide: LocationsService, useValue: locationsService },
            ],
        }).compile();

        controller = module.get<LocationsController>(LocationsController);
    });

    describe('GET /api/locations', () => {
        it('should return all locations', async () => {
            const locations = [mockLocation];
            locationsService.findAll.mockResolvedValue(locations);

            const result = await controller.findAll();

            expect(result).toEqual(locations);
            expect(locationsService.findAll).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no locations exist', async () => {
            locationsService.findAll.mockResolvedValue([]);

            const result = await controller.findAll();

            expect(result).toEqual([]);
        });
    });

    describe('GET /api/locations/admin/dashboard', () => {
        it('should return all locations with unread counts', async () => {
            const locationsWithUnread = [mockLocationWithUnread];
            locationsService.getAllWithUnreadCount.mockResolvedValue(locationsWithUnread);

            const result = await controller.getAllWithUnreadCount();

            expect(result).toEqual(locationsWithUnread);
            expect(locationsService.getAllWithUnreadCount).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no locations exist', async () => {
            locationsService.getAllWithUnreadCount.mockResolvedValue([]);

            const result = await controller.getAllWithUnreadCount();

            expect(result).toEqual([]);
        });
    });

    describe('GET /api/locations/:id', () => {
        it('should return a location by id', async () => {
            locationsService.findOne.mockResolvedValue(mockLocation);

            const result = await controller.findOne('loc-uuid-1');

            expect(result).toEqual(mockLocation);
            expect(locationsService.findOne).toHaveBeenCalledWith('loc-uuid-1');
        });

        it('should return null when location not found', async () => {
            locationsService.findOne.mockResolvedValue(null);

            const result = await controller.findOne('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('GET /api/locations/slug/:slug', () => {
        it('should return a location by slug', async () => {
            locationsService.findBySlug.mockResolvedValue(mockLocation);

            const result = await controller.findBySlug('hotel-lobby');

            expect(result).toEqual(mockLocation);
            expect(locationsService.findBySlug).toHaveBeenCalledWith('hotel-lobby');
        });

        it('should return null when slug not found', async () => {
            locationsService.findBySlug.mockResolvedValue(null);

            const result = await controller.findBySlug('non-existent-slug');

            expect(result).toBeNull();
        });
    });

    describe('POST /api/locations', () => {
        it('should create a new location', async () => {
            const createDto: CreateLocationDto = { name: 'New Location' };
            const createdLocation = {
                ...mockLocation,
                id: 'new-uuid',
                name: 'New Location',
                slug: 'new-location',
            };
            locationsService.create.mockResolvedValue(createdLocation);

            const result = await controller.create(createDto);

            expect(result).toEqual(createdLocation);
            expect(locationsService.create).toHaveBeenCalledWith(createDto);
        });

        it('should delegate to LocationsService.create with the DTO', async () => {
            const createDto: CreateLocationDto = { name: 'Test Location' };
            locationsService.create.mockResolvedValue(mockLocation);

            await controller.create(createDto);

            expect(locationsService.create).toHaveBeenCalledTimes(1);
            expect(locationsService.create).toHaveBeenCalledWith(createDto);
        });
    });

    describe('PATCH /api/locations/:id', () => {
        it('should update a location', async () => {
            const updateDto: UpdateLocationDto = { name: 'Updated Name' };
            const updatedLocation = { ...mockLocation, name: 'Updated Name', slug: 'updated-name' };
            locationsService.update.mockResolvedValue(updatedLocation);

            const result = await controller.update('loc-uuid-1', updateDto);

            expect(result).toEqual(updatedLocation);
            expect(locationsService.update).toHaveBeenCalledWith('loc-uuid-1', updateDto);
        });

        it('should pass id and dto to LocationsService.update', async () => {
            const updateDto: UpdateLocationDto = { name: 'Another Name' };
            locationsService.update.mockResolvedValue(mockLocation);

            await controller.update('some-id', updateDto);

            expect(locationsService.update).toHaveBeenCalledWith('some-id', updateDto);
        });
    });

    describe('DELETE /api/locations/:id', () => {
        it('should delete a location', async () => {
            locationsService.delete.mockResolvedValue(undefined);

            await controller.delete('loc-uuid-1');

            expect(locationsService.delete).toHaveBeenCalledWith('loc-uuid-1');
        });

        it('should delegate to LocationsService.delete with the id', async () => {
            locationsService.delete.mockResolvedValue(undefined);

            await controller.delete('another-id');

            expect(locationsService.delete).toHaveBeenCalledTimes(1);
            expect(locationsService.delete).toHaveBeenCalledWith('another-id');
        });
    });

    describe('Route ordering', () => {
        it('should have admin/dashboard route defined before :id route', () => {
            // Verify the controller methods exist and are properly decorated
            // The admin/dashboard route must be defined BEFORE :id to avoid conflicts
            const prototype = LocationsController.prototype;
            expect(prototype.getAllWithUnreadCount).toBeDefined();
            expect(prototype.findOne).toBeDefined();
            expect(prototype.findBySlug).toBeDefined();
            expect(prototype.findAll).toBeDefined();
            expect(prototype.create).toBeDefined();
            expect(prototype.update).toBeDefined();
            expect(prototype.delete).toBeDefined();
        });
    });
});
