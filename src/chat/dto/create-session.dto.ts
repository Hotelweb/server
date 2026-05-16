import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 1, description: 'Hotel ID' })
  @IsNumber()
  @IsNotEmpty()
  hotel_id: number;

  @ApiProperty({
    example: 'en',
    description: 'Customer language (vi, en, ja, zh, ko, th)',
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

  @ApiPropertyOptional({ example: 'guest@example.com' })
  @IsOptional()
  @IsEmail()
  customer_email?: string;

  @ApiPropertyOptional({ example: 'Vietnam' })
  @IsOptional()
  @IsString()
  customer_country?: string;

  @ApiPropertyOptional({ example: '301' })
  @IsOptional()
  @IsString()
  room_number?: string;

  @ApiPropertyOptional({ example: 'Deluxe' })
  @IsOptional()
  @IsString()
  room_type?: string;

  @ApiPropertyOptional({ example: '2026-05-20' })
  @IsOptional()
  @IsDateString()
  check_in_date?: string;

  @ApiPropertyOptional({ example: '2026-05-22' })
  @IsOptional()
  @IsDateString()
  check_out_date?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  guest_count?: number;

  @ApiPropertyOptional({ example: 'Late check-in around 22:00' })
  @IsOptional()
  @IsString()
  initial_request?: string;
}

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'Hello, I need help' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ example: 'en', description: 'Source language' })
  @IsString()
  @IsNotEmpty()
  source_language: string;

  @ApiPropertyOptional({
    example: 'TEXT',
    description: 'Message type (TEXT | IMAGE)',
  })
  @IsOptional()
  @IsString()
  message_type?: 'TEXT' | 'IMAGE';

  @ApiPropertyOptional({ description: 'Image URL when message_type=IMAGE' })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiPropertyOptional({
    description: 'Client-generated UUID for optimistic-UI reconciliation',
  })
  @IsOptional()
  @IsString()
  client_message_id?: string;
}
