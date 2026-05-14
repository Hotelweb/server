import { Test, TestingModule } from '@nestjs/testing';

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

describe('LocationsService', () => {
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

    describe('create', () => {
        it('should create a location with a generated slug', async () => {
            prisma.location.findUnique.mockResolvedValue(null);
            prisma.location.create.mockResolvedValue({
                id: 'uuid-1',
                name: 'Hotel Lobby',
                slug: 'hotel-lobby',
                qrCodeUrl: null,
                createdAt: new Date(),
            });

            const result = await service.create({ name: 'Hotel Lobby' });

            expect(prisma.location.create).toHaveBeenCalledWith({
                data: { name: 'Hotel Lobby', slug: 'hotel-lobby' },
            });
            expect(result.slug).toBe('hotel-lobby');
        });

        it('should generate slug with only lowercase alphanumeric and hyphens', async () => {
            prisma.location.findUnique.mockResolvedValue(null);
            prisma.location.create.mockImplementation(({ data }) => ({
                id: 'uuid-1',
                ...data,
                qrCodeUrl: null,
                createdAt: new Date(),
            }));

            await service.create({ name: 'Café & Restaurant #1' });

            expect(prisma.location.create).toHaveBeenCalledWith({
                data: { name: 'Café & Restaurant #1', slug: 'caf-restaurant-1' },
            });
        });

        it('should remove leading and trailing hyphens from slug', async () => {
            prisma.location.findUnique.mockResolvedValue(null);
            prisma.location.create.mockImplementation(({ data }) => ({
                id: 'uuid-1',
                ...data,
                qrCodeUrl: null,
                createdAt: new Date(),
            }));

            await service.create({ name: '---Test Location---' });

            expect(prisma.location.create).toHaveBeenCalledWith({
                data: { name: '---Test Location---', slug: 'test-location' },
            });
        });

        it('should append counter when slug already exists', async () => {
            // First call: slug "hotel-lobby" exists
            prisma.location.findUnique
                .mockResolvedValueOnce({ id: 'existing-id', slug: 'hotel-lobby' })
                .mockResolvedValueOnce(null); // "hotel-lobby-1" does not exist

            prisma.location.create.mockImplementation(({ data }) => ({
                id: 'uuid-2',
                ...data,
                qrCodeUrl: null,
                createdAt: new Date(),
            }));

            await service.create({ name: 'Hotel Lobby' });

            expect(prisma.location.create).toHaveBeenCalledWith({
                data: { name: 'Hotel Lobby', slug: 'hotel-lobby-1' },
            });
        });

        it('should use "location" as fallback slug when name produces empty string', async () => {
            prisma.location.findUnique.mockResolvedValue(null);
            prisma.location.create.mockImplementation(({ data }) => ({
                id: 'uuid-1',
                ...data,
                qrCodeUrl: null,
                createdAt: new Date(),
            }));

            await service.create({ name: '!!@@##' });

            expect(prisma.location.create).toHaveBeenCalledWith({
                data: { name: '!!@@##', slug: 'location' },
            });
        });
    });

    describe('findAll', () => {
        it('should return all locations ordered by createdAt desc', async () => {
            const mockLocations = [
                { id: '1', name: 'Location A', slug: 'location-a', createdAt: new Date('2025-02-01') },
                { id: '2', name: 'Location B', slug: 'location-b', createdAt: new Date('2025-01-01') },
            ];
            prisma.location.findMany.mockResolvedValue(mockLocations);

            const result = await service.findAll();

            expect(result).toEqual(mockLocations);
            expect(prisma.location.findMany).toHaveBeenCalledWith({
                orderBy: { createdAt: 'desc' },
            });
        });
    });

    describe('findOne', () => {
        it('should return a location by id', async () => {
            const mockLocation = { id: 'uuid-1', name: 'Lobby', slug: 'lobby' };
            prisma.location.findUnique.mockResolvedValue(mockLocation);

            const result = await service.findOne('uuid-1');

            expect(result).toEqual(mockLocation);
            expect(prisma.location.findUnique).toHaveBeenCalledWith({
                where: { id: 'uuid-1' },
            });
        });

        it('should return null when location does not exist', async () => {
            prisma.location.findUnique.mockResolvedValue(null);

            const result = await service.findOne('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('findBySlug', () => {
        it('should return a location by slug', async () => {
            const mockLocation = { id: 'uuid-1', name: 'Lobby', slug: 'lobby' };
            prisma.location.findUnique.mockResolvedValue(mockLocation);

            const result = await service.findBySlug('lobby');

            expect(result).toEqual(mockLocation);
            expect(prisma.location.findUnique).toHaveBeenCalledWith({
                where: { slug: 'lobby' },
            });
        });

        it('should return null when slug does not exist', async () => {
            prisma.location.findUnique.mockResolvedValue(null);

            const result = await service.findBySlug('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('update', () => {
        it('should regenerate slug when name is updated', async () => {
            // The slug "new-name" does not exist
            prisma.location.findUnique.mockResolvedValue(null);
            prisma.location.update.mockResolvedValue({
                id: 'uuid-1',
                name: 'New Name',
                slug: 'new-name',
            });

            await service.update('uuid-1', { name: 'New Name' });

            expect(prisma.location.update).toHaveBeenCalledWith({
                where: { id: 'uuid-1' },
                data: { name: 'New Name', slug: 'new-name' },
            });
        });

        it('should allow keeping the same slug if updating own record', async () => {
            // The slug "lobby" exists but belongs to the same record being updated
            prisma.location.findUnique.mockResolvedValue({ id: 'uuid-1', slug: 'lobby' });
            prisma.location.update.mockResolvedValue({
                id: 'uuid-1',
                name: 'Lobby',
                slug: 'lobby',
            });

            await service.update('uuid-1', { name: 'Lobby' });

            expect(prisma.location.update).toHaveBeenCalledWith({
                where: { id: 'uuid-1' },
                data: { name: 'Lobby', slug: 'lobby' },
            });
        });

        it('should append counter when new slug conflicts with another record', async () => {
            // "new-name" belongs to a different record
            prisma.location.findUnique
                .mockResolvedValueOnce({ id: 'other-id', slug: 'new-name' })
                .mockResolvedValueOnce(null); // "new-name-1" is free

            prisma.location.update.mockResolvedValue({
                id: 'uuid-1',
                name: 'New Name',
                slug: 'new-name-1',
            });

            await service.update('uuid-1', { name: 'New Name' });

            expect(prisma.location.update).toHaveBeenCalledWith({
                where: { id: 'uuid-1' },
                data: { name: 'New Name', slug: 'new-name-1' },
            });
        });

        it('should not regenerate slug when name is not provided', async () => {
            prisma.location.update.mockResolvedValue({
                id: 'uuid-1',
                name: 'Lobby',
                slug: 'lobby',
            });

            await service.update('uuid-1', {});

            expect(prisma.location.update).toHaveBeenCalledWith({
                where: { id: 'uuid-1' },
                data: {},
            });
            // findUnique should not be called for slug check
            expect(prisma.location.findUnique).not.toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('should delete a location by id', async () => {
            prisma.location.delete.mockResolvedValue({ id: 'uuid-1' });

            await service.delete('uuid-1');

            expect(prisma.location.delete).toHaveBeenCalledWith({
                where: { id: 'uuid-1' },
            });
        });
    });

    describe('getAllWithUnreadCount', () => {
        it('should return locations with unread message counts', async () => {
            const mockLocations = [
                {
                    id: 'loc-1',
                    name: 'Lobby',
                    slug: 'lobby',
                    qrCodeUrl: null,
                    createdAt: new Date('2025-01-01'),
                    messages: [{ id: 'msg-1' }, { id: 'msg-2' }],
                },
                {
                    id: 'loc-2',
                    name: 'Pool',
                    slug: 'pool',
                    qrCodeUrl: 'https://example.com/qr',
                    createdAt: new Date('2025-01-02'),
                    messages: [],
                },
            ];
            prisma.location.findMany.mockResolvedValue(mockLocations);

            const result = await service.getAllWithUnreadCount();

            expect(prisma.location.findMany).toHaveBeenCalledWith({
                include: {
                    messages: {
                        where: { isRead: false, senderType: 'customer' },
                        select: { id: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toEqual([
                {
                    id: 'loc-1',
                    name: 'Lobby',
                    slug: 'lobby',
                    qrCodeUrl: null,
                    createdAt: new Date('2025-01-01'),
                    unreadCount: 2,
                },
                {
                    id: 'loc-2',
                    name: 'Pool',
                    slug: 'pool',
                    qrCodeUrl: 'https://example.com/qr',
                    createdAt: new Date('2025-01-02'),
                    unreadCount: 0,
                },
            ]);
        });

        it('should return empty array when no locations exist', async () => {
            prisma.location.findMany.mockResolvedValue([]);

            const result = await service.getAllWithUnreadCount();

            expect(result).toEqual([]);
        });

        it('should only count unread customer messages (not admin messages)', async () => {
            const mockLocations = [
                {
                    id: 'loc-1',
                    name: 'Lobby',
                    slug: 'lobby',
                    qrCodeUrl: null,
                    createdAt: new Date('2025-01-01'),
                    messages: [{ id: 'msg-1' }],
                },
            ];
            prisma.location.findMany.mockResolvedValue(mockLocations);

            const result = await service.getAllWithUnreadCount();

            // The query filters for senderType: 'customer' and isRead: false
            expect(prisma.location.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: {
                        messages: {
                            where: { isRead: false, senderType: 'customer' },
                            select: { id: true },
                        },
                    },
                }),
            );
            expect(result[0].unreadCount).toBe(1);
        });
    });

    describe('getLocationWithLatestMessage', () => {
        it('should return location with the latest message', async () => {
            const latestMessage = {
                id: 'msg-1',
                locationId: 'loc-1',
                senderType: 'customer',
                content: 'Hello',
                isRead: false,
                createdAt: new Date('2025-01-01T12:00:00Z'),
            };
            const mockLocation = {
                id: 'loc-1',
                name: 'Lobby',
                slug: 'lobby',
                qrCodeUrl: null,
                createdAt: new Date('2025-01-01'),
                messages: [latestMessage],
            };
            prisma.location.findUnique.mockResolvedValue(mockLocation);

            const result = await service.getLocationWithLatestMessage('loc-1');

            expect(prisma.location.findUnique).toHaveBeenCalledWith({
                where: { id: 'loc-1' },
                include: {
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            });
            expect(result).toEqual({
                id: 'loc-1',
                name: 'Lobby',
                slug: 'lobby',
                qrCodeUrl: null,
                createdAt: new Date('2025-01-01'),
                latestMessage: latestMessage,
            });
        });

        it('should return null when location does not exist', async () => {
            prisma.location.findUnique.mockResolvedValue(null);

            const result = await service.getLocationWithLatestMessage('nonexistent');

            expect(result).toBeNull();
        });

        it('should return latestMessage as null when location has no messages', async () => {
            const mockLocation = {
                id: 'loc-1',
                name: 'Lobby',
                slug: 'lobby',
                qrCodeUrl: null,
                createdAt: new Date('2025-01-01'),
                messages: [],
            };
            prisma.location.findUnique.mockResolvedValue(mockLocation);

            const result = await service.getLocationWithLatestMessage('loc-1');

            expect(result).toEqual({
                id: 'loc-1',
                name: 'Lobby',
                slug: 'lobby',
                qrCodeUrl: null,
                createdAt: new Date('2025-01-01'),
                latestMessage: null,
            });
        });

        it('should return the most recent message regardless of sender type', async () => {
            const adminMessage = {
                id: 'msg-2',
                locationId: 'loc-1',
                senderType: 'admin',
                content: 'Admin reply',
                isRead: true,
                createdAt: new Date('2025-01-01T13:00:00Z'),
            };
            const mockLocation = {
                id: 'loc-1',
                name: 'Lobby',
                slug: 'lobby',
                qrCodeUrl: null,
                createdAt: new Date('2025-01-01'),
                messages: [adminMessage],
            };
            prisma.location.findUnique.mockResolvedValue(mockLocation);

            const result = await service.getLocationWithLatestMessage('loc-1');

            expect(result!.latestMessage).toEqual(adminMessage);
        });
    });
});
