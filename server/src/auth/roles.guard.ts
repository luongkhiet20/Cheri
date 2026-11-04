import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, PERMISSIONS_ANY_KEY } from './decorators/require-permissions.decorator';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Nếu token hợp lệ và tài khoản active -> trả về user
    // Nếu không có token hoặc token lỗi/hết hạn -> trả về null (coi là khách vãng lai, không ném 401)
    if (err || !user || user.status === false) {
      return null;
    }
    return user;
  }
}

@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (user && user.status !== false) {
      return user;
    }
    throw err || new UnauthorizedException('Yêu cầu xác thực tài khoản quản trị');
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private allowedAdminRoles = ['admin', 'super-admin', 'superadmin'];

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.status === false) {
      throw new UnauthorizedException('Yêu cầu xác thực tài khoản');
    }

    const rawRoles = user.roles || (user.role ? [user.role] : []);
    const roles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles])
      .map((r: any) => (typeof r === 'string' ? r.toLowerCase().trim() : ''))
      .filter(Boolean);

    // 1. ADMIN BYPASS: Quản trị viên tối cao luôn có toàn quyền
    if (user.isAdmin === true || roles.some((r) => this.allowedAdminRoles.includes(r))) {
      return true;
    }

    // 2. Lấy danh sách quyền yêu cầu từ metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredAnyPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 3. STAFF ROLE CHECK: Nhân viên quản trị
    if (roles.includes('staff')) {
      const userPermissions: string[] = Array.isArray(user.permissions)
        ? user.permissions
        : [];

      // Kiểm tra RequireAnyPermissions nếu có
      if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
        const hasAny = requiredAnyPermissions.some((perm) =>
          userPermissions.includes(perm),
        );
        if (hasAny) {
          return true;
        }
      }

      // Kiểm tra RequirePermissions (all) nếu có
      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAll = requiredPermissions.every((perm) =>
          userPermissions.includes(perm),
        );
        if (hasAll) {
          return true;
        }
        throw new ForbiddenException(
          `Truy cập bị từ chối: Bạn không có quyền thực hiện thao tác này (${requiredPermissions.join(', ')})`,
        );
      }

      // Nếu có requiredAny nhưng không đạt
      if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
        throw new ForbiddenException(
          `Truy cập bị từ chối: Bạn không có quyền thực hiện thao tác này (${requiredAnyPermissions.join(', ')})`,
        );
      }

      // Endpoint nhạy cảm chỉ dành riêng cho Admin
      throw new ForbiddenException('Truy cập bị từ chối: Yêu cầu quyền quản trị viên tối cao');
    }

    // 4. USER / CUSTOMER: Không được phép truy cập API quản trị
    throw new ForbiddenException('Truy cập bị từ chối: Yêu cầu quyền quản trị');
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  private allowedAdminRoles = ['admin', 'super-admin', 'superadmin'];

  constructor(private reflector?: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.status === false) {
      throw new UnauthorizedException('Yêu cầu xác thực tài khoản');
    }

    const rawRoles = user.roles || (user.role ? [user.role] : []);
    const roles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles])
      .map((r: any) => (typeof r === 'string' ? r.toLowerCase().trim() : ''))
      .filter(Boolean);

    // 1. Admin bypass: Toàn quyền
    if (user.isAdmin === true || roles.some((r) => this.allowedAdminRoles.includes(r))) {
      return true;
    }

    // 2. Nếu có Reflector và người dùng là Staff -> kiểm tra granular permissions
    if (this.reflector && roles.includes('staff')) {
      const userPermissions: string[] = Array.isArray(user.permissions)
        ? user.permissions
        : [];

      // Kiểm tra RequireAnyPermissions trước
      const requiredAnyPermissions = this.reflector.getAllAndOverride<string[]>(
        PERMISSIONS_ANY_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
        const hasAny = requiredAnyPermissions.some((perm) =>
          userPermissions.includes(perm),
        );
        if (hasAny) {
          return true;
        }
      }

      // Kiểm tra RequirePermissions (all)
      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
        PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAll = requiredPermissions.every((perm) =>
          userPermissions.includes(perm),
        );
        if (hasAll) {
          return true;
        }
        throw new ForbiddenException(
          `Truy cập bị từ chối: Bạn không có quyền thực hiện thao tác này (${requiredPermissions.join(', ')})`,
        );
      }

      // Nếu có requiredAny nhưng không đạt
      if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
        throw new ForbiddenException(
          `Truy cập bị từ chối: Bạn không có quyền thực hiện thao tác này (${requiredAnyPermissions.join(', ')})`,
        );
      }
    }

    // 3. Thiếu quyền quản trị hoặc không đủ permissions
    throw new ForbiddenException('Truy cập bị từ chối: Yêu cầu quyền quản trị');
  }
}

export {
  RequirePermissions,
  RequireAnyPermissions,
  PERMISSIONS_KEY,
  PERMISSIONS_ANY_KEY,
} from './decorators/require-permissions.decorator';
