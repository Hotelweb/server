import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HotelUsersService } from './hotel-users.service.js';
import { CreateHotelUserDto } from './dto/create-hotel-user.dto.js';
import { UpdateHotelUserDto } from './dto/update-hotel-user.dto.js';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { TokenPayload } from '../auth/token.service.js';

/**
 * System admins have full access. Hotel users (any role) only see / mutate
 * users that belong to their own hotel.
 */
function assertHotelAccess(user: TokenPayload, hotelId: number) {
  if (user.scope === 'system') return;
  if (user.hotel_id !== hotelId) {
    throw new ForbiddenException('Cannot access users from a different hotel');
  }
}

@ApiTags('hotel-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hotel-users')
export class HotelUsersController {
  constructor(private readonly hotelUsersService: HotelUsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a hotel admin',
    description: 'Create a new admin account for a hotel.',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Cross-hotel access denied' })
  @ApiResponse({
    status: 409,
    description: 'Email already exists for this hotel',
  })
  create(@Body() dto: CreateHotelUserDto, @CurrentUser() user: TokenPayload) {
    assertHotelAccess(user, dto.hotel_id);
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
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Cross-hotel access denied' })
  findAll(
    @Query('hotel_id', ParseIntPipe) hotelId: number,
    @CurrentUser() user: TokenPayload,
  ) {
    assertHotelAccess(user, hotelId);
    return this.hotelUsersService.findAllByHotel(hotelId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a hotel user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: TokenPayload,
  ) {
    const target = await this.hotelUsersService.findOne(id);
    assertHotelAccess(user, Number(target.hotel_id));
    return target;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a hotel admin',
    description:
      'Update admin profile: email, password, name, avatar, or active status.',
  })
  @ApiParam({ name: 'id', description: 'Admin user ID' })
  @ApiResponse({ status: 200, description: 'Admin updated' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({
    status: 409,
    description: 'Email already exists for this hotel',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHotelUserDto,
    @CurrentUser() user: TokenPayload,
  ) {
    const target = await this.hotelUsersService.findOne(id);
    assertHotelAccess(user, Number(target.hotel_id));
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
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: TokenPayload,
  ) {
    const target = await this.hotelUsersService.findOne(id);
    assertHotelAccess(user, Number(target.hotel_id));
    return this.hotelUsersService.softDelete(id);
  }
}
