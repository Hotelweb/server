import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const synchronize =
          configService.get<string>('DB_SYNCHRONIZE', 'true').toLowerCase() !==
          'false';

        const databaseUrl = configService.get<string>('DATABASE_URL');

        // If DATABASE_URL is provided (e.g. on Vercel with Render Postgres),
        // use it directly. Otherwise fall back to individual DB_* vars.
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/../**/*.entity{.ts,.js}'],
            synchronize,
            ssl: {
              rejectUnauthorized: false,
            },
          };
        }

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
