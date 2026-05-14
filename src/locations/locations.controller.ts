import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { LocationsService } from './locations.service.js';
import { CreateLocationDto } from './dto/create-location.dto.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@Controller('api/locations')
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Get()
    findAll() {
        return this.locationsService.findAll();
    }

    @Get('admin/dashboard')
    @UseGuards(JwtAuthGuard)
    getAllWithUnreadCount() {
        return this.locationsService.getAllWithUnreadCount();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.locationsService.findOne(id);
    }

    @Get('slug/:slug')
    findBySlug(@Param('slug') slug: string) {
        return this.locationsService.findBySlug(slug);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(@Body() createLocationDto: CreateLocationDto) {
        return this.locationsService.create(createLocationDto);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    update(
        @Param('id') id: string,
        @Body() updateLocationDto: UpdateLocationDto,
    ) {
        return this.locationsService.update(id, updateLocationDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    delete(@Param('id') id: string) {
        return this.locationsService.delete(id);
    }
}
