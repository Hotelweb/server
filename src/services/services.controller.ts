import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ServicesService } from './services.service.js';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('hotel/:hotelId')
  @ApiOperation({ summary: 'Get services for a hotel' })
  @ApiParam({ name: 'hotelId', description: 'Hotel ID' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language code (vi, en, ja, zh, ko)',
  })
  @ApiResponse({ status: 200, description: 'List of services for the hotel' })
  findByHotel(
    @Param('hotelId', ParseIntPipe) hotelId: number,
    @Query('lang') lang?: string,
  ) {
    return this.servicesService.findByHotel(hotelId, lang);
  }
}
