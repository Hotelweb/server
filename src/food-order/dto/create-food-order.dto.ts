import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class FoodOrderLineDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  menu_item_id: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateFoodOrderDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  hotel_id: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  service_id?: number;

  @ApiPropertyOptional({ example: '1205' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  room_number?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customer_name?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customer_phone?: string;

  @ApiPropertyOptional({ example: 'Không cay' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [FoodOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodOrderLineDto)
  items: FoodOrderLineDto[];
}
