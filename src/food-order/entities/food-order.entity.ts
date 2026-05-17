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
import { Service } from '../../services/entities/service.entity.js';
import type { MenuCategory } from './menu-item.entity.js';

export type FoodOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

@Entity('food_orders')
export class FoodOrder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  hotel_id: number;

  @Column({ type: 'bigint', nullable: true })
  service_id: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  room_number: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  customer_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  customer_phone: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'],
    enumName: 'food_order_status',
    default: 'PENDING',
  })
  status: FoodOrderStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_amount: string;

  @Column({ type: 'text', nullable: true })
  rejected_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotel_id' })
  hotel: Hotel;

  @ManyToOne(() => Service, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  @OneToMany(() => FoodOrderItem, (item) => item.order, { eager: true })
  items: FoodOrderItem[];
}

@Entity('food_order_items')
export class FoodOrderItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  order_id: number;

  @Column({ type: 'bigint', nullable: true })
  menu_item_id: number | null;

  @Column({ type: 'varchar', length: 200 })
  item_name: string;

  @Column({
    type: 'enum',
    enum: ['food', 'drink'],
    enumName: 'menu_category',
    default: 'food',
  })
  category: MenuCategory;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unit_price: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @ManyToOne(() => FoodOrder, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: FoodOrder;
}
