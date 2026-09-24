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
    if (user) {
      return user;
    }
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    if (isDev) {
      return {
        _id: '6ab0da85a17b71225922440b',
        email: 'admin@example.com',
        name: 'admin',
        roles: ['admin', 'super-admin'],
      };
    }
    throw err || new UnauthorizedException('Forbidden: Requires Admin role');
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  private roles = ['admin', 'super-admin'];
  constructor() {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
      if (isDev) {
        request.user = {
          _id: '6ab0da85a17b71225922440b',
          email: 'admin@example.com',
          name: 'admin',
          roles: ['admin', 'super-admin'],
        };
        return true;
      }
      throw new UnauthorizedException('Forbidden: Requires Admin role');
    }

    const adminEmails = (
      process.env.ADMIN_EMAILS ||
      'contact.cheri@gmail.com,admin@example.com,luongkhiet20@gmail.com,luongkhiet200000@gmail.com,tinhvttk24411@st.uel.edu.vn,tinhvttk24418991@st.uel.edu.vn'
    )
      .split(',')
      .map((e) => e.trim().toLowerCase());

    if (user.email && adminEmails.includes(user.email.toLowerCase())) {
      return true;
    }

    const userRoles = user.roles || (user.role ? [user.role] : []);
    if (
      Array.isArray(userRoles) &&
      userRoles.some((role) => typeof role === 'string' && this.roles.includes(role.toLowerCase()))
    ) {
      return true;
    }

    throw new UnauthorizedException('Forbidden: Requires Admin role');
  }
}
