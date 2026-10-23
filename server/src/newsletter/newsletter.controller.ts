import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { QuerySubscribersDto } from './dto/query-subscribers.dto';
import { UpdateSubscriberStatusDto } from './dto/update-subscriber-status.dto';
import { AdminJwtAuthGuard, RolesGuard } from '../auth/roles.guard';

@Controller('api')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('newsletter/subscribe')
  async subscribe(@Body(new ValidationPipe({ transform: true })) dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto.email, dto.source);
  }

  @Get('admin/newsletter-subscribers/export')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  async exportSubscribers(
    @Query(new ValidationPipe({ transform: true })) query: QuerySubscribersDto,
  ) {
    return this.newsletterService.exportSubscribers(query);
  }

  @Get('admin/newsletter-subscribers')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  async getAdminSubscribers(
    @Query(new ValidationPipe({ transform: true })) query: QuerySubscribersDto,
  ) {
    return this.newsletterService.getAdminSubscribers(query);
  }

  @Patch('admin/newsletter-subscribers/:id/status')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) dto: UpdateSubscriberStatusDto,
  ) {
    return this.newsletterService.updateStatus(id, dto.status);
  }
}
