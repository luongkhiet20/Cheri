import { Controller, Get, Query, UseGuards, Patch, Body } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthGuard } from '@nestjs/passport';

import { Translation } from './translation.model';
import { RolesGuard } from '../auth/roles.guard';

@Controller('api/translations')
export class TranslationsController {
  constructor(
    @InjectModel('Translation') private translationModel: Model<Translation>,
  ) {}

  @Get()
  async getTranslations(@Query('lang') lang?: string): Promise<Translation> {
    let doc = await this.translationModel.findOne({ lang: 'vi' });
    if (!doc) {
      doc = await this.translationModel.create({ lang: 'vi', keys: {} });
    }
    return doc;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('all')
  async getAllTranslations(): Promise<Translation[]> {
    return await this.translationModel.find({ lang: 'vi' });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch('all')
  async updateTranslations(@Body() translations: any): Promise<any> {
    const list = Array.isArray(translations) ? translations : [translations];
    const viItem = list.find((t) => t.lang === 'vi') || list[0];
    if (viItem) {
      return this.translationModel.findOneAndUpdate(
        { lang: 'vi' },
        { $set: { keys: viItem.keys } },
        { upsert: true, new: true },
      );
    }
    return null;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch()
  async updateTranslation(
    @Query('lang') lang: string,
    @Body() translation: any,
  ): Promise<Translation> {
    return await this.translationModel.findOneAndUpdate(
      { lang: 'vi' },
      { keys: translation.keys || translation },
      { upsert: true, new: true },
    );
  }
}
