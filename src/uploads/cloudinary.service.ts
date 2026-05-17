import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

export interface UploadResult {
  url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

/**
 * Thin wrapper around the Cloudinary SDK.
 *
 * Configuration is read once at startup. If credentials are missing the
 * service stays disabled and uploads return a 503 — that's clearer than the
 * generic Cloudinary "must supply api_key" error and lets the rest of the
 * app boot during local development without a Cloudinary account.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly enabled: boolean;
  private readonly folder: string;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');
    this.folder = config.get<string>('CLOUDINARY_FOLDER', 'a25');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.enabled = true;
      this.logger.log(
        `Cloudinary configured (cloud: ${cloudName}, folder: ${this.folder})`,
      );
    } else {
      this.enabled = false;
      this.logger.warn(
        'Cloudinary credentials missing — image uploads disabled. ' +
          'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to enable.',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Upload a file buffer to Cloudinary.
   *
   * @param buffer  raw bytes from multer
   * @param folder  optional sub-folder under CLOUDINARY_FOLDER (e.g. "hotels")
   *                so admins can find their uploads in the Cloudinary dashboard
   */
  async uploadBuffer(buffer: Buffer, folder?: string): Promise<UploadResult> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Image uploads are disabled — Cloudinary is not configured on the server',
      );
    }

    const targetFolder = folder ? `${this.folder}/${folder}` : this.folder;

    return new Promise<UploadResult>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: targetFolder,
          resource_type: 'image',
          // Auto-pick the smallest format (webp/avif when possible) and
          // strip metadata so customer pages stay fast.
          fetch_format: 'auto',
          quality: 'auto',
        },
        (err, result) => {
          if (err) {
            this.logger.error(
              `Cloudinary upload failed: ${err.message}`,
              err.stack,
            );
            reject(
              new InternalServerErrorException(
                err.message || 'Cloudinary upload failed',
              ),
            );
            return;
          }
          if (!result) {
            reject(
              new InternalServerErrorException('Cloudinary returned no result'),
            );
            return;
          }
          resolve(this.toResult(result));
        },
      );
      stream.end(buffer);
    });
  }

  /**
   * Best-effort delete. Failures are logged but don't propagate — orphaned
   * Cloudinary assets are easier to clean up than a half-deleted hotel.
   */
  async destroy(publicId: string): Promise<void> {
    if (!this.enabled || !publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(
        `Failed to delete Cloudinary asset ${publicId}: ${message}`,
      );
    }
  }

  private toResult(r: UploadApiResponse): UploadResult {
    return {
      url: r.secure_url,
      public_id: r.public_id,
      width: r.width,
      height: r.height,
      format: r.format,
      bytes: r.bytes,
    };
  }
}
