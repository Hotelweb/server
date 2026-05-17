import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu-item.entity.js';
import { FoodOrder, FoodOrderItem } from './entities/food-order.entity.js';
import { FoodOrderService } from './food-order.service.js';
import { FoodOrderController } from './food-order.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuItem, FoodOrder, FoodOrderItem]),
    AuthModule,
  ],
  controllers: [FoodOrderController],
  providers: [FoodOrderService],
  exports: [FoodOrderService],
})
export class FoodOrderModule {}
