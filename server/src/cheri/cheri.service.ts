import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { sendMsg } from '../shared/utils/email/mailer';
import { ContactDto } from './dto/contact.dto';
import { PageDto } from './dto/page.dto';
import { Cart } from '../cart/utils/cart';
import { Page } from './models/page.model';
import { PageHome } from './models/page-home.model';
import { PageAbout } from './models/page-about.model';
import { Theme } from './models/theme.model';
import { Config } from './models/config.model';
import { Translation } from '../translations/translation.model';
import { SaveHomeDraftDto, PublishHomeDto } from './dto/home-page.dto';
import { SaveAboutDraftDto, PublishAboutDto } from './dto/about-page.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CheriService {
  constructor(
    @InjectModel('Page') private pageModel: Model<Page>,
    @InjectModel('PageHome') private pageHomeModel: Model<PageHome>,
    @InjectModel('PageAbout') private pageAboutModel: Model<PageAbout>,
    @InjectModel('Theme') private themeModel: Model<Theme>,
    @InjectModel('Config') private configModel: Model<Config>,
    @InjectModel('Translation') private translationModel: Model<Translation>,
    private httpService: HttpService,
  ) {}

  async getConfig(session): Promise<{ config: any }> {
    const activeConfig = await this.configModel.findOne({ active: true });

    if (activeConfig) {
      session.config = activeConfig;
    }
    try {
      const theme = await this.themeModel.findOne({ active: true });
      const configFomEnvToFE = Object.keys(process.env)
        .filter((key) => key.includes('FE_'))
        .reduce((prev, curr) => ({ ...prev, [curr]: process.env[curr] }), {});
      const themeStyles =
        theme && Object.keys(theme.styles).length
          ? { styles: theme.styles }
          : {};

      return {
        config: Buffer.from(
          JSON.stringify({ ...configFomEnvToFE, ...themeStyles }),
        ).toString('base64'),
      };
    } catch {
      return { config: '' };
    }
  }

  async sendContact(
    contactDto: ContactDto,
    cart: Cart,
    lang: string,
  ): Promise<void> {
    const { token } = contactDto;
    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SERVER_KEY}&response=${token}`;

    const result = await firstValueFrom(this.httpService.post(url));
    if (result.data.success) {
      try {
        const translations = await this.translationModel.findOne({ lang });
        this.sendmail(contactDto.email, contactDto, cart, translations);

        if (process.env.ADMIN_EMAILS) {
          process.env.ADMIN_EMAILS.split(',')
            .filter(Boolean)
            .forEach((email) => {
              this.sendmail(email, contactDto, cart, translations);
            });
        }
      } catch {
        throw new BadRequestException();
      }
    } else {
      throw new BadRequestException();
    }
  }

  async getPages(lang: string, titles?: boolean): Promise<Page[]> {
    const selectQuery = titles ? { titleUrl: 1, [`${lang}.title`]: 1, status: 1, isPublished: 1 } : {};
    const pages = await this.pageModel.find({}, selectQuery);
    return pages;
  }

  async getPage(titleUrl: string, lang: string): Promise<Page> {
    const found = await this.pageModel.findOne(
      { titleUrl },
      { titleUrl: 1, [lang]: 1, status: 1, isPublished: 1 },
    );

    if (!found) {
      throw new NotFoundException(`Product with title ${titleUrl} not found`);
    }

    return found;
  }

  async addOrEditPage(pageDto: PageDto): Promise<Page> {
    const { titleUrl } = pageDto;
    const found = await this.pageModel.findOne({ titleUrl });

    if (!found) {
      const newPage = Object.assign(pageDto, {
        dateAdded: Date.now(),
      });

      try {
        const page = new this.pageModel(newPage);
        await page.save();
        return page;
      } catch (err) {
        console.error('Error adding page:', err);
        throw new BadRequestException();
      }
    }

    if (found) {
      try {
        const updated = await this.pageModel.findOneAndUpdate(
          { titleUrl },
          pageDto,
          { new: true, upsert: true },
        );
        return updated;
      } catch (err) {
        console.error('Error updating page:', err);
        throw new BadRequestException();
      }
    }
  }

  async deletePage(titleUrl: string): Promise<void> {
    const found = await this.pageModel.findOneAndDelete({ titleUrl });

    if (!found) {
      throw new NotFoundException(`Page with title ${titleUrl} not found`);
    }
  }

  async getThemes(): Promise<Theme[]> {
    const themes = await this.themeModel.find({});
    return themes;
  }

  async addOrEditTheme(themeDto: any): Promise<Theme> {
    const { titleUrl } = themeDto;
    const found = await this.themeModel.findOne({ titleUrl });

    if (!found) {
      const newTheme = Object.assign(themeDto, {
        dateAdded: Date.now(),
      });

      try {
        const theme = new this.themeModel(newTheme);
        await theme.save();
        return theme;
      } catch (err) {
        console.error('Error adding theme:', err);
        throw new BadRequestException();
      }
    }

    if (found) {
      try {
        const updated = await this.themeModel.findOneAndUpdate(
          { titleUrl },
          themeDto,
          { new: true, upsert: true },
        );
        return updated;
      } catch (err) {
        console.error('Error updating theme:', err);
        throw new BadRequestException();
      }
    }
  }

  async deleteTheme(titleUrl: string): Promise<void> {
    const found = await this.themeModel.findOneAndDelete({ titleUrl });

    if (!found) {
      throw new NotFoundException(`Theme with title ${titleUrl} not found`);
    }
  }

  async getConfigs(): Promise<Config[]> {
    const configs = await this.configModel.find({});
    return configs;
  }

  async addOrEditConfig(configDto: any): Promise<Config> {
    const { titleUrl } = configDto;
    const found = await this.configModel.findOne({ titleUrl });

    if (!found) {
      const newConfig = Object.assign(configDto, {
        dateAdded: Date.now(),
      });

      try {
        const config = new this.configModel(newConfig);
        await config.save();
        return config;
      } catch (err) {
        console.error('Error adding config:', err);
        throw new BadRequestException();
      }
    }

    if (found) {
      try {
        const updated = await this.configModel.findOneAndUpdate(
          { titleUrl },
          configDto,
          { new: true, upsert: true },
        );
        return updated;
      } catch (err) {
        console.error('Error updating config:', err);
        throw new BadRequestException();
      }
    }
  }

  async deleteConfig(titleUrl: string): Promise<void> {
    const found = await this.configModel.findOneAndDelete({ titleUrl });

    if (!found) {
      throw new NotFoundException(`Config with title ${titleUrl} not found`);
    }
  }

  private sendmail = async (
    email: string,
    contactDto: ContactDto,
    cart: Cart,
    translations,
  ) => {
    const emailType = {
      subject: 'Contact',
      cart,
      contact: contactDto,
      date: new Date(),
    };

    const mailSended = await sendMsg(email, emailType, translations);
    return mailSended;
  };

  /**
   * Lấy cấu hình trang chủ công khai đã xuất bản (Public API)
   * Chỉ trả về các section đang bật (enabled !== false), sắp xếp theo order
   */
  async getHomePublished(): Promise<{
    success: boolean;
    data: any;
    sections: any[];
  }> {
    try {
      const homeDoc: any = await this.pageHomeModel
        .findOne({ key: 'home_page', status: 'published' })
        .lean();

      if (!homeDoc || !Array.isArray(homeDoc.sections)) {
        return {
          success: true,
          data: null,
          sections: [],
        };
      }

      const activeSections = homeDoc.sections
        .filter((sec: any) => sec && sec.enabled !== false)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      return {
        success: true,
        data: {
          ...homeDoc,
          sections: activeSections,
        },
        sections: activeSections,
      };
    } catch (err) {
      console.error('Error fetching published home configuration:', err);
      return {
        success: true,
        data: null,
        sections: [],
      };
    }
  }

  /**
   * Lấy cấu hình trang chủ dành cho Quản trị viên (Admin API)
   * Đọc cấu hình xuất bản hiện hành duy nhất từ database
   */
  async getHomeAdmin(): Promise<{
    success: boolean;
    data: any;
    sections: any[];
  }> {
    const homeDoc: any = await this.pageHomeModel
      .findOne({ key: 'home_page', status: 'published' })
      .lean();

    if (!homeDoc || !Array.isArray(homeDoc.sections)) {
      return {
        success: true,
        data: null,
        sections: [],
      };
    }

    const sortedSections = [...homeDoc.sections].sort(
      (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
    );

    return {
      success: true,
      data: {
        ...homeDoc,
        sections: sortedSections,
      },
      sections: sortedSections,
    };
  }

  /**
   * Xuất bản cấu hình trang chủ (Admin API) - Cập nhật cấu hình duy nhất
   */
  async publishHome(
    publishDto: PublishHomeDto,
    userEmail?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const sectionsToPublish = publishDto?.sections;

    if (!sectionsToPublish || !Array.isArray(sectionsToPublish) || sectionsToPublish.length === 0) {
      throw new BadRequestException('Dữ liệu phân đoạn (sections) không hợp lệ hoặc rỗng để xuất bản');
    }

    try {
      const editorEmail = userEmail || publishDto?.updatedBy || 'admin';

      const publishedDoc = await this.pageHomeModel.findOneAndUpdate(
        { key: 'home_page', status: 'published' },
        {
          $set: {
            key: 'home_page',
            status: 'published',
            sections: sectionsToPublish,
            publishedAt: new Date(),
            updatedBy: editorEmail,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      return {
        success: true,
        message: 'Xuất bản cấu hình trang chủ thành công',
        data: publishedDoc,
      };
    } catch (err) {
      console.error('Error publishing home configuration:', err);
      throw new BadRequestException('Không thể xuất bản cấu hình trang chủ: ' + (err?.message || 'Lỗi server'));
    }
  }

  /**
   * Lấy cấu hình trang Giới thiệu (About) đã xuất bản (Client API)
   * Đọc trực tiếp từ collection pages_about
   */
  async getAboutPublished(): Promise<{
    success: boolean;
    data: any;
    sections: any[];
  }> {
    try {
      const aboutDoc: any = await this.pageAboutModel
        .findOne({ key: 'about_page', status: 'published' })
        .lean();

      if (!aboutDoc || !Array.isArray(aboutDoc.sections)) {
        return {
          success: true,
          data: null,
          sections: [],
        };
      }

      const activeSections = aboutDoc.sections
        .filter((sec: any) => sec && sec.enabled !== false)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      return {
        success: true,
        data: {
          ...aboutDoc,
          sections: activeSections,
        },
        sections: activeSections,
      };
    } catch (err) {
      console.error('Error fetching published about configuration:', err);
      return {
        success: true,
        data: null,
        sections: [],
      };
    }
  }

  /**
   * Lấy cấu hình trang Giới thiệu dành cho Quản trị viên (Admin API)
   * Đọc cấu hình từ collection pages_about
   */
  async getAboutAdmin(): Promise<{
    success: boolean;
    data: any;
    sections: any[];
  }> {
    const aboutDoc: any = await this.pageAboutModel
      .findOne({ key: 'about_page', status: 'published' })
      .lean();

    if (!aboutDoc || !Array.isArray(aboutDoc.sections)) {
      return {
        success: true,
        data: null,
        sections: [],
      };
    }

    const sortedSections = [...aboutDoc.sections].sort(
      (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
    );

    return {
      success: true,
      data: {
        ...aboutDoc,
        sections: sortedSections,
      },
      sections: sortedSections,
    };
  }

  /**
   * Xuất bản cấu hình trang Giới thiệu (Admin API)
   * Lưu trực tiếp vào collection pages_about
   */
  async publishAbout(
    publishDto: PublishAboutDto,
    userEmail?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const sectionsToPublish = publishDto?.sections;

    if (!sectionsToPublish || !Array.isArray(sectionsToPublish) || sectionsToPublish.length === 0) {
      throw new BadRequestException('Dữ liệu phân đoạn (sections) không hợp lệ hoặc rỗng để xuất bản');
    }

    try {
      const editorEmail = userEmail || publishDto?.updatedBy || 'admin';

      const publishedDoc = await this.pageAboutModel.findOneAndUpdate(
        { key: 'about_page', status: 'published' },
        {
          $set: {
            key: 'about_page',
            status: 'published',
            sections: sectionsToPublish,
            publishedAt: new Date(),
            updatedBy: editorEmail,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      return {
        success: true,
        message: 'Xuất bản cấu hình trang Giới thiệu thành công',
        data: publishedDoc,
      };
    } catch (err) {
      console.error('Error publishing about configuration:', err);
      throw new BadRequestException('Không thể xuất bản cấu hình trang Giới thiệu: ' + (err?.message || 'Lỗi server'));
    }
  }
}

