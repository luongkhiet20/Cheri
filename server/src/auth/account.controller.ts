import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { User } from './models/user.model';
import { GetUser } from './utils/get-user.decorator';

@Controller('api/account')
export class AccountController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getAccount(@GetUser() user: User) {
    return this.formatUser(user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/me')
  async getMe(@GetUser() user: User) {
    return this.formatUser(user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('/me')
  async updateMe(@GetUser() user: User, @Body() body: any) {
    const updated = await this.authService.updateUser(user._id.toString(), body);
    return this.formatUser(updated);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('/me')
  async putMe(@GetUser() user: User, @Body() body: any) {
    const updated = await this.authService.updateUser(user._id.toString(), body);
    return this.formatUser(updated);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('/me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(@GetUser() user: User, @UploadedFile() file: any) {
    if (!file) {
      return { success: false, message: 'Vui lòng chọn file ảnh' };
    }
    const avatarDataUrl = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
    const updated = await this.authService.updateUser(user._id.toString(), {
      avatar: avatarDataUrl,
    });
    return this.formatUser(updated);
  }

  private formatUser(user: any) {
    const rawRoles = user.roles || user.role;
    const roles = Array.isArray(rawRoles) ? rawRoles.flat() : (rawRoles ? [rawRoles] : ['user']);
    const rawAvatar = user.avatar || user.avatarUrl || (user.images?.[0]?.url || user.images?.[0]) || '';
    const images = Array.isArray(user.images) && user.images.length > 0 ? user.images : rawAvatar ? [rawAvatar] : [];
    const phone = user.phoneNumber || user.phone || '';

    const formatted = {
      id: user._id?.toString() || user.id,
      _id: user._id?.toString() || user.id,
      email: user.email,
      roles,
      role: roles.includes('admin') ? 'Quản trị viên' : 'Thành viên',
      name: user.name || user.fullName || (user.email ? user.email.split('@')[0] : ''),
      fullName: user.fullName || user.name || (user.email ? user.email.split('@')[0] : ''),
      phoneNumber: phone,
      phone: phone,
      address: user.address || '',
      gender: user.gender || '',
      dateOfBirth: user.dateOfBirth || '',
      avatar: rawAvatar,
      avatarUrl: rawAvatar,
      images,
      status: user.status !== false,
      isActive: user.status !== false,
      dateAdded: user.dateAdded || user.createdAt,
      createdAt: user.createdAt || user.dateAdded,
      updatedAt: user.updatedAt,
    };

    return {
      success: true,
      data: formatted,
      ...formatted,
    };
  }
}
