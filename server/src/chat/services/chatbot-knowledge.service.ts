import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export interface PolicyKnowledgeItem {
  title: string;
  url: string;
  content: string;
  routeLink: string;
  isAvailable: boolean;
}

@Injectable()
export class ChatbotKnowledgeService {
  private readonly logger = new Logger(ChatbotKnowledgeService.name);

  // Exact slugs recognized in the Chéri storefront
  private readonly slugMapping: Record<string, { slugs: string[]; route: string; defaultTitle: string }> = {
    returnPolicy: {
      slugs: ['return-policy', 'chinh-sach-doi-tra', 'doi-tra'],
      route: '/vi/return-policy',
      defaultTitle: 'Chính sách đổi trả',
    },
    shippingPolicy: {
      slugs: ['shipping-policy', 'chinh-sach-van-chuyen', 'van-chuyen', 'giao-hang'],
      route: '/vi/shipping-policy',
      defaultTitle: 'Chính sách vận chuyển & giao hàng',
    },
    warrantyPolicy: {
      slugs: ['warranty-policy', 'chinh-sach-bao-hanh', 'bao-hanh'],
      route: '/vi/warranty-policy',
      defaultTitle: 'Chính sách bảo hành',
    },
    privacyPolicy: {
      slugs: ['privacy-policy', 'chinh-sach-bao-mat', 'bao-mat'],
      route: '/vi/privacy-policy',
      defaultTitle: 'Chính sách bảo mật',
    },
    orderingGuide: {
      slugs: ['ordering-guide', 'huong-dan-dat-hang', 'dat-hang'],
      route: '/vi/ordering-guide',
      defaultTitle: 'Hướng dẫn đặt hàng & thanh toán',
    },
    faqs: {
      slugs: ['faqs', 'cau-hoi-thuong-gap', 'faq'],
      route: '/vi/faqs',
      defaultTitle: 'Câu hỏi thường gặp (FAQs)',
    },
    termsOfService: {
      slugs: ['terms-of-service', 'dieu-khoan-dich-vu', 'dieu-khoan'],
      route: '/vi/terms-of-service',
      defaultTitle: 'Điều khoản dịch vụ',
    },
    aboutUs: {
      slugs: ['about-us', 've-chung-toi', 'gioi-thieu', 'thuong-hieu'],
      route: '/vi/about-us',
      defaultTitle: 'Về Chéri',
    },
    sizeGuide: {
      slugs: ['size-guide', 'bang-size-chuan', 'huong-dan-chon-size', 'bang-size'],
      route: '/vi/size-guide',
      defaultTitle: 'Bảng size chuẩn Chéri',
    },
  };

  constructor(@InjectModel('Page') private pageModel: Model<any>) {}

  /**
   * Search for relevant policy pages from pages_policies collection in MongoDB
   */
  async findRelevantPolicy(message: string): Promise<PolicyKnowledgeItem | null> {
    const lower = (message || '').toLowerCase();
    let targetConfig: { slugs: string[]; route: string; defaultTitle: string } | null = null;

    if (/(đổi trả|đổi hàng|hoàn tiền|trả hàng|đổi mẫu)/i.test(lower)) {
      targetConfig = this.slugMapping.returnPolicy;
    } else if (/(vận chuyển|giao hàng|phí ship|thời gian giao|bao lâu nhận được)/i.test(lower)) {
      targetConfig = this.slugMapping.shippingPolicy;
    } else if (/(bảo hành|sửa đồ|lỗi sản phẩm|bảo hành đầm)/i.test(lower)) {
      targetConfig = this.slugMapping.warrantyPolicy;
    } else if (/(bảo mật|thông tin cá nhân|bảo vệ dữ liệu)/i.test(lower)) {
      targetConfig = this.slugMapping.privacyPolicy;
    } else if (/(hướng dẫn đặt hàng|cách mua|thanh toán|chuyển khoản|cod)/i.test(lower)) {
      targetConfig = this.slugMapping.orderingGuide;
    } else if (/(bảng size|chọn size|số đo|vòng eo|vòng ngực|vừa không)/i.test(lower)) {
      targetConfig = this.slugMapping.sizeGuide;
    } else if (/(về chéri|thương hiệu|chéri là gì|giới thiệu|cửa hàng)/i.test(lower)) {
      targetConfig = this.slugMapping.aboutUs;
    } else if (/(câu hỏi|faq|thắc mắc)/i.test(lower)) {
      targetConfig = this.slugMapping.faqs;
    }

    if (!targetConfig) {
      return null;
    }

    try {
      // Find published page in pages_policies by any matching slug
      const page: any = await this.pageModel
        .findOne({
          $or: [
            { titleUrl: { $in: targetConfig.slugs } },
            { url: { $in: targetConfig.slugs } },
          ],
        })
        .lean();

      if (page) {
        // Extract localized or root content
        const rawTitle = page.vi?.title || page.title || targetConfig.defaultTitle;
        const rawContent = page.vi?.contentHTML || page.contentHTML || page.content || '';
        const cleanContent = this.sanitizeAndStripHtml(rawContent);

        return {
          title: rawTitle,
          url: page.titleUrl || page.url || targetConfig.slugs[0],
          content: cleanContent,
          routeLink: targetConfig.route,
          isAvailable: cleanContent.length > 20,
        };
      }
    } catch (err) {
      this.logger.error(`Error querying policy page: ${err.message}`);
    }

    // Default configuration with route even if DB doc is currently empty
    return {
      title: targetConfig.defaultTitle,
      url: targetConfig.slugs[0],
      content: '',
      routeLink: targetConfig.route,
      isAvailable: false,
    };
  }

  /**
   * Strictly sanitize and strip HTML, removing scripts, tags, and injection vectors
   */
  sanitizeAndStripHtml(html: string): string {
    if (!html) return '';
    return html
      // Remove script tags and contents
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove style tags and contents
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove iframes
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]*>?/gm, ' ')
      // Remove prompt injection payloads
      .replace(/ignore (?:all )?previous instructions/gi, '')
      .replace(/bỏ qua mọi (?:quy định|chỉ thị)/gi, '')
      // Normalize whitespace
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
