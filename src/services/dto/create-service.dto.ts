import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ServiceTranslationDto } from './service-translation.dto.js';

export class CreateServiceDto {
  @ApiProperty({ example: 1, description: 'Hotel ID this service belongs to' })
  @IsNumber()
  hotel_id: number;

  @ApiPropertyOptional({
    example: 'https://example.com/icon.png',
    description: 'Optional icon URL displayed on service cards',
  })
  @IsOptional()
  @IsString()
  icon_url?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/cover.jpg',
    description: 'Optional cover image URL shown on the service detail page',
  })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order — lower values appear first',
  })
  @IsOptional()
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({
    type: [ServiceTranslationDto],
    description:
      'At least one language. Service detail view falls back to English, then to the first available translation.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceTranslationDto)
  translations: ServiceTranslationDto[];
}
