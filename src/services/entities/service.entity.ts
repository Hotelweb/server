import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Hotel } from '../../hotels/entities/hotel.entity.js';
import { LanguageCode } from '../../chat/entities/chat.entity.js';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  hotel_id: number;

  @Column({ type: 'text', nullable: true })
  icon_url: string;

  @Column({ type: 'text', nullable: true })
  image_url: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({
    type: 'enum',
    enum: ['content', 'food_order'],
    enumName: 'service_type',
    default: 'content',
  })
  service_type: 'content' | 'food_order';

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotel_id' })
  hotel: Hotel;

  @OneToMany(() => ServiceTranslation, (t) => t.service, { eager: true })
  translations: ServiceTranslation[];
}

@Entity('service_translations')
export class ServiceTranslation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  service_id: number;

  @Column({
    type: 'enum',
    enum: LanguageCode,
    enumName: 'language_code',
  })
  language: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Service, (s) => s.translations)
  @JoinColumn({ name: 'service_id' })
  service: Service;
}
