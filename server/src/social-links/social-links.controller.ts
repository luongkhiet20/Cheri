import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { SocialLinksService } from './social-links.service';
import { UpdateSocialLinkDto, ToggleSocialLinkDto } from './dto/update-social-link.dto';
import { AdminJwtAuthGuard, RolesGuard } from '../auth/roles.guard';

@Controller('api')
export class SocialLinksController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  /**
   * Public API: Lấy danh sách mạng xã hội cho Footer và người dùng
   */
  @Get('social-links')
  async getPublicSocialLinks() {
    return this.socialLinksService.getAll();
  }

  /**
   * Admin API: Lấy danh sách mạng xã hội cho trang Admin
   */
  @Get('admin/social-links')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  async getAdminSocialLinks() {
    return this.socialLinksService.getAll();
  }

  /**
   * Admin API: Cập nhật đường dẫn URL cho một nền tảng
   */
  @Put('admin/social-links/:platform')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  async updateSocialLinkUrl(
    @Param('platform') platform: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: UpdateSocialLinkDto,
  ) {
    return this.socialLinksService.updateUrl(platform, dto.url);
  }

  /**
   * Admin API: Bật/Tắt trạng thái hiển thị cho một nền tảng
   */
  @Patch('admin/social-links/:platform/status')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  async toggleSocialLinkStatus(
    @Param('platform') platform: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: ToggleSocialLinkDto,
  ) {
    return this.socialLinksService.toggleStatus(platform, dto?.isActive);
  }
}

