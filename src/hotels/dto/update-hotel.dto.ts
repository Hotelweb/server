import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class UpdateHotelDto {
  @ApiPropertyOptional({ example: 'Grand Palace Hotel' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+84-28-1234-5678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@grandpalace.vn' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Hue, District 1, HCMC' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Luxury 5-star hotel' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../logo.png' })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../banner.png' })
  @IsOptional()
  @IsString()
  banner_url?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Gallery of additional intro photos (Cloudinary URLs).',
    example: [
      'https://res.cloudinary.com/.../lobby.jpg',
      'https://res.cloudinary.com/.../pool.jpg',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  gallery?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
