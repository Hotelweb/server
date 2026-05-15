import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HotelsModule } from './hotels/hotels.module';
import { HotelUsersModule } from './hotel-users/hotel-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HotelsModule,
    HotelUsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
