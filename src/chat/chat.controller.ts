import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service.js';
import { CreateSessionDto, SendMessageDto } from './dto/create-session.dto.js';
import { ChatSessionStatus } from './entities/chat.entity.js';
import { TranslationService } from './translation.service.js';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly translationService: TranslationService,
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session (customer starts chat)' })
  @ApiResponse({ status: 201, description: 'Chat session created' })
  createSession(@Body() dto: CreateSessionDto) {
    return this.chatService.createSession(dto);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get chat session by ID' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  getSession(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.getSession(id);
  }

  @Get('sessions/token/:token')
  @ApiOperation({ summary: 'Get chat session by customer token' })
  @ApiParam({ name: 'token', description: 'Customer token UUID' })
  getSessionByToken(@Param('token') token: string) {
    return this.chatService.getSessionByToken(token);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Get messages for a chat session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  getMessages(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.getMessages(id);
  }

  @Post('sessions/:id/messages/customer')
  @ApiOperation({ summary: 'Send a message as customer' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  sendCustomerMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendCustomerMessage(id, dto);
  }

  @Post('sessions/:id/messages/staff/:userId')
  @ApiOperation({ summary: 'Send a message as staff' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiParam({ name: 'userId', description: 'Staff user ID' })
  sendStaffMessage(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendStaffMessage(id, userId, dto);
  }

  @Patch('sessions/:id/status')
  @ApiOperation({ summary: 'Update session status (active, booked, closed)' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: ChatSessionStatus },
  ) {
    return this.chatService.updateSessionStatus(id, body.status);
  }

  @Post('sessions/:id/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiQuery({ name: 'by', enum: ['customer', 'staff'] })
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @Query('by') by: 'customer' | 'staff' = 'staff',
  ) {
    return this.chatService.markMessagesRead(id, by);
  }

  @Get('hotel/:hotelId/sessions')
  @ApiOperation({ summary: 'Get all chat sessions for a hotel' })
  @ApiParam({ name: 'hotelId', description: 'Hotel ID' })
  getHotelSessions(@Param('hotelId', ParseIntPipe) hotelId: number) {
    return this.chatService.getHotelSessions(hotelId);
  }

  @Post('translate')
  @ApiOperation({
    summary:
      'Quick on-demand translation (used for canned responses preview, etc.)',
  })
  async translate(
    @Body() body: { text: string; source: string; target: string },
  ) {
    const result = await this.translationService.translate(
      body.text,
      body.source,
      body.target,
    );
    return result;
  }
}
