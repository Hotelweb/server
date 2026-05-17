import {
  BadRequestException,
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CloudinaryService, type UploadResult } from './cloudinary.service.js';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_FOLDERS = new Set(['hotels', 'services', 'menu', 'misc']);

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload an image to Cloudinary',
    description:
      'Accepts a single image file (≤ 5 MB, JPEG/PNG/WebP/GIF/SVG) and stores ' +
      'it on Cloudinary. Returns the secure URL plus the public_id so callers ' +
      'can later request a deletion. ' +
      'Allowed folder values: `hotels`, `services`, `misc`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    enum: ['hotels', 'services', 'misc'],
  })
  @ApiResponse({ status: 201, description: 'Uploaded' })
  @ApiResponse({ status: 400, description: 'Missing or invalid file' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 503, description: 'Cloudinary not configured' })
  async uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          // Allow common web image MIME types. multer reports the browser-
          // provided mime so this is a soft check; Cloudinary validates the
          // actual content again on its side.
          fileType: /^image\/(png|jpe?g|webp|gif|svg\+xml)$/,
        })
        .addMaxSizeValidator({ maxSize: MAX_BYTES })
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @Query('folder') folder?: string,
  ): Promise<UploadResult> {
    if (folder && !ALLOWED_FOLDERS.has(folder)) {
      throw new BadRequestException(
        `Invalid folder. Allowed: ${Array.from(ALLOWED_FOLDERS).join(', ')}`,
      );
    }
    return this.cloudinary.uploadBuffer(file.buffer, folder);
  }
}
