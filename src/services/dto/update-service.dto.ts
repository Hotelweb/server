import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ServiceTranslationDto } from './service-translation.dto.js';

/**
 * Partial update. When `translations` is provided we replace the full set
 * for that service in a single transaction (delete old → insert new). Omit
 * the field to leave existing translations untouched.
 */
export class UpdateServiceDto {
  @ApiPropertyOptional({ example: 'https://example.com/icon.png' })
  @IsOptional()
  @IsString()
  icon_url?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
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
  is_active?: boolean;

  @ApiPropertyOptional({
    type: [ServiceTranslationDto],
    description:
      'If present, replaces all translations for this service. Must contain at least one entry.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceTranslationDto)
  translations?: ServiceTranslationDto[];
}
