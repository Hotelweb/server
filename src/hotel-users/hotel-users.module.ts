import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelUser } from './entities/hotel-user.entity.js';
import { HotelUsersService } from './hotel-users.service.js';
import { HotelUsersController } from './hotel-users.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([HotelUser])],
  controllers: [HotelUsersController],
  providers: [HotelUsersService],
  exports: [HotelUsersService],
})
export class HotelUsersModule {}
