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

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const queryOrigin = req.query?.origin;
    let origin: string | undefined;

    if (queryOrigin && typeof queryOrigin === 'string') {
      origin = queryOrigin;
    } else if (req.headers?.referer) {
      try {
        origin = new URL(req.headers.referer).origin;
      } catch {}
    }

    if (!origin) {
      origin = process.env.ORIGIN || 'http://localhost:3000';
    }

    if (req.session) {
      req.session.returnOrigin = origin;
    }

    return {
      state: origin,
    };
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const res = context.switchToHttp().getResponse();
      const req = context.switchToHttp().getRequest();
      let feOrigin = process.env.ORIGIN || 'http://localhost:3000';
      const state = req.query?.state as string;
      if (state && (state.startsWith('http://') || state.startsWith('https://'))) {
        feOrigin = state.replace(/\/+$/, '');
      } else if (req.session?.returnOrigin) {
        feOrigin = req.session.returnOrigin.replace(/\/+$/, '');
      }
      return res.redirect(`${feOrigin}/vi/authorize/signin?error=google_auth_failed`);
    }
    return user;
  }
}


