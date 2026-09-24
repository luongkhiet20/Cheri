import {
  Controller,
  Body,
  Session,
  Post,
  Get,
  UseGuards,
  Param,
  Delete,
  Headers,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { CheriService } from './cheri.service';
import { ContactDto } from './dto/contact.dto';
import { PageDto } from './dto/page.dto';
import { RolesGuard, AdminJwtAuthGuard } from '../auth/roles.guard';
import { Page } from './models/page.model';
import { Theme } from './models/theme.model';
import { Config } from './models/config.model';

@Controller('api/cheri')
export class CheriController {
  constructor(private cheriService: CheriService) {}

  @Get('/config')
  getConfig(@Session() session): Promise<{ config: string }> {
    return this.cheriService.getConfig(session);
  }

  @Post('/contact')
  sendContact(
    @Body() contactDto: ContactDto,
    @Session() session,
    @Headers('lang') lang: string,
  ): void {
    this.cheriService.sendContact(contactDto, session.cart, lang);
  }

  @Get('/page/all')
  getPages(
    @Headers('lang') lang: string,
    @Query('titles') titles: boolean,
  ): Promise<Page[]> {
    return this.cheriService.getPages(lang, titles);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/page')
  addOrEditPage(@Body() pageDto: PageDto): Promise<Page> {
    return this.cheriService.addOrEditPage(pageDto);
  }

  @Get('/page/:titleUrl')
  getPage(
    @Param('titleUrl') titleUrl: string,
    @Headers('lang') lang: string,
  ): Promise<Page> {
    return this.cheriService.getPage(titleUrl, lang);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/page/:titleUrl')
  deletePage(@Param('titleUrl') titleUrl: string): Promise<void> {
    return this.cheriService.deletePage(titleUrl);
  }

  @Get('/theme/all')
  getThemes(): Promise<Theme[]> {
    return this.cheriService.getThemes();
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/theme')
  addOrEditTheme(@Body() themeDto): Promise<Theme> {
    return this.cheriService.addOrEditTheme(themeDto);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/theme/:titleUrl')
  deleteTheme(@Param('titleUrl') titleUrl: string): Promise<void> {
    return this.cheriService.deleteTheme(titleUrl);
  }

  @Get('/config/all')
  getConfigs(): Promise<Config[]> {
    return this.cheriService.getConfigs();
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/config')
  addOrEditConfig(@Body() configDto): Promise<Config> {
    return this.cheriService.addOrEditConfig(configDto);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/config/:titleUrl')
  deleteConfig(@Param('titleUrl') titleUrl: string): Promise<void> {
    return this.cheriService.deleteConfig(titleUrl);
  }
}
