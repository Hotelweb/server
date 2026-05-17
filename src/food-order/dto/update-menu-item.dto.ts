import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateMenuItemDto {
  @ApiPropertyOptional({ enum: ['food', 'drink'] })
  @IsOptional()
  @IsEnum(['food', 'drink'])
  category?: MenuCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}
