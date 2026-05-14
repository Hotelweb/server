import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLocationDto } from './dto/create-location.dto.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';

@Injectable()
export class LocationsService {
    constructor(private prisma: PrismaService) { }

    async create(createLocationDto: CreateLocationDto) {
        const slug = this.generateSlug(createLocationDto.name);
        const uniqueSlug = await this.ensureUniqueSlug(slug);

        return this.prisma.location.create({
            data: {
                name: createLocationDto.name,
                slug: uniqueSlug,
            },
        });
    }

    async findAll() {
        return this.prisma.location.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.location.findUnique({
            where: { id },
        });
    }

    async findBySlug(slug: string) {
        return this.prisma.location.findUnique({
            where: { slug },
        });
    }

    async update(id: string, updateLocationDto: UpdateLocationDto) {
        const data: Record<string, unknown> = { ...updateLocationDto };

        if (updateLocationDto.name !== undefined) {
            const slug = this.generateSlug(updateLocationDto.name);
            const uniqueSlug = await this.ensureUniqueSlug(slug, id);
            data.slug = uniqueSlug;
        }

        return this.prisma.location.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        await this.prisma.location.delete({
            where: { id },
        });
    }

    async getAllWithUnreadCount() {
        const locations = await this.prisma.location.findMany({
            include: {
                messages: {
                    where: { isRead: false, senderType: 'customer' },
                    select: { id: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return locations.map((location) => ({
            id: location.id,
            name: location.name,
            slug: location.slug,
            qrCodeUrl: location.qrCodeUrl,
            createdAt: location.createdAt,
            unreadCount: location.messages.length,
        }));
    }

    async getLocationWithLatestMessage(id: string) {
        const location = await this.prisma.location.findUnique({
            where: { id },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (!location) return null;

        return {
            id: location.id,
            name: location.name,
            slug: location.slug,
            qrCodeUrl: location.qrCodeUrl,
            createdAt: location.createdAt,
            latestMessage: location.messages[0] || null,
        };
    }

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
        let candidate = slug || 'location';
        let counter = 0;

        while (true) {
            const existing = await this.prisma.location.findUnique({
                where: { slug: candidate },
            });

            if (!existing || existing.id === excludeId) return candidate;

            counter++;
            candidate = `${slug || 'location'}-${counter}`;
        }
    }
}
