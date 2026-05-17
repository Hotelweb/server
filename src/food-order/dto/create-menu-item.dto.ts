import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { MenuCategory } from '../entities/menu-item.entity.js';

export class CreateMenuItemDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  hotel_id: number;

  @ApiPropertyOptional({ enum: ['food', 'drink'], default: 'food' })
  @IsOptional()
  @IsEnum(['food', 'drink'])
  category?: MenuCategory;

  @ApiProperty({ example: 'Phở bò' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Beef pho' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description_en?: string;

  @ApiProperty({ example: 85000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}
