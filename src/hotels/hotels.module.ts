import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hotel } from './entities/hotel.entity.js';
import { HotelUser } from '../hotel-users/entities/hotel-user.entity.js';
import { HotelsService } from './hotels.service.js';
import { HotelsController } from './hotels.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Hotel, HotelUser])],
  controllers: [HotelsController],
  providers: [HotelsService],
  exports: [HotelsService],
})
export class HotelsModule {}
