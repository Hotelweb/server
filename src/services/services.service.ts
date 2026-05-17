import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Service, ServiceTranslation } from './entities/service.entity.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { ServiceTranslationDto } from './dto/service-translation.dto.js';

/**
 * Public-facing shape returned to customers (and reused by the admin UI for
 * convenience). One translation is selected based on the requested language
 * with sensible fallbacks; the full translation set is included so the
 * frontend can switch language client-side without a round-trip.
 */
export interface ServiceView {
  id: number;
  hotel_id: number;
  icon_url: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  service_type: 'content' | 'food_order';
  title: string;
  description: string;
  language: string;
  translations: ServiceTranslation[];
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(ServiceTranslation)
    private readonly translationRepo: Repository<ServiceTranslation>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Public listing for guests: only active, non-deleted services.
   */
  async findByHotel(
    hotelId: number,
    language?: string,
  ): Promise<ServiceView[]> {
    const services = await this.serviceRepo.find({
      where: {
        hotel_id: hotelId,
        is_active: true,
        deleted_at: IsNull(),
      },
      order: { sort_order: 'ASC', id: 'ASC' },
      relations: ['translations'],
    });

    return services.map((s) => this.toView(s, language));
  }

  /**
   * Admin listing for the manage screen: includes inactive services so the
   * admin can re-enable them, but still excludes soft-deleted rows.
   */
  async findByHotelForAdmin(hotelId: number): Promise<ServiceView[]> {
    const services = await this.serviceRepo.find({
      where: { hotel_id: hotelId, deleted_at: IsNull() },
      order: { sort_order: 'ASC', id: 'ASC' },
      relations: ['translations'],
    });

    return services.map((s) => this.toView(s));
  }

  async findOne(id: number): Promise<Service> {
    const service = await this.serviceRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['translations'],
    });
    if (!service) {
      throw new NotFoundException(`Service #${id} not found`);
    }
    return service;
  }

  /**
   * Create a service together with its translations in a single transaction.
   * Translations are unique per `(service_id, language)`; we de-duplicate the
   * incoming list so the caller can't crash the insert with two `vi` entries.
   */
  async create(dto: CreateServiceDto): Promise<ServiceView> {
    const translations = this.dedupeTranslations(dto.translations);

    return this.dataSource.transaction(async (manager) => {
      const service = manager.create(Service, {
        hotel_id: dto.hotel_id,
        icon_url: dto.icon_url,
        image_url: dto.image_url,
        sort_order: dto.sort_order ?? 0,
        is_active: dto.is_active ?? true,
        service_type: dto.service_type ?? 'content',
      });
      const saved = await manager.save(service);

      const trEntities = translations.map((t) =>
        manager.create(ServiceTranslation, {
          service_id: saved.id,
          language: t.language,
          title: t.title,
          description: t.description,
        }),
      );
      const savedTranslations = await manager.save(trEntities);
      saved.translations = savedTranslations;

      return this.toView(saved);
    });
  }

  /**
   * Patch a service. If `translations` is included, we replace the full set
   * for that service (delete then re-insert) so admins can rename, drop, or
   * add a language without juggling diff logic.
   */
  async update(id: number, dto: UpdateServiceDto): Promise<ServiceView> {
    const existing = await this.findOne(id);

    return this.dataSource.transaction(async (manager) => {
      if (dto.icon_url !== undefined) existing.icon_url = dto.icon_url;
      if (dto.image_url !== undefined) existing.image_url = dto.image_url;
      if (dto.sort_order !== undefined) existing.sort_order = dto.sort_order;
      if (dto.is_active !== undefined) existing.is_active = dto.is_active;
      if (dto.service_type !== undefined)
        existing.service_type = dto.service_type;

      await manager.save(Service, existing);

      if (dto.translations) {
        const translations = this.dedupeTranslations(dto.translations);
        await manager.delete(ServiceTranslation, { service_id: existing.id });

        const trEntities = translations.map((t) =>
          manager.create(ServiceTranslation, {
            service_id: existing.id,
            language: t.language,
            title: t.title,
            description: t.description,
          }),
        );
        existing.translations = await manager.save(trEntities);
      } else {
        // Reload translations so the response always reflects the current state.
        existing.translations = await manager.find(ServiceTranslation, {
          where: { service_id: existing.id },
        });
      }

      return this.toView(existing);
    });
  }

  /**
   * Soft-delete: mark `deleted_at` and turn the service off so it disappears
   * from public listings while preserving the row for analytics / audit.
   */
  async softDelete(id: number): Promise<void> {
    const service = await this.findOne(id);
    service.deleted_at = new Date();
    service.is_active = false;
    await this.serviceRepo.save(service);
  }

  // ----------------------------------------------------------------------
  // Internals
  // ----------------------------------------------------------------------

  /**
   * Pick the best translation for the requested language, with the same
   * fallback rule used in the original implementation: requested → en → first.
   */
  private toView(service: Service, language?: string): ServiceView {
    const translations = service.translations ?? [];
    const translation = language
      ? translations.find((t) => t.language === language) ||
        translations.find((t) => t.language === 'en') ||
        translations[0]
      : translations.find((t) => t.language === 'en') || translations[0];

    return {
      id: Number(service.id),
      hotel_id: Number(service.hotel_id),
      icon_url: service.icon_url ?? null,
      image_url: service.image_url ?? null,
      sort_order: service.sort_order,
      is_active: service.is_active,
      service_type: service.service_type ?? 'content',
      title: translation?.title ?? '',
      description: translation?.description ?? '',
      language: translation?.language ?? '',
      translations,
      created_at: service.created_at,
      updated_at: service.updated_at,
    };
  }

  /**
   * Last write wins per language so admins editing in a single form can't
   * accidentally insert duplicate keys.
   */
  private dedupeTranslations(
    list: ServiceTranslationDto[],
  ): ServiceTranslationDto[] {
    const map = new Map<string, ServiceTranslationDto>();
    for (const t of list) {
      map.set(t.language, t);
    }
    return Array.from(map.values());
  }
}
