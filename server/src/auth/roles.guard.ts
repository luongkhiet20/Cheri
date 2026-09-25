import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

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

