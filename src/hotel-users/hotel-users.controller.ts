import {
  Body,
  Controller,
  Delete,
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
import { HotelUsersService } from './hotel-users.service.js';
import { CreateHotelUserDto } from './dto/create-hotel-user.dto.js';
import { UpdateHotelUserDto } from './dto/update-hotel-user.dto.js';

@ApiTags('hotel-users')
@Controller('hotel-users')
export class HotelUsersController {
  constructor(private readonly hotelUsersService: HotelUsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a hotel user',
    description:
      'Create a new staff member (admin, receptionist, kitchen, staff) for a hotel.',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({
    status: 409,
    description: 'Email already exists for this hotel',
  })
  create(@Body() dto: CreateHotelUserDto) {
    return this.hotelUsersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all users for a hotel' })
  @ApiQuery({
    name: 'hotel_id',
    type: Number,
    description: 'Hotel ID to filter users',
  })
  @ApiResponse({ status: 200, description: 'List of hotel users' })
  findAll(@Query('hotel_id', ParseIntPipe) hotelId: number) {
    return this.hotelUsersService.findAllByHotel(hotelId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a hotel user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.hotelUsersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a hotel user',
    description:
      'Update user profile: email, password, name, role, avatar, or active status.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description: 'Email already exists for this hotel',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHotelUserDto,
  ) {
    return this.hotelUsersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a hotel user',
    description:
      'Marks the user as deleted and inactive. Does not permanently remove the record.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User soft-deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.hotelUsersService.softDelete(id);
  }
}
