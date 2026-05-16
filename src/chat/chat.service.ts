import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  ChatMessage,
  ChatSessionStatus,
  CustomerSession,
  MessageSenderType,
  MessageStatus,
  MessageType,
  TranslationStatus,
} from './entities/chat.entity.js';
import { CreateSessionDto, SendMessageDto } from './dto/create-session.dto.js';
import {
  TranslationService,
  type TranslationResult,
} from './translation.service.js';

const STAFF_LANGUAGE = 'vi';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(CustomerSession)
    private readonly sessionRepo: Repository<CustomerSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly translationService: TranslationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  async createSession(dto: CreateSessionDto): Promise<CustomerSession> {
    const sessionData: Partial<CustomerSession> = {
      hotel_id: dto.hotel_id,
      customer_token: randomUUID(),
      customer_language: dto.customer_language,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone,
      customer_email: dto.customer_email,
      customer_country: dto.customer_country,
      room_number: dto.room_number,
      room_type: dto.room_type,
      check_in_date: dto.check_in_date,
      check_out_date: dto.check_out_date,
      guest_count: dto.guest_count,
      initial_request: dto.initial_request,
      status: ChatSessionStatus.OPEN,
    };
    const session = this.sessionRepo.create(sessionData);

    const saved = await this.sessionRepo.save(session);

    // Welcome system message in the customer's language (no translation needed).
    const welcomeText = this.getWelcomeMessage(dto.customer_language);
    const welcomeData: Partial<ChatMessage> = {
      hotel_id: dto.hotel_id,
      session_id: saved.id,
      sender_type: MessageSenderType.STAFF,
      message_type: MessageType.SYSTEM,
      source_language: dto.customer_language,
      target_language: dto.customer_language,
      original_message: welcomeText,
      translated_message: welcomeText,
      translation_status: TranslationStatus.SKIPPED,
      status: MessageStatus.DELIVERED,
    };
    const welcome = this.messageRepo.create(welcomeData);
    await this.messageRepo.save(welcome);

    // If the customer included an initial booking request, persist it as the
    // first guest message so it shows up in the chat history immediately.
    const initial = dto.initial_request?.trim();
    if (initial) {
      await this.sendCustomerMessage(saved.id, {
        message: initial,
        source_language: dto.customer_language,
      });
    }

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

  async getHotelSessions(hotelId: number): Promise<CustomerSession[]> {
    return this.sessionRepo
      .createQueryBuilder('s')
      .where('s.hotel_id = :hotelId', { hotelId })
      .orderBy('COALESCE(s.last_message_at, s.created_at)', 'DESC')
      .getMany();
  }

  async updateSessionStatus(
    sessionId: number,
    status: ChatSessionStatus,
  ): Promise<CustomerSession> {
    const session = await this.getSession(sessionId);
    session.status = status;
    if (status === ChatSessionStatus.CLOSED) {
      session.closed_at = new Date();
    }
    return this.sessionRepo.save(session);
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  async sendCustomerMessage(
    sessionId: number,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);

    const translation = await this.translationService.translate(
      dto.message ?? '',
      dto.source_language,
      STAFF_LANGUAGE,
    );

    const entity = this.messageRepo.create(
      this.buildMessage({
        hotelId: session.hotel_id,
        sessionId,
        sender: MessageSenderType.CUSTOMER,
        targetLanguage: STAFF_LANGUAGE,
        dto,
        translation,
      }),
    );
    const saved = await this.messageRepo.save(entity);

    session.last_message_at = new Date();
    session.unread_count = (session.unread_count ?? 0) + 1;
    await this.sessionRepo.save(session);

    return saved;
  }

  async sendStaffMessage(
    sessionId: number,
    userId: number,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);

    const translation = await this.translationService.translate(
      dto.message ?? '',
      dto.source_language,
      session.customer_language,
    );

    const entity = this.messageRepo.create(
      this.buildMessage({
        hotelId: session.hotel_id,
        sessionId,
        sender: MessageSenderType.STAFF,
        senderUserId: userId,
        targetLanguage: session.customer_language,
        dto,
        translation,
      }),
    );
    const saved = await this.messageRepo.save(entity);

    session.last_message_at = new Date();
    if (session.status === ChatSessionStatus.OPEN) {
      session.status = ChatSessionStatus.ASSIGNED;
      session.assigned_user_id = userId;
    }
    await this.sessionRepo.save(session);

    return saved;
  }

  async markMessagesRead(
    sessionId: number,
    by: 'customer' | 'staff',
  ): Promise<{ updated: number }> {
    // Customer reading -> mark STAFF messages as read.
    // Staff reading    -> mark CUSTOMER messages as read AND zero session unread.
    const senderType =
      by === 'customer' ? MessageSenderType.STAFF : MessageSenderType.CUSTOMER;

    const result = await this.messageRepo
      .createQueryBuilder()
      .update(ChatMessage)
      .set({
        is_read: true,
        read_at: () => 'NOW()',
        status: MessageStatus.READ,
      })
      .where('session_id = :sessionId', { sessionId })
      .andWhere('sender_type = :senderType', { senderType })
      .andWhere('is_read = FALSE')
      .execute();

    if (by === 'staff') {
      await this.sessionRepo.update(sessionId, { unread_count: 0 });
    }

    return { updated: result.affected ?? 0 };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds the persisted message payload — common between customer and staff
   * variants. Centralizes the translation-status / image / null-coalescing
   * decisions so the two senders share identical semantics.
   */
  private buildMessage(input: {
    hotelId: number;
    sessionId: number;
    sender: MessageSenderType;
    senderUserId?: number;
    targetLanguage: string;
    dto: SendMessageDto;
    translation: TranslationResult;
  }): Partial<ChatMessage> {
    const {
      hotelId,
      sessionId,
      sender,
      senderUserId,
      targetLanguage,
      dto,
      translation,
    } = input;

    const sameLang = dto.source_language === targetLanguage;
    const isImage = dto.message_type === 'IMAGE';

    let translationStatus: TranslationStatus;
    if (isImage || sameLang) {
      translationStatus = TranslationStatus.SKIPPED;
    } else if (translation.status === 'success') {
      translationStatus = TranslationStatus.TRANSLATED;
    } else {
      translationStatus = TranslationStatus.FAILED;
    }

    let translatedMessage: string | null;
    if (isImage) {
      translatedMessage = null;
    } else if (sameLang) {
      translatedMessage = dto.message ?? null;
    } else {
      translatedMessage = translation.text;
    }

    return {
      hotel_id: hotelId,
      session_id: sessionId,
      sender_type: sender,
      sender_user_id: senderUserId,
      message_type: isImage ? MessageType.IMAGE : MessageType.TEXT,
      source_language: dto.source_language,
      target_language: targetLanguage,
      original_message: dto.message ?? null,
      translated_message: translatedMessage,
      translation_status: translationStatus,
      translation_provider: translation.provider,
      translation_duration_ms: translation.durationMs,
      image_url: dto.image_url ?? null,
      status: MessageStatus.SENT,
      client_message_id: dto.client_message_id ?? null,
    };
  }

  private getWelcomeMessage(language: string): string {
    const messages: Record<string, string> = {
      vi: 'Xin chào! Cảm ơn quý khách đã liên hệ. Đội ngũ của chúng tôi sẽ phản hồi trong giây lát.',
      en: 'Hello! Thanks for reaching out. Our team will be with you shortly.',
      ja: 'こんにちは！お問い合わせいただきありがとうございます。担当者が間もなくご対応いたします。',
      zh: '您好！感谢您的留言，我们的团队稍后会与您联系。',
      ko: '안녕하세요! 문의해 주셔서 감사합니다. 곧 담당자가 답변드리겠습니다.',
      th: 'สวัสดีค่ะ ขอบคุณที่ติดต่อเรา ทีมงานจะตอบกลับในไม่ช้า',
    };
    return messages[language] || messages['en'];
  }
}
