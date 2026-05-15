import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  CustomerSession,
  ChatMessage,
  MessageSenderType,
  MessageType,
  ChatSessionStatus,
} from './entities/chat.entity.js';
import { CreateSessionDto, SendMessageDto } from './dto/create-session.dto.js';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(CustomerSession)
    private readonly sessionRepo: Repository<CustomerSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
  ) {}

  async createSession(dto: CreateSessionDto): Promise<CustomerSession> {
    const session = this.sessionRepo.create({
      hotel_id: dto.hotel_id,
      customer_token: randomUUID(),
      customer_language: dto.customer_language,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone,
      room_number: dto.room_number,
      status: ChatSessionStatus.OPEN,
    });

    const saved = await this.sessionRepo.save(session);

    // Create a system welcome message
    const welcomeMessage = this.messageRepo.create({
      hotel_id: dto.hotel_id,
      session_id: saved.id,
      sender_type: MessageSenderType.STAFF,
      message_type: MessageType.SYSTEM,
      source_language: dto.customer_language,
      original_message: this.getWelcomeMessage(dto.customer_language),
    });
    await this.messageRepo.save(welcomeMessage);

    return saved;
  }

  async getSession(sessionId: number): Promise<CustomerSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Session #${sessionId} not found`);
    }
    return session;
  }

  async getSessionByToken(customerToken: string): Promise<CustomerSession> {
    const session = await this.sessionRepo.findOne({
      where: { customer_token: customerToken },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async getMessages(sessionId: number): Promise<ChatMessage[]> {
    return this.messageRepo.find({
      where: { session_id: sessionId },
      order: { created_at: 'ASC' },
    });
  }

  async sendCustomerMessage(
    sessionId: number,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);

    const message = this.messageRepo.create({
      hotel_id: session.hotel_id,
      session_id: sessionId,
      sender_type: MessageSenderType.CUSTOMER,
      message_type: MessageType.TEXT,
      source_language: dto.source_language,
      original_message: dto.message,
    });

    const saved = await this.messageRepo.save(message);

    // Update session last_message_at
    session.last_message_at = new Date();
    await this.sessionRepo.save(session);

    return saved;
  }

  async sendStaffMessage(
    sessionId: number,
    userId: number,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);

    const message = this.messageRepo.create({
      hotel_id: session.hotel_id,
      session_id: sessionId,
      sender_type: MessageSenderType.STAFF,
      sender_user_id: userId,
      message_type: MessageType.TEXT,
      source_language: dto.source_language,
      original_message: dto.message,
    });

    const saved = await this.messageRepo.save(message);

    session.last_message_at = new Date();
    if (session.status === ChatSessionStatus.OPEN) {
      session.status = ChatSessionStatus.ASSIGNED;
      session.assigned_user_id = userId;
    }
    await this.sessionRepo.save(session);

    return saved;
  }

  async getHotelSessions(hotelId: number): Promise<CustomerSession[]> {
    return this.sessionRepo.find({
      where: { hotel_id: hotelId },
      order: { last_message_at: 'DESC' },
    });
  }

  private getWelcomeMessage(language: string): string {
    const messages: Record<string, string> = {
      vi: 'Xin chào! Chào mừng bạn đến với khách sạn. Tôi có thể giúp gì cho bạn?',
      en: 'Hello! Welcome to our hotel. How can I help you?',
      ja: 'こんにちは！ホテルへようこそ。何かお手伝いできることはありますか？',
      zh: '您好！欢迎来到我们的酒店。有什么可以帮助您的吗？',
      ko: '안녕하세요! 호텔에 오신 것을 환영합니다. 무엇을 도와드릴까요?',
    };
    return messages[language] || messages['en'];
  }
}
