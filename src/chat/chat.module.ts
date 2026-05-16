import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CustomerSession, ChatMessage } from './entities/chat.entity.js';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { TranslationService } from './translation.service.js';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([CustomerSession, ChatMessage]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, TranslationService],
  exports: [ChatService, TranslationService],
})
export class ChatModule {}
