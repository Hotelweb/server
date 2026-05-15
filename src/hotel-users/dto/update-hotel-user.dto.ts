import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { HotelUserRole } from '../entities/hotel-user.entity.js';

export class UpdateHotelUserDto {
  @ApiPropertyOptional({ example: 'newemail@hotel.vn' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'newpassword123', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: 'Tran Thi B' })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiPropertyOptional({
    enum: HotelUserRole,
    example: HotelUserRole.RECEPTIONIST,
  })
  @IsOptional()
  @IsEnum(HotelUserRole)
  role?: HotelUserRole;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
