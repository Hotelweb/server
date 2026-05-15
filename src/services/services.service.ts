import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Service } from './entities/service.entity.js';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  async findByHotel(hotelId: number, language?: string): Promise<any[]> {
    const services = await this.serviceRepo.find({
      where: {
        hotel_id: hotelId,
        is_active: true,
        deleted_at: IsNull(),
      },
      order: { sort_order: 'ASC' },
      relations: ['translations'],
    });

    return services.map((service) => {
      const translation = language
        ? service.translations.find((t) => t.language === language) ||
          service.translations.find((t) => t.language === 'en') ||
          service.translations[0]
        : service.translations.find((t) => t.language === 'en') ||
          service.translations[0];

      return {
        id: service.id,
        icon_url: service.icon_url,
        image_url: service.image_url,
        sort_order: service.sort_order,
        title: translation?.title || '',
        description: translation?.description || '',
        language: translation?.language || '',
        translations: service.translations,
      };
    });
  }
}
