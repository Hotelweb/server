import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { FoodOrderStatus } from '../entities/food-order.entity.js';

export class UpdateFoodOrderStatusDto {
  @ApiProperty({
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'],
  })
  @IsEnum(['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'])
  status: FoodOrderStatus;

  @ApiPropertyOptional({ description: 'Required when rejecting an order' })
  @IsOptional()
  @IsString()
  rejected_reason?: string;
}
