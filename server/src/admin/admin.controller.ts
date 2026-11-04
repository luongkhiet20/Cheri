import {
  Controller,
  Get,
  UseGuards,
  Session,
  Post,
  Query,
  Body,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';

import { RolesGuard, AdminJwtAuthGuard, RequireAnyPermissions } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { Images } from './utils/images';
import { Product } from '../products/models/product.model';
import { AddProductImageDto } from './dto/add-image.dto';
import { ImageDto } from './dto/image.dto';

const storage = multer.memoryStorage();
const upload = multer({ storage });

const CONTENT_EDIT_PERMS = [
  'products:create',
  'products:update',
  'cms:home',
  'cms:about',
  'cms:policies',
  'settings:manage',
];

@Controller('api/admin')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @RequireAnyPermissions(...CONTENT_EDIT_PERMS)
  @Get('/images')
  getImages(@Session() session): Promise<Images> {
    return this.adminService.getImages(session.images);
  }

  @RequireAnyPermissions(...CONTENT_EDIT_PERMS)
  @Post('/images/add')
  async addImage(
    @Session() session,
    @Body() imageDto: ImageDto,
    @Query(ValidationPipe) addImageDto: AddProductImageDto,
  ): Promise<Images | Product> {
    const result = await this.adminService.addImage(
      session.images,
      imageDto,
      addImageDto,
    );
    if (!(result as Product).titleUrl) {
      session.images = result;
    }

    return result;
  }

  @RequireAnyPermissions(...CONTENT_EDIT_PERMS)
  @Get('/cloudinary-signature')
  getCloudinarySignature(@Query('folder') folder: string) {
    const { generateUploadSignature } = require('../services/cloudinary-service');
    return {
      success: true,
      data: generateUploadSignature(folder || 'cheri/products'),
    };
  }

  @RequireAnyPermissions(...CONTENT_EDIT_PERMS)
  @Post('/images/upload')
  @UseInterceptors(FileInterceptor('file', upload.single('file')))
  async uploadImage(
    @Session() session,
    @UploadedFile() file,
    @Query(ValidationPipe) addImageDto: AddProductImageDto,
    @Query('folder') folder?: string,
  ): Promise<Images | Product | any> {
    const result = await this.adminService.uploadImage(
      session.images,
      file,
      addImageDto,
      folder,
    );
    if (!(result as Product).titleUrl) {
      session.images = result;
    }

    return result;
  }

  @RequireAnyPermissions(...CONTENT_EDIT_PERMS)
  @Post('/images/remove')
  async removeImage(
    @Session() session,
    @Body() imageDto: ImageDto,
    @Query(ValidationPipe) addImageDto: AddProductImageDto,
  ): Promise<Images | Product> {
    const result = await this.adminService.removeImage(
      session.images,
      imageDto,
      addImageDto,
    );
    if (!(result as Product).titleUrl) {
      session.images = result;
    }

    return result;
  }
}
