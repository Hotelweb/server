import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LanguageCode } from '../../chat/entities/chat.entity.js';

/**
 * One-language slice of a service: a title (mandatory) plus a markdown
 * description (optional) shown in the customer-facing detail view.
 *
 * `description` is stored as raw Markdown text — no separate column type.
 * The frontend renders it with react-markdown + remark-gfm, so admins can
 * use lists, headings, links, tables, etc. without any extra plumbing.
 */
export class ServiceTranslationDto {
  @ApiProperty({
    enum: LanguageCode,
    example: LanguageCode.VI,
    description: 'Language code (vi, en, ja, zh, ko, th)',
  })
  @IsEnum(LanguageCode)
  language: LanguageCode;

  @ApiProperty({ example: 'Spa & Massage', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example:
      '## Spa cao cấp\n\nMở cửa 9:00 - 22:00.\n\n- Massage toàn thân\n- Xông hơi\n- Tắm thảo dược',
    description: 'Markdown-formatted description of the service',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
