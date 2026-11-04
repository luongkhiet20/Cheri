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
  ForbiddenException,
} from '@nestjs/common';
import { AdminJwtAuthGuard, RolesGuard, RequirePermissions } from './roles.guard';
import { AuthService } from './auth.service';
import { GetUser } from './utils/get-user.decorator';
import { User } from './models/user.model';

@Controller('api/users')
export class UsersController {
  constructor(private authService: AuthService) {}

  private isCallerAdmin(user: any): boolean {
    if (!user) return false;
    const rawRoles = user.roles || (user.role ? [user.role] : []);
    const roles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles])
      .map((r: any) => (typeof r === 'string' ? r.toLowerCase().trim() : ''));
    return (
      roles.includes('admin') ||
      roles.includes('super-admin') ||
      roles.includes('superadmin') ||
      user.isAdmin === true
    );
  }

  /**
   * Kiểm tra xem tài khoản mục tiêu có phải là tài khoản có đặc quyền (Admin hoặc Staff) không.
   * Nhân viên không được phép quản lý (sửa, khóa, xóa) tài khoản Quản trị viên hoặc Nhân viên khác.
   */
  private isPrivilegedAccount(user: any): boolean {
    if (!user) return false;
    const rawRoles = user.roles || (user.role ? [user.role] : []);
    const roles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles])
      .map((r: any) => (typeof r === 'string' ? r.toLowerCase().trim() : ''));
    return (
      roles.includes('admin') ||
      roles.includes('super-admin') ||
      roles.includes('superadmin') ||
      roles.includes('staff') ||
      user.isAdmin === true
    );
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @RequirePermissions('users:view')
  @Get()
  async getUsers(@Query() query: any) {
    const users = await this.authService.getAllUsers();
    let filtered = [...users];

    // Lọc theo search (tên, email, số điện thoại)
    if (query?.search) {
      const q = String(query.search).trim().toLowerCase();
      filtered = filtered.filter(
        (u: any) =>
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
        const roles = Array.isArray(u.roles)
          ? u.roles.map((r: any) => String(r).toLowerCase())
          : [String(u.role || '').toLowerCase()];
        return roles.includes(targetRole);
      });
    }

    // Lọc theo trạng thái (status: active / inactive)
    if (query?.status !== undefined && query?.status !== '') {
      const s = String(query.status).trim().toLowerCase();
      if (s === 'inactive' || s === 'locked' || s === 'false') {
        filtered = filtered.filter(
          (u: any) =>
            u.status === false || u.status === 'inactive' || u.status === 'locked',
        );
      } else if (s === 'active' || s === 'true') {
        filtered = filtered.filter(
          (u: any) =>
            u.status !== false && u.status !== 'inactive' && u.status !== 'locked',
        );
      }
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(
      1,
      Number(query?.limit || query?.pageSize) || filtered.length || 20,
    );

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
  @RequirePermissions('users:view')
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
  @RequirePermissions('users:view')
  @Get('/:id/orders')
  async getUserOrders(@Param('id') id: string) {
    const orders = await this.authService.getUserOrders(id);
    return {
      success: true,
      data: orders,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @RequirePermissions('users:create')
  @Post()
  async createUser(@Body() body: any, @GetUser() currentUser: User) {
    const isAdmin = this.isCallerAdmin(currentUser);
    const requestedRoles = Array.isArray(body?.roles) ? body.roles : [body?.roles];
    const isCreatingPrivileged = requestedRoles.some(
      (r: any) => typeof r === 'string' && (r.toLowerCase() === 'admin' || r.toLowerCase() === 'staff'),
    );

    if (!isAdmin) {
      if (isCreatingPrivileged || (body?.permissions && body.permissions.length > 0)) {
        throw new ForbiddenException(
          'Nhân viên không có quyền tạo tài khoản Quản trị viên hoặc Nhân viên khác',
        );
      }
      body.roles = ['user'];
      body.permissions = [];
    }

    const user = await this.authService.createUser(body);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @RequirePermissions('users:update')
  @Put('/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: any,
    @GetUser() currentUser: User,
  ) {
    const isAdmin = this.isCallerAdmin(currentUser);
    const targetUser = await this.authService.getUserById(id);
    if (!targetUser) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!isAdmin) {
      if (this.isPrivilegedAccount(targetUser)) {
        throw new ForbiddenException('Nhân viên không có quyền chỉnh sửa tài khoản Quản trị viên hoặc Nhân viên khác');
      }
      // Staff cannot escalate roles, modify permissions, or alter security status
      delete body.roles;
      delete body.permissions;
      delete body.status;
    }

    const user = await this.authService.updateUser(id, body);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @RequirePermissions('users:update')
  @Patch('/:id')
  async patchUser(
    @Param('id') id: string,
    @Body() body: any,
    @GetUser() currentUser: User,
  ) {
    const isAdmin = this.isCallerAdmin(currentUser);
    const targetUser = await this.authService.getUserById(id);
    if (!targetUser) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!isAdmin) {
      if (this.isPrivilegedAccount(targetUser)) {
        throw new ForbiddenException('Nhân viên không có quyền chỉnh sửa tài khoản Quản trị viên hoặc Nhân viên khác');
      }
      // Staff cannot escalate roles, modify permissions, or alter security status
      delete body.roles;
      delete body.permissions;
      delete body.status;
    }

    const user = await this.authService.updateUser(id, body);
    return {
      success: true,
      data: user,
    };
  }

  private async handleToggleOrSetStatus(id: string, newStatusValue: any, currentUser: User) {
    const isAdmin = this.isCallerAdmin(currentUser);
    const user = await this.authService.getUserById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!isAdmin && this.isPrivilegedAccount(user)) {
      throw new ForbiddenException('Nhân viên không có quyền khóa hoặc mở khóa tài khoản Quản trị viên hoặc Nhân viên khác');
    }

    let finalStatus: boolean;
    if (typeof newStatusValue === 'boolean') {
      finalStatus = newStatusValue;
    } else {
      finalStatus = !(user.status !== false);
    }

    const updated = await this.authService.updateUser(id, { status: finalStatus });
    return {
      success: true,
      message: finalStatus ? 'Đã mở khóa tài khoản thành công' : 'Đã khóa tài khoản thành công',
      data: updated,
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @RequirePermissions('users:lock')
  @Patch('/:id/status')
  async patchUserStatus(
    @Param('id') id: string,
    @Body() body: any,
    @GetUser() currentUser: User,
  ) {
    return this.handleToggleOrSetStatus(id, body?.status, currentUser);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @RequirePermissions('users:lock')
  @Patch('/:id/toggle-status')
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() body: any,
    @GetUser() currentUser: User,
  ) {
    return this.handleToggleOrSetStatus(id, body?.status, currentUser);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @RequirePermissions('users:delete')
  @Delete('/:id')
  async deleteUser(
    @Param('id') id: string,
    @GetUser() currentUser: User,
  ) {
    const isAdmin = this.isCallerAdmin(currentUser);
    const user = await this.authService.getUserById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!isAdmin && this.isPrivilegedAccount(user)) {
      throw new ForbiddenException('Nhân viên không có quyền xóa tài khoản Quản trị viên hoặc Nhân viên khác');
    }

    await this.authService.deleteUser(id);
    return {
      success: true,
      message: 'Xóa người dùng thành công',
    };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @RequirePermissions('users:delete')
  @Post('/bulk-delete')
  async bulkDeleteUsers(
    @Body() body: { ids: string[] },
    @GetUser() currentUser: User,
  ) {
    if (!body?.ids || !Array.isArray(body.ids)) {
      throw new BadRequestException('Danh sách ID không hợp lệ');
    }

    const isAdmin = this.isCallerAdmin(currentUser);
    if (!isAdmin) {
      // Check if any target is privileged (admin or staff)
      for (const targetId of body.ids) {
        const u = await this.authService.getUserById(targetId);
        if (u && this.isPrivilegedAccount(u)) {
          throw new ForbiddenException('Nhân viên không có quyền xóa tài khoản Quản trị viên hoặc Nhân viên khác');
        }
      }
    }

    await this.authService.bulkDeleteUsers(body.ids);
    return {
      success: true,
      message: `Đã xóa ${body.ids.length} người dùng thành công`,
    };
  }

  /**
   * Endpoint chuyên dụng cập nhật phân quyền cho tài khoản nhân viên (STAFF)
   * Chỉ Quản trị viên tối cao (ADMIN) mới có quyền thực hiện
   */
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/:id/permissions')
  async updateStaffPermissions(
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
    @GetUser() currentUser: User,
  ) {
    if (!this.isCallerAdmin(currentUser)) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên tối cao mới có quyền cấp, chỉnh sửa hoặc thu hồi quyền truy cập của nhân viên',
      );
    }

    const targetUser = await this.authService.getUserById(id);
    if (!targetUser) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const cleanPermissions = Array.isArray(body?.permissions)
      ? body.permissions.filter((p: any) => typeof p === 'string' && p.trim())
      : [];

    const updated = await this.authService.updateUser(id, {
      permissions: cleanPermissions,
    });

    return {
      success: true,
      message: 'Cập nhật phân quyền nhân viên thành công',
      data: updated,
    };
  }
}
