import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HotelsModule } from './hotels/hotels.module';
import { HotelUsersModule } from './hotel-users/hotel-users.module';
import { ServicesModule } from './services/services.module';
import { ChatModule } from './chat/chat.module';
import { FoodOrderModule } from './food-order/food-order.module';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load `.env.local` first so it overrides anything in `.env`. Mirrors
      // the convention used by Vite / Next.js — `.env.local` is gitignored
      // and holds developer-specific secrets (Cloudinary, translation keys,
      // …) while `.env` keeps shared defaults that are safe to commit.
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    AuthModule,
    UploadsModule,
    HotelsModule,
    HotelUsersModule,
    ServicesModule,
    ChatModule,
    FoodOrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
