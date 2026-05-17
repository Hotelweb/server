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

export type MenuCategory = 'food' | 'drink';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  hotel_id: number;

  @Column({
    type: 'enum',
    enum: ['food', 'drink'],
    enumName: 'menu_category',
    default: 'food',
  })
  category: MenuCategory;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name_en: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  description_en: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'text', nullable: true })
  image_url: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_available: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotel_id' })
  hotel: Hotel;
}
