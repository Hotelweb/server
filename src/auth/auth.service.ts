import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { SystemAdmin } from '../system-admins/entities/system-admin.entity.js';
import { HotelUser } from '../hotel-users/entities/hotel-user.entity.js';
import { LoginDto } from './dto/login.dto.js';
import { TokenPayload, TokenService } from './token.service.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
  full_name: string;
  scope: 'system' | 'hotel';
  hotel_id?: number;
  avatar_url?: string | null;
  is_active: boolean;
}

export interface LoginResult {
  access_token: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(SystemAdmin)
    private readonly systemAdminRepo: Repository<SystemAdmin>,
    @InjectRepository(HotelUser)
    private readonly hotelUserRepo: Repository<HotelUser>,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Verify credentials and issue an access token. The caller can pin the
   * lookup to a specific scope; otherwise we try system first, then hotel.
   *
   * Always returns a uniform `Invalid email or password` error so we don't
   * disclose whether an email exists.
   */
  async login(dto: LoginDto): Promise<LoginResult> {
    if (!dto.scope || dto.scope === 'system') {
      const result = await this.tryLoginSystem(dto.email, dto.password);
      if (result) return result;
      if (dto.scope === 'system') throw invalidCreds();
    }

    if (!dto.scope || dto.scope === 'hotel') {
      const result = await this.tryLoginHotel(dto.email, dto.password);
      if (result) return result;
    }

    throw invalidCreds();
  }

  /**
   * Resolve the latest profile snapshot for a verified token. Used by
   * `GET /auth/me` so the frontend can refresh the cached user without
   * trusting only the JWT (e.g. picks up a name change, deactivation, …).
   */
  async getProfile(payload: TokenPayload): Promise<AuthenticatedUser> {
    if (payload.scope === 'system') {
      const admin = await this.systemAdminRepo.findOne({
        where: { id: payload.sub, is_active: true },
      });
      if (!admin) throw new NotFoundException('User not found or deactivated');
      return {
        id: Number(admin.id),
        email: admin.email,
        full_name: admin.full_name,
        scope: 'system',
        is_active: admin.is_active,
      };
    }

    const user = await this.hotelUserRepo.findOne({
      where: { id: payload.sub, is_active: true, deleted_at: IsNull() },
    });
    if (!user) throw new NotFoundException('User not found or deactivated');
    return {
      id: Number(user.id),
      email: user.email,
      full_name: user.full_name,
      scope: 'hotel',
      hotel_id: Number(user.hotel_id),
      avatar_url: user.avatar_url,
      is_active: user.is_active,
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async tryLoginSystem(
    email: string,
    password: string,
  ): Promise<LoginResult | null> {
    // password_hash has `select: false` on the entity, so we have to ask for it
    // explicitly here.
    const admin = await this.systemAdminRepo
      .createQueryBuilder('a')
      .addSelect('a.password_hash')
      .where('a.email = :email AND a.is_active = TRUE', { email })
      .getOne();
    if (!admin) return null;

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return null;

    const user: AuthenticatedUser = {
      id: Number(admin.id),
      email: admin.email,
      full_name: admin.full_name,
      scope: 'system',
      is_active: admin.is_active,
    };
    const access_token = this.tokenService.sign({
      sub: user.id,
      scope: 'system',
      email: user.email,
    });
    return { access_token, user };
  }

  private async tryLoginHotel(
    email: string,
    password: string,
  ): Promise<LoginResult | null> {
    const user = await this.hotelUserRepo
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where(
        'u.email = :email AND u.is_active = TRUE AND u.deleted_at IS NULL',
        { email },
      )
      .getOne();
    if (!user) return null;

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return null;

    const authUser: AuthenticatedUser = {
      id: Number(user.id),
      email: user.email,
      full_name: user.full_name,
      scope: 'hotel',
      hotel_id: Number(user.hotel_id),
      avatar_url: user.avatar_url,
      is_active: user.is_active,
    };
    const access_token = this.tokenService.sign({
      sub: authUser.id,
      scope: 'hotel',
      email: authUser.email,
      hotel_id: authUser.hotel_id,
    });
    return { access_token, user: authUser };
  }
}

function invalidCreds() {
  return new UnauthorizedException('Invalid email or password');
}
