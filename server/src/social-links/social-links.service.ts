import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocialPlatformEnum, SocialPlatformType } from './schemas/social-link.schema';

@Injectable()
export class SocialLinksService implements OnModuleInit {
  private readonly logger = new Logger(SocialLinksService.name);

  constructor(
    @InjectModel('SocialLink')
    private readonly socialLinkModel: Model<any>,
  ) {}

  async onModuleInit() {
    await this.seedInitialLinks();
  }

  /**
   * Khởi tạo 3 nền tảng ban đầu nếu chưa có trong collection social_links.
   * Sử dụng cơ chế $setOnInsert để không ghi đè dữ liệu nếu đã có.
   */
  async seedInitialLinks() {
    try {
      const now = new Date();
      for (const platform of SocialPlatformEnum) {
        await this.socialLinkModel.updateOne(
          { platform },
          {
            $setOnInsert: {
              platform,
              url: '',
              isActive: false,
              createdAt: now,
            },
            $set: {
              updatedAt: now,
            },
          },
          { upsert: true },
        );
      }
      this.logger.log('Khởi tạo / kiểm tra 3 nền tảng mạng xã hội thành công (social_links)');
    } catch (err) {
      this.logger.error('Lỗi khi khởi tạo nền tảng mạng xã hội:', err);
    }
  }

  /**
   * Lấy danh sách 3 nền tảng mạng xã hội
   */
  async getAll() {
    const links = await this.socialLinkModel
      .find({})
      .sort({ platform: 1 })
      .lean();

    // Đảm bảo luôn trả về đủ 3 platform theo thứ tự TIKTOK, INSTAGRAM, FACEBOOK
    const orderMap: Record<string, number> = {
      TIKTOK: 1,
      INSTAGRAM: 2,
      FACEBOOK: 3,
    };

    const sorted = (links || []).sort(
      (a: any, b: any) => (orderMap[a.platform] || 99) - (orderMap[b.platform] || 99),
    );

    return {
      success: true,
      data: sorted.map((item: any) => ({
        id: item._id,
        platform: item.platform,
        url: item.url || '',
        isActive: Boolean(item.isActive),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  /**
   * Kiểm tra tính hợp lệ của URL đối với từng nền tảng
   */
  validatePlatformUrl(platform: SocialPlatformType, rawUrl: string): string {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Đường dẫn URL không được để trống');
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      throw new BadRequestException('Đường dẫn URL phải bắt đầu bằng http:// hoặc https://');
    }

    try {
      const parsed = new URL(trimmed);
      const hostname = parsed.hostname.toLowerCase();

      if (platform === 'TIKTOK') {
        if (!hostname.includes('tiktok.com')) {
          throw new BadRequestException('Đường dẫn không hợp lệ cho nền tảng TikTok (phải thuộc tên miền tiktok.com)');
        }
      } else if (platform === 'INSTAGRAM') {
        if (!hostname.includes('instagram.com')) {
          throw new BadRequestException('Đường dẫn không hợp lệ cho nền tảng Instagram (phải thuộc tên miền instagram.com)');
        }
      } else if (platform === 'FACEBOOK') {
        if (!hostname.includes('facebook.com') && !hostname.includes('fb.com')) {
          throw new BadRequestException('Đường dẫn không hợp lệ cho nền tảng Facebook (phải thuộc tên miền facebook.com hoặc fb.com)');
        }
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Định dạng đường dẫn URL không hợp lệ');
    }

    return trimmed;
  }

  /**
   * Cập nhật URL cho nền tảng
   */
  async updateUrl(platformParam: string, url: string) {
    const platform = (platformParam || '').trim().toUpperCase() as SocialPlatformType;

    if (!SocialPlatformEnum.includes(platform)) {
      throw new BadRequestException(
        `Nền tảng không hợp lệ. Chỉ chấp nhận một trong các nền tảng: ${SocialPlatformEnum.join(', ')}`,
      );
    }

    const validatedUrl = this.validatePlatformUrl(platform, url);

    const updated = await this.socialLinkModel.findOneAndUpdate(
      { platform },
      {
        $set: {
          url: validatedUrl,
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );

    return {
      success: true,
      message: `Đã cập nhật đường dẫn cho ${platform} thành công`,
      data: {
        id: updated._id,
        platform: updated.platform,
        url: updated.url,
        isActive: Boolean(updated.isActive),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    };
  }

  /**
   * Bật / Tắt trạng thái hiển thị của nền tảng
   */
  async toggleStatus(platformParam: string, targetStatus?: boolean) {
    const platform = (platformParam || '').trim().toUpperCase() as SocialPlatformType;

    if (!SocialPlatformEnum.includes(platform)) {
      throw new BadRequestException(
        `Nền tảng không hợp lệ. Chỉ chấp nhận một trong các nền tảng: ${SocialPlatformEnum.join(', ')}`,
      );
    }

    const existing = await this.socialLinkModel.findOne({ platform });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy cấu hình cho nền tảng ${platform}`);
    }

    const newStatus = typeof targetStatus === 'boolean' ? targetStatus : !existing.isActive;

    // Nếu muốn bật (isActive = true), yêu cầu phải có URL hợp lệ trước
    if (newStatus && (!existing.url || !existing.url.trim())) {
      throw new BadRequestException(
        `Không thể kích hoạt hiển thị ${platform} khi chưa cấu hình đường dẫn liên kết URL hợp lệ.`,
      );
    }

    existing.isActive = newStatus;
    existing.updatedAt = new Date();
    await existing.save();

    return {
      success: true,
      message: `Đã ${newStatus ? 'bật' : 'tắt'} hiển thị nền tảng ${platform} thành công`,
      data: {
        id: existing._id,
        platform: existing.platform,
        url: existing.url,
        isActive: Boolean(existing.isActive),
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      },
    };
  }
}

