import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@system.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  /**
   * Which auth realm to log in to.
   *
   *  - `system` – root system admin (table system_admins)
   *  - `hotel`  – per-hotel staff/admin (table hotel_users)
   *
   * If omitted we try `system` first, then `hotel`. Sending an explicit scope
   * is preferred since it avoids an extra DB query and makes the intent clear.
   */
  @ApiPropertyOptional({ enum: ['system', 'hotel'], example: 'system' })
  @IsOptional()
  @IsIn(['system', 'hotel'])
  scope?: 'system' | 'hotel';
}
