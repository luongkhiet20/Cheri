import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { QuerySubscribersDto } from './dto/query-subscribers.dto';
import { AdminJwtAuthGuard, RolesGuard } from '../auth/roles.guard';

@Controller('api')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('newsletter/subscribe')
  async subscribe(@Body(new ValidationPipe({ transform: true })) dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto.email, dto.source);
  }

  @Get('admin/newsletter-subscribers')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  async getAdminSubscribers(
    @Query(new ValidationPipe({ transform: true })) query: QuerySubscribersDto,
  ) {
    return this.newsletterService.getAdminSubscribers(query);
  }
}
