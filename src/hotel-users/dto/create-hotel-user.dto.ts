import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { HotelUserRole } from '../entities/hotel-user.entity.js';

export class CreateHotelUserDto {
  @ApiProperty({ example: 1, description: 'Hotel ID this user belongs to' })
  @IsNumber()
  hotel_id: number;

  @ApiProperty({ example: 'staff@hotel.vn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty({ enum: HotelUserRole, example: HotelUserRole.HOTEL_ADMIN })
  @IsEnum(HotelUserRole)
  role: HotelUserRole;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatar_url?: string;
}
