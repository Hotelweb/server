import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemAdmin } from '../system-admins/entities/system-admin.entity.js';
import { HotelUser } from '../hotel-users/entities/hotel-user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { TokenService } from './token.service.js';

/**
 * Global so other modules can `@UseGuards(JwtAuthGuard)` without re-importing.
 * TokenService and JwtAuthGuard are exported because controllers in other
 * modules (hotels, hotel-users, …) reuse them to protect their endpoints.
 */
@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([SystemAdmin, HotelUser])],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAuthGuard],
  exports: [TokenService, JwtAuthGuard, AuthService],
})
export class AuthModule {}
