import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';

@Injectable()
export class MessagesService {
    constructor(private prisma: PrismaService) { }

    async create(createMessageDto: CreateMessageDto) {
        return this.prisma.message.create({
            data: {
                content: createMessageDto.content,
                locationId: createMessageDto.locationId,
                senderType: createMessageDto.senderType,
                isRead: createMessageDto.senderType === 'admin',
            },
        });
    }

    async findByLocation(
        locationId: string,
        options?: { limit?: number; cursor?: string },
    ) {
        const limit = options?.limit ?? 50;
        const cursor = options?.cursor;

        return this.prisma.message.findMany({
            where: { locationId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            ...(cursor
                ? {
                    skip: 1,
                    cursor: { id: cursor },
                }
                : {}),
        });
    }

    async markAsRead(locationId: string) {
        await this.prisma.message.updateMany({
            where: {
                locationId,
                senderType: 'customer',
                isRead: false,
            },
            data: { isRead: true },
        });
    }

    async getUnreadCount(locationId: string) {
        return this.prisma.message.count({
            where: {
                locationId,
                senderType: 'customer',
                isRead: false,
            },
        });
    }
}
