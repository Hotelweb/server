import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { HotelUser } from './entities/hotel-user.entity.js';
import { CreateHotelUserDto } from './dto/create-hotel-user.dto.js';
import { UpdateHotelUserDto } from './dto/update-hotel-user.dto.js';

@Injectable()
export class HotelUsersService {
  constructor(
    @InjectRepository(HotelUser)
    private readonly hotelUserRepo: Repository<HotelUser>,
  ) {}

  async create(dto: CreateHotelUserDto): Promise<HotelUser> {
    // Check if email already exists for this hotel
    const existing = await this.hotelUserRepo.findOne({
      where: { hotel_id: dto.hotel_id, email: dto.email, deleted_at: IsNull() },
    });

    if (existing) {
      throw new ConflictException(
        'A user with this email already exists for this hotel',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.hotelUserRepo.create({
      hotel_id: dto.hotel_id,
      email: dto.email,
      password_hash: passwordHash,
      full_name: dto.full_name,
      avatar_url: dto.avatar_url,
    });

    return this.hotelUserRepo.save(user);
  }

  async findAllByHotel(hotelId: number): Promise<HotelUser[]> {
    return this.hotelUserRepo.find({
      where: { hotel_id: hotelId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<HotelUser> {
    const user = await this.hotelUserRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });

    if (!user) {
      throw new NotFoundException(`Hotel user #${id} not found`);
    }

    return user;
  }

  async update(id: number, dto: UpdateHotelUserDto): Promise<HotelUser> {
    const user = await this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.hotelUserRepo.findOne({
        where: {
          hotel_id: user.hotel_id,
          email: dto.email,
          deleted_at: IsNull(),
        },
      });

      if (existing) {
        throw new ConflictException(
          'A user with this email already exists for this hotel',
        );
      }

      user.email = dto.email;
    }

    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.full_name !== undefined) user.full_name = dto.full_name;
    if (dto.avatar_url !== undefined) user.avatar_url = dto.avatar_url;
    if (dto.is_active !== undefined) user.is_active = dto.is_active;

    return this.hotelUserRepo.save(user);
  }

  async softDelete(id: number): Promise<void> {
    const user = await this.findOne(id);
    user.deleted_at = new Date();
    user.is_active = false;
    await this.hotelUserRepo.save(user);
  }
}
