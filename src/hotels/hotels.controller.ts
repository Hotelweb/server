import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HotelsService } from './hotels.service.js';
import { CreateHotelDto } from './dto/create-hotel.dto.js';
import { UpdateHotelDto } from './dto/update-hotel.dto.js';
import {
  CurrentUser,
  JwtAuthGuard,
  RequireScopes,
} from '../auth/jwt-auth.guard.js';
import type { TokenPayload } from '../auth/token.service.js';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequireScopes('system')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new hotel',
    description:
      'Creates a hotel with a unique QR token and a manager account. ' +
      'Manager credentials are optional — defaults are auto-generated if not provided. ' +
      'The manager can later update their email, password, and name. ' +
      'Requires a system-admin token.',
  })
  @ApiResponse({
    status: 201,
    description: 'Hotel and manager created successfully',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Requires system scope' })
  @ApiResponse({
    status: 409,
    description: 'Hotel with similar name already exists',
  })
  create(@Body() dto: CreateHotelDto) {
    return this.hotelsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active hotels' })
  @ApiResponse({ status: 200, description: 'List of active hotels' })
  findAll() {
    return this.hotelsService.findAll();
  }

  @Get('qr/:qrToken')
  @ApiOperation({
    summary: 'Find hotel by QR token',
    description:
      'Used when a customer scans the hotel QR code to access the hotel page.',
  })
  @ApiParam({
    name: 'qrToken',
    description: 'Unique UUID QR token of the hotel',
  })
  @ApiResponse({ status: 200, description: 'Hotel found' })
  @ApiResponse({ status: 404, description: 'Hotel not found or inactive' })
  findByQr(@Param('qrToken') qrToken: string) {
    return this.hotelsService.findByQrToken(qrToken);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Find hotel by slug',
    description: 'Used for the public hotel detail page URL.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Hotel slug (URL-friendly name)',
  })
  @ApiResponse({ status: 200, description: 'Hotel found' })
  @ApiResponse({ status: 404, description: 'Hotel not found or inactive' })
  findBySlug(@Param('slug') slug: string) {
    return this.hotelsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hotel by ID' })
  @ApiParam({ name: 'id', description: 'Hotel ID' })
  @ApiResponse({ status: 200, description: 'Hotel details' })
  @ApiResponse({ status: 404, description: 'Hotel not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.hotelsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update hotel details',
    description:
      'System admins can update any hotel. Hotel users can only update their own hotel.',
  })
  @ApiParam({ name: 'id', description: 'Hotel ID' })
  @ApiResponse({ status: 200, description: 'Hotel updated' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Cannot update a different hotel' })
  @ApiResponse({ status: 404, description: 'Hotel not found' })
  @ApiResponse({
    status: 409,
    description: 'Hotel with similar name already exists',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHotelDto,
    @CurrentUser() user: TokenPayload,
  ) {
    if (user.scope === 'hotel' && user.hotel_id !== id) {
      throw new ForbiddenException('You can only update your own hotel');
    }
    return this.hotelsService.update(id, dto);
  }

  @Post(':id/regenerate-qr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Regenerate QR token',
    description:
      'Generates a new QR token for the hotel, invalidating the old one. ' +
      'System admins can regenerate any hotel; hotel users can only regenerate their own.',
  })
  @ApiParam({ name: 'id', description: 'Hotel ID' })
  @ApiResponse({ status: 201, description: 'New QR token generated' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({
    status: 403,
    description: 'Cannot regenerate a different hotel',
  })
  @ApiResponse({ status: 404, description: 'Hotel not found' })
  regenerateQr(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: TokenPayload,
  ) {
    if (user.scope === 'hotel' && user.hotel_id !== id) {
      throw new ForbiddenException('You can only regenerate your own hotel QR');
    }
    return this.hotelsService.regenerateQrToken(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequireScopes('system')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a hotel',
    description:
      'Marks the hotel as inactive (is_active = false). The hotel will be hidden ' +
      'from public listings and QR/slug lookups will return 404. The record is ' +
      'preserved so existing chat history and references remain intact. ' +
      'Requires a system-admin token.',
  })
  @ApiParam({ name: 'id', description: 'Hotel ID' })
  @ApiResponse({ status: 204, description: 'Hotel deactivated' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Requires system scope' })
  @ApiResponse({ status: 404, description: 'Hotel not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.hotelsService.softDelete(id);
  }
}
