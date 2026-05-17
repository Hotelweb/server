import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { TokenPayload } from '../auth/token.service.js';
import { FoodOrderService } from './food-order.service.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';
import { CreateFoodOrderDto } from './dto/create-food-order.dto.js';
import { UpdateFoodOrderStatusDto } from './dto/update-food-order-status.dto.js';
import type { FoodOrderStatus } from './entities/food-order.entity.js';

function assertHotelAccess(user: TokenPayload, hotelId: number) {
  if (user.scope === 'system') return;
  if (user.hotel_id !== hotelId) {
    throw new ForbiddenException(
      'Cannot access resources from a different hotel',
    );
  }
}

@ApiTags('food-order')
@Controller('food-order')
export class FoodOrderController {
  constructor(private readonly foodOrderService: FoodOrderService) {}

  // -------------------------------------------------------------------------
  // Public — guest menu & ordering
  // -------------------------------------------------------------------------

  @Get('menu/hotel/:hotelId')
  @ApiOperation({ summary: 'Public menu for guests' })
  @ApiParam({ name: 'hotelId' })
  @ApiQuery({ name: 'lang', required: false })
  getPublicMenu(
    @Param('hotelId', ParseIntPipe) hotelId: number,
    @Query('lang') lang?: string,
  ) {
    return this.foodOrderService.getPublicMenu(hotelId, lang);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Place a food/drink order (guest)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  createOrder(@Body() dto: CreateFoodOrderDto) {
    return this.foodOrderService.createOrder(dto);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order status (guest tracking)' })
  getOrder(@Param('id', ParseIntPipe) id: number) {
    return this.foodOrderService.getOrder(id);
  }

  // -------------------------------------------------------------------------
  // Admin — menu, orders, stats
  // -------------------------------------------------------------------------

  @Get('admin/menu/hotel/:hotelId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMenuAdmin(
    @Param('hotelId', ParseIntPipe) hotelId: number,
    @CurrentUser() user: TokenPayload,
  ) {
    assertHotelAccess(user, hotelId);
    return this.foodOrderService.getMenuForAdmin(hotelId);
  }

  @Post('admin/menu')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createMenuItem(
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() user: TokenPayload,
  ) {
    assertHotelAccess(user, dto.hotel_id);
    return this.foodOrderService.createMenuItem(dto);
  }

  @Patch('admin/menu/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateMenuItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() user: TokenPayload,
  ) {
    const item = await this.foodOrderService.findMenuItem(id);
    assertHotelAccess(user, Number(item.hotel_id));
    return this.foodOrderService.updateMenuItem(id, dto);
  }

  @Delete('admin/menu/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMenuItem(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: TokenPayload,
  ) {
    const item = await this.foodOrderService.findMenuItem(id);
    assertHotelAccess(user, Number(item.hotel_id));
    return this.foodOrderService.deleteMenuItem(id);
  }

  @Get('admin/orders/hotel/:hotelId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getOrdersAdmin(
    @Param('hotelId', ParseIntPipe) hotelId: number,
    @Query('status') status?: FoodOrderStatus,
    @CurrentUser() user?: TokenPayload,
  ) {
    assertHotelAccess(user!, hotelId);
    return this.foodOrderService.getOrdersForAdmin(hotelId, status);
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFoodOrderStatusDto,
    @CurrentUser() user: TokenPayload,
  ) {
    const order = await this.foodOrderService.getOrder(id);
    assertHotelAccess(user, order.hotel_id);
    return this.foodOrderService.updateOrderStatus(id, dto);
  }

  @Get('admin/stats/hotel/:hotelId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getStats(
    @Param('hotelId', ParseIntPipe) hotelId: number,
    @CurrentUser() user: TokenPayload,
  ) {
    assertHotelAccess(user, hotelId);
    return this.foodOrderService.getStats(hotelId);
  }

  @Get('admin/pending-count/hotel/:hotelId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPendingCount(
    @Param('hotelId', ParseIntPipe) hotelId: number,
    @CurrentUser() user: TokenPayload,
  ) {
    assertHotelAccess(user, hotelId);
    return this.foodOrderService.countPending(hotelId);
  }
}
