import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

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
export class RolesGuard implements CanActivate {
  private allowedRoles = ['admin', 'super-admin'];
  constructor() {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.status === false) {
      throw new UnauthorizedException('Yêu cầu xác thực tài khoản quản trị');
    }

    const userRoles = user.roles || (user.role ? [user.role] : []);
    if (
      Array.isArray(userRoles) &&
      userRoles.some((role) => typeof role === 'string' && this.allowedRoles.includes(role.toLowerCase()))
    ) {
      return true;
    }

    throw new UnauthorizedException('Truy cập bị từ chối: Yêu cầu quyền quản trị');
  }
}

