import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity.js';
import {
  FoodOrder,
  FoodOrderItem,
  type FoodOrderStatus,
} from './entities/food-order.entity.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';
import { CreateFoodOrderDto } from './dto/create-food-order.dto.js';
import { UpdateFoodOrderStatusDto } from './dto/update-food-order-status.dto.js';

export interface MenuItemView {
  id: number;
  hotel_id: number;
  category: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number;
  image_url: string | null;
  sort_order: number;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FoodOrderItemView {
  id: number;
  menu_item_id: number | null;
  item_name: string;
  category: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface FoodOrderView {
  id: number;
  hotel_id: number;
  service_id: number | null;
  room_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  status: FoodOrderStatus;
  total_amount: number;
  rejected_reason: string | null;
  items: FoodOrderItemView[];
  created_at: Date;
  updated_at: Date;
}

export interface FoodOrderStats {
  total_orders: number;
  pending_orders: number;
  accepted_orders: number;
  rejected_orders: number;
  completed_orders: number;
  total_revenue: number;
  revenue_today: number;
  orders_today: number;
}

@Injectable()
export class FoodOrderService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuRepo: Repository<MenuItem>,
    @InjectRepository(FoodOrder)
    private readonly orderRepo: Repository<FoodOrder>,
    @InjectRepository(FoodOrderItem)
    private readonly orderItemRepo: Repository<FoodOrderItem>,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Menu — public
  // -------------------------------------------------------------------------

  async getPublicMenu(hotelId: number, lang?: string): Promise<MenuItemView[]> {
    const items = await this.menuRepo.find({
      where: {
        hotel_id: hotelId,
        is_available: true,
        deleted_at: IsNull(),
      },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return items.map((item) => this.toMenuView(item, lang));
  }

  // -------------------------------------------------------------------------
  // Menu — admin
  // -------------------------------------------------------------------------

  async getMenuForAdmin(hotelId: number): Promise<MenuItemView[]> {
    const items = await this.menuRepo.find({
      where: { hotel_id: hotelId, deleted_at: IsNull() },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return items.map((item) => this.toMenuView(item));
  }

  async createMenuItem(dto: CreateMenuItemDto): Promise<MenuItemView> {
    const item = this.menuRepo.create({
      hotel_id: dto.hotel_id,
      category: dto.category ?? 'food',
      name: dto.name,
      name_en: dto.name_en ?? null,
      description: dto.description ?? null,
      description_en: dto.description_en ?? null,
      price: String(dto.price),
      image_url: dto.image_url ?? null,
      sort_order: dto.sort_order ?? 0,
      is_available: dto.is_available ?? true,
    });
    const saved = await this.menuRepo.save(item);
    return this.toMenuView(saved);
  }

  async updateMenuItem(
    id: number,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItemView> {
    const item = await this.findMenuItem(id);
    if (dto.category !== undefined) item.category = dto.category;
    if (dto.name !== undefined) item.name = dto.name;
    if (dto.name_en !== undefined) item.name_en = dto.name_en;
    if (dto.description !== undefined) item.description = dto.description;
    if (dto.description_en !== undefined)
      item.description_en = dto.description_en;
    if (dto.price !== undefined) item.price = String(dto.price);
    if (dto.image_url !== undefined) item.image_url = dto.image_url;
    if (dto.sort_order !== undefined) item.sort_order = dto.sort_order;
    if (dto.is_available !== undefined) item.is_available = dto.is_available;
    const saved = await this.menuRepo.save(item);
    return this.toMenuView(saved);
  }

  async deleteMenuItem(id: number): Promise<void> {
    const item = await this.findMenuItem(id);
    item.deleted_at = new Date();
    item.is_available = false;
    await this.menuRepo.save(item);
  }

  // -------------------------------------------------------------------------
  // Orders — guest
  // -------------------------------------------------------------------------

  async createOrder(dto: CreateFoodOrderDto): Promise<FoodOrderView> {
    const menuIds = [...new Set(dto.items.map((i) => i.menu_item_id))];
    const menuItems = await this.menuRepo.find({
      where: {
        id: In(menuIds),
        hotel_id: dto.hotel_id,
        is_available: true,
        deleted_at: IsNull(),
      },
    });

    if (menuItems.length !== menuIds.length) {
      throw new BadRequestException(
        'Một hoặc nhiều món không còn khả dụng. Vui lòng tải lại menu.',
      );
    }

    const menuById = new Map(menuItems.map((m) => [Number(m.id), m]));
    let total = 0;
    const lineEntities: Partial<FoodOrderItem>[] = [];

    for (const line of dto.items) {
      const menu = menuById.get(line.menu_item_id);
      if (!menu) {
        throw new BadRequestException(`Món #${line.menu_item_id} không hợp lệ`);
      }
      const unitPrice = Number(menu.price);
      total += unitPrice * line.quantity;
      lineEntities.push({
        menu_item_id: menu.id,
        item_name: menu.name,
        category: menu.category,
        unit_price: String(unitPrice),
        quantity: line.quantity,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(FoodOrder, {
        hotel_id: dto.hotel_id,
        service_id: dto.service_id ?? null,
        room_number: dto.room_number ?? null,
        customer_name: dto.customer_name ?? null,
        customer_phone: dto.customer_phone ?? null,
        note: dto.note ?? null,
        status: 'PENDING',
        total_amount: String(total),
      });
      const savedOrder = await manager.save(order);

      const items = lineEntities.map((line) =>
        manager.create(FoodOrderItem, {
          ...line,
          order_id: savedOrder.id,
        }),
      );
      savedOrder.items = await manager.save(items);

      return this.toOrderView(savedOrder);
    });
  }

  // -------------------------------------------------------------------------
  // Orders — admin
  // -------------------------------------------------------------------------

  async getOrdersForAdmin(
    hotelId: number,
    status?: FoodOrderStatus,
  ): Promise<FoodOrderView[]> {
    const where: Record<string, unknown> = { hotel_id: hotelId };
    if (status) where.status = status;

    const orders = await this.orderRepo.find({
      where,
      order: { created_at: 'DESC' },
      relations: ['items'],
    });
    return orders.map((o) => this.toOrderView(o));
  }

  async getOrder(id: number): Promise<FoodOrderView> {
    const order = await this.findOrder(id);
    return this.toOrderView(order);
  }

  async updateOrderStatus(
    id: number,
    dto: UpdateFoodOrderStatusDto,
  ): Promise<FoodOrderView> {
    const order = await this.findOrder(id);

    if (dto.status === 'REJECTED' && !dto.rejected_reason?.trim()) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối đơn hàng');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng đã kết thúc, không thể thay đổi');
    }

    order.status = dto.status;
    if (dto.status === 'REJECTED') {
      order.rejected_reason = dto.rejected_reason?.trim() ?? null;
    } else if (dto.status === 'ACCEPTED') {
      order.rejected_reason = null;
    }

    const saved = await this.orderRepo.save(order);
    return this.toOrderView(saved);
  }

  async getStats(hotelId: number): Promise<FoodOrderStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [counts, revenue, today] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('o.hotel_id = :hotelId', { hotelId })
        .groupBy('o.status')
        .getRawMany<{ status: FoodOrderStatus; count: string }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select(
          `COALESCE(SUM(CASE WHEN o.status IN ('ACCEPTED', 'COMPLETED') THEN o.total_amount ELSE 0 END), 0)`,
          'total',
        )
        .where('o.hotel_id = :hotelId', { hotelId })
        .getRawOne<{ total: string }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('COUNT(*)', 'orders')
        .addSelect(
          `COALESCE(SUM(CASE WHEN o.status IN ('ACCEPTED', 'COMPLETED') THEN o.total_amount ELSE 0 END), 0)`,
          'revenue',
        )
        .where('o.hotel_id = :hotelId', { hotelId })
        .andWhere('o.created_at >= :todayStart', { todayStart })
        .getRawOne<{ orders: string; revenue: string }>(),
    ]);

    const byStatus = new Map(counts.map((c) => [c.status, Number(c.count)]));
    const totalOrders = counts.reduce((sum, c) => sum + Number(c.count), 0);

    return {
      total_orders: totalOrders,
      pending_orders: byStatus.get('PENDING') ?? 0,
      accepted_orders: byStatus.get('ACCEPTED') ?? 0,
      rejected_orders: byStatus.get('REJECTED') ?? 0,
      completed_orders: byStatus.get('COMPLETED') ?? 0,
      total_revenue: Number(revenue?.total ?? 0),
      revenue_today: Number(today?.revenue ?? 0),
      orders_today: Number(today?.orders ?? 0),
    };
  }

  async countPending(hotelId: number): Promise<number> {
    return this.orderRepo.count({
      where: { hotel_id: hotelId, status: 'PENDING' },
    });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  async findMenuItem(id: number): Promise<MenuItem> {
    const item = await this.menuRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!item) throw new NotFoundException(`Menu item #${id} not found`);
    return item;
  }

  private async findOrder(id: number): Promise<FoodOrder> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException(`Order #${id} not found`);
    return order;
  }

  private toMenuView(item: MenuItem, lang?: string): MenuItemView {
    const useEn = lang === 'en' && item.name_en;
    return {
      id: Number(item.id),
      hotel_id: Number(item.hotel_id),
      category: item.category,
      name: useEn ? item.name_en! : item.name,
      name_en: item.name_en,
      description:
        lang === 'en' && item.description_en
          ? item.description_en
          : item.description,
      description_en: item.description_en,
      price: Number(item.price),
      image_url: item.image_url,
      sort_order: item.sort_order,
      is_available: item.is_available,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  }

  private toOrderView(order: FoodOrder): FoodOrderView {
    const items = (order.items ?? []).map((line) => ({
      id: Number(line.id),
      menu_item_id: line.menu_item_id ? Number(line.menu_item_id) : null,
      item_name: line.item_name,
      category: line.category,
      unit_price: Number(line.unit_price),
      quantity: line.quantity,
      line_total: Number(line.unit_price) * line.quantity,
    }));

    return {
      id: Number(order.id),
      hotel_id: Number(order.hotel_id),
      service_id: order.service_id ? Number(order.service_id) : null,
      room_number: order.room_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      note: order.note,
      status: order.status,
      total_amount: Number(order.total_amount),
      rejected_reason: order.rejected_reason,
      items,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }
}
