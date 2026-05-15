import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HotelsService } from './hotels.service.js';
import { CreateHotelDto } from './dto/create-hotel.dto.js';
import { UpdateHotelDto } from './dto/update-hotel.dto.js';

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new hotel',
    description:
      'Creates a hotel with a unique QR token and a manager account. ' +
      'Manager credentials are optional — defaults are auto-generated if not provided. ' +
      'The manager can later update their email, password, and name.',
  })
  @ApiResponse({
    status: 201,
    description: 'Hotel and manager created successfully',
  })
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
  @ApiOperation({ summary: 'Update hotel details' })
  @ApiParam({ name: 'id', description: 'Hotel ID' })
  @ApiResponse({ status: 200, description: 'Hotel updated' })
  @ApiResponse({ status: 404, description: 'Hotel not found' })
  @ApiResponse({
    status: 409,
    description: 'Hotel with similar name already exists',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHotelDto) {
    return this.hotelsService.update(id, dto);
  }

  @Post(':id/regenerate-qr')
  @ApiOperation({
    summary: 'Regenerate QR token',
    description:
      'Generates a new QR token for the hotel, invalidating the old one.',
  })
  @ApiParam({ name: 'id', description: 'Hotel ID' })
  @ApiResponse({ status: 201, description: 'New QR token generated' })
  @ApiResponse({ status: 404, description: 'Hotel not found' })
  regenerateQr(@Param('id', ParseIntPipe) id: number) {
    return this.hotelsService.regenerateQrToken(id);
  }
}
