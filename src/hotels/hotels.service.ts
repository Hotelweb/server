import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Hotel } from './entities/hotel.entity.js';
import { HotelUser } from '../hotel-users/entities/hotel-user.entity.js';
import { CreateHotelDto } from './dto/create-hotel.dto.js';
import { UpdateHotelDto } from './dto/update-hotel.dto.js';

@Injectable()
export class HotelsService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelRepo: Repository<Hotel>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a hotel with a unique QR token and its manager account in a single transaction.
   * Manager credentials are optional — defaults are generated if not provided.
   * The manager can update their email, password, and name later via PATCH /hotel-users/:id.
   */
  async create(dto: CreateHotelDto) {
    const slug = this.generateSlug(dto.name);

    // Check slug uniqueness
    const existingSlug = await this.hotelRepo.findOne({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException('A hotel with a similar name already exists');
    }

    const qrToken = randomUUID();

    // Generate default manager credentials if not provided
    const managerEmail = dto.manager_email || `admin@${slug}.hotel`;
    const managerPassword = dto.manager_password || randomUUID().slice(0, 12);
    const managerName = dto.manager_name || `${dto.name} Manager`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create hotel
      const hotel = queryRunner.manager.create(Hotel, {
        name: dto.name,
        slug,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        description: dto.description,
        qr_token: qrToken,
      });

      const savedHotel = await queryRunner.manager.save(hotel);

      // Create manager user for this hotel
      const passwordHash = await bcrypt.hash(managerPassword, 10);

      const manager = queryRunner.manager.create(HotelUser, {
        hotel_id: savedHotel.id,
        email: managerEmail,
        password_hash: passwordHash,
        full_name: managerName,
      });

      const savedManager = await queryRunner.manager.save(manager);

      await queryRunner.commitTransaction();

      // Generate QR page URL (the slug-based public page)
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const qr_page_url = `${baseUrl}/hotel/${slug}`;

      return {
        hotel: savedHotel,
        qr_page_url,
        manager: {
          id: savedManager.id,
          hotel_id: savedManager.hotel_id,
          email: savedManager.email,
          full_name: savedManager.full_name,
          is_active: savedManager.is_active,
          created_at: savedManager.created_at,
          // Return default password only if it was auto-generated
          ...(dto.manager_password
            ? {}
            : { default_password: managerPassword }),
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Hotel[]> {
    return this.hotelRepo.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Hotel> {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) {
      throw new NotFoundException(`Hotel #${id} not found`);
    }
    return hotel;
  }

  /**
   * Find hotel by slug — used for the public hotel detail page.
   */
  async findBySlug(slug: string): Promise<Hotel> {
    const hotel = await this.hotelRepo.findOne({
      where: { slug, is_active: true },
    });
    if (!hotel) {
      throw new NotFoundException('Hotel not found or inactive');
    }
    return hotel;
  }

  /**
   * Find hotel by QR token — this is what customers hit when scanning the QR code.
   */
  async findByQrToken(qrToken: string): Promise<Hotel> {
    const hotel = await this.hotelRepo.findOne({
      where: { qr_token: qrToken, is_active: true },
    });
    if (!hotel) {
      throw new NotFoundException('Hotel not found or inactive');
    }
    return hotel;
  }

  async update(id: number, dto: UpdateHotelDto): Promise<Hotel> {
    const hotel = await this.findOne(id);

    if (dto.name && dto.name !== hotel.name) {
      const newSlug = this.generateSlug(dto.name);
      const existing = await this.hotelRepo.findOne({
        where: { slug: newSlug },
      });
      if (existing && existing.id !== hotel.id) {
        throw new ConflictException(
          'A hotel with a similar name already exists',
        );
      }
      hotel.slug = newSlug;
      hotel.name = dto.name;
    }

    if (dto.phone !== undefined) hotel.phone = dto.phone;
    if (dto.email !== undefined) hotel.email = dto.email;
    if (dto.address !== undefined) hotel.address = dto.address;
    if (dto.description !== undefined) hotel.description = dto.description;
    if (dto.logo_url !== undefined) hotel.logo_url = dto.logo_url;
    if (dto.banner_url !== undefined) hotel.banner_url = dto.banner_url;
    if (dto.gallery !== undefined) hotel.gallery = dto.gallery;
    if (dto.is_active !== undefined) hotel.is_active = dto.is_active;

    return this.hotelRepo.save(hotel);
  }

  /**
   * Regenerate QR token for a hotel (invalidates old QR codes).
   */
  async regenerateQrToken(id: number): Promise<Hotel> {
    const hotel = await this.findOne(id);
    hotel.qr_token = randomUUID();
    return this.hotelRepo.save(hotel);
  }

  /**
   * Soft-delete a hotel by marking it inactive. The record is preserved so
   * existing chat history and foreign-key references stay intact.
   */
  async softDelete(id: number): Promise<void> {
    const hotel = await this.findOne(id);
    hotel.is_active = false;
    await this.hotelRepo.save(hotel);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-');
  }
}
