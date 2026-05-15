import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Hotel } from '../../hotels/entities/hotel.entity.js';
import { HotelUser } from '../../hotel-users/entities/hotel-user.entity.js';

export enum ChatSessionStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  CLOSED = 'CLOSED',
}

export enum MessageSenderType {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM',
  ORDER = 'ORDER',
}

export enum LanguageCode {
  VI = 'vi',
  EN = 'en',
  JA = 'ja',
  ZH = 'zh',
  KO = 'ko',
}

@Entity('customer_sessions')
export class CustomerSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  hotel_id: number;

  @Column({ type: 'uuid' })
  customer_token: string;

  @Column({ type: 'bigint', nullable: true })
  assigned_user_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customer_name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customer_phone: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  room_number: string;

  @Column({
    type: 'enum',
    enum: LanguageCode,
    enumName: 'language_code',
  })
  customer_language: string;

  @Column({
    type: 'enum',
    enum: ChatSessionStatus,
    enumName: 'chat_session_status',
    default: ChatSessionStatus.OPEN,
  })
  status: ChatSessionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotel_id' })
  hotel: Hotel;

  @ManyToOne(() => HotelUser, { nullable: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assigned_user: HotelUser;
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  hotel_id: number;

  @Column({ type: 'bigint' })
  session_id: number;

  @Column({
    type: 'enum',
    enum: MessageSenderType,
    enumName: 'message_sender_type',
  })
  sender_type: MessageSenderType;

  @Column({ type: 'bigint', nullable: true })
  sender_user_id: number;

  @Column({
    type: 'enum',
    enum: MessageType,
    enumName: 'message_type',
    default: MessageType.TEXT,
  })
  message_type: MessageType;

  @Column({
    type: 'enum',
    enum: LanguageCode,
    enumName: 'language_code',
  })
  source_language: string;

  @Column({ type: 'text', nullable: true })
  original_message: string;

  @Column({ type: 'text', nullable: true })
  translated_message: string;

  @Column({ type: 'text', nullable: true })
  image_url: string;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => CustomerSession)
  @JoinColumn({ name: 'session_id' })
  session: CustomerSession;
}
