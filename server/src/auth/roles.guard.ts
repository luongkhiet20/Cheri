import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  private roles = ['admin'];
  constructor() {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Forbidden: Requires Admin role');
    }

    const adminEmails = (process.env.ADMIN_EMAILS || 'contact.cheri@gmail.com,admin@example.com')
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
