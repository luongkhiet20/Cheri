import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AdminJwtAuthGuard, RolesGuard } from './roles.guard';
import { AuthService } from './auth.service';

@Controller('api/users')
export class UsersController {
  constructor(private authService: AuthService) {}

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get()
  async getUsers(@Query() query: any) {
    const users = await this.authService.getAllUsers();
    let filtered = [...users];

    // Lọc theo search (tên, email, số điện thoại)
    if (query?.search) {
      const q = String(query.search).trim().toLowerCase();
      filtered = filtered.filter((u: any) =>
        (u.name && String(u.name).toLowerCase().includes(q)) ||
        (u.fullName && String(u.fullName).toLowerCase().includes(q)) ||
        (u.email && String(u.email).toLowerCase().includes(q)) ||
        (u.phoneNumber && String(u.phoneNumber).toLowerCase().includes(q)),
      );
    }

    // Lọc theo vai trò (role)
    if (query?.role) {
      const targetRole = String(query.role).trim().toLowerCase();
      filtered = filtered.filter((u: any) => {
        const roles = Array.isArray(u.roles) ? u.roles.map((r: any) => String(r).toLowerCase()) : [String(u.role || '').toLowerCase()];
        return roles.includes(targetRole);
      });
    }

    // Lọc theo trạng thái (status: active / inactive)
    if (query?.status !== undefined && query?.status !== '') {
      const s = String(query.status).trim().toLowerCase();
      if (s === 'inactive' || s === 'locked' || s === 'false') {
        filtered = filtered.filter((u: any) => u.status === false || u.status === 'inactive' || u.status === 'locked');
      } else if (s === 'active' || s === 'true') {
        filtered = filtered.filter((u: any) => u.status !== false && u.status !== 'inactive' && u.status !== 'locked');
      }
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Number(query?.limit || query?.pageSize) || filtered.length || 20);

    return {
      success: true,
      data: filtered,
      pagination: {
        page,
        pageSize: limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/:id')
  async getUserById(@Param('id') id: string) {
    const user = await this.authService.getUserById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/:id/orders')
  async getUserOrders(@Param('id') id: string) {
    const orders = await this.authService.getUserOrders(id);
    return {
      success: true,
      data: orders,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post()
  async createUser(@Body() body: any) {
    const user = await this.authService.createUser(body);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Put('/:id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    const user = await this.authService.updateUser(id, body);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/:id')
  async patchUser(@Param('id') id: string, @Body() body: any) {
    const user = await this.authService.updateUser(id, body);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/:id/toggle-status')
  async toggleUserStatus(@Param('id') id: string) {
    const user = await this.authService.getUserById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    const newStatus = !(user.status !== false);
    const updated = await this.authService.updateUser(id, { status: newStatus });
    return {
      success: true,
      data: updated,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/:id')
  async deleteUser(@Param('id') id: string) {
    await this.authService.deleteUser(id);
    return {
      success: true,
      message: 'Xóa người dùng thành công',
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/bulk-delete')
  async bulkDeleteUsers(@Body() body: { ids: string[] }) {
    if (!body?.ids || !Array.isArray(body.ids)) {
      throw new BadRequestException('Danh sách ID không hợp lệ');
    }
    await this.authService.bulkDeleteUsers(body.ids);
    return {
      success: true,
      message: `Đã xóa ${body.ids.length} người dùng thành công`,
    };
  }
}
