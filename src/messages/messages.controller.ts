import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@Controller('api/messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    @Get('location/:locationId')
    findByLocation(
        @Param('locationId') locationId: string,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        return this.messagesService.findByLocation(locationId, {
            limit: limit ? parseInt(limit, 10) : undefined,
            cursor: cursor || undefined,
        });
    }

    @Post(':locationId/read')
    @UseGuards(JwtAuthGuard)
    markAsRead(@Param('locationId') locationId: string) {
        return this.messagesService.markAsRead(locationId);
    }
}
