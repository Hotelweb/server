import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 1, description: 'Hotel ID' })
  @IsNumber()
  @IsNotEmpty()
  hotel_id: number;

  @ApiProperty({
    example: 'en',
    description: 'Customer language (vi, en, ja, zh, ko)',
  })
  @IsString()
  @IsNotEmpty()
  customer_language: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  customer_phone?: string;

  @ApiPropertyOptional({ example: '301' })
  @IsOptional()
  @IsString()
  room_number?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Hello, I need help' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: 'en', description: 'Source language' })
  @IsString()
  @IsNotEmpty()
  source_language: string;
}
