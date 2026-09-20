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
    if (user && user.roles && Array.isArray(user.roles) && user.roles.some((role) => this.roles.includes(role))) {
      return true;
    }

    throw new UnauthorizedException('Forbidden: Requires Admin role');
  }
}
