import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // synchronize is ON by default for first-time scaffolding (matches what
        // the seed script expects). Once the schema exists and stabilizes,
        // set DB_SYNCHRONIZE=false in .env and rely on the migration runner
        // (`pnpm run migrate`) for any changes — TypeORM's automatic enum
        // migrations are unsafe (drop-type cascades fail on dependent columns).
        const synchronize =
          configService.get<string>('DB_SYNCHRONIZE', 'true').toLowerCase() !==
          'false';

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'a25_db'),
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
