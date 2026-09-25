import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../models/jwt-payload.interface';
import { Model } from 'mongoose';
import { User } from '../models/user.model';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel('User') private userModel: Model<User>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => {
          if (!req) return null;
          let token = null;
          if (req.cookies) {
            token = req.cookies['jwt'] || req.cookies['token'] || req.cookies['accessToken'];
          }
          if (!token && req.session) {
            token = req.session.token || req.session.accessToken;
          }
          return token;
        },
      ]),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const { email } = payload;
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    if (user.status === false) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động');
    }

    return user;
  }
}
