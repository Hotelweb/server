import { Global, Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service.js';
import { UploadsController } from './uploads.controller.js';

/**
 * Global so other modules (hotels, services) can inject CloudinaryService
 * for cleanup on delete without re-importing.
 */
@Global()
@Module({
  controllers: [UploadsController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class UploadsModule {}
