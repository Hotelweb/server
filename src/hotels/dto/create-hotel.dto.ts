import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateHotelDto {
  @ApiProperty({ example: 'Grand Palace Hotel', description: 'Hotel name' })
  @IsString()
  @IsNotEmpty()
  name: string;

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

  @ApiPropertyOptional({
    example: 'manager@grandpalace.vn',
    description: 'Manager email. Auto-generated if not provided.',
  })
  @IsOptional()
  @IsEmail()
  manager_email?: string;

  @ApiPropertyOptional({
    example: 'secret123',
    description:
      'Manager password (min 6 chars). Auto-generated if not provided.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  manager_password?: string;

  @ApiPropertyOptional({
    example: 'Nguyen Van A',
    description: 'Manager full name. Defaults to "{hotel_name} Manager".',
  })
  @IsOptional()
  @IsString()
  manager_name?: string;
}
