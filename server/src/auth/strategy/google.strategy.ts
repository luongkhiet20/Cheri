import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { GoogleUserDto } from '../dto/google-user.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    // Khi dev local: dùng LOCAL_SERVER_URL hoặc http://localhost:4000
    // Khi production (Render): SERVER_URL đã có sẵn trong biến môi trường
    const serverUrl = process.env.LOCAL_SERVER_URL || process.env.SERVER_URL || 'http://localhost:4000';
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'not_configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not_configured',
      callbackURL: serverUrl.replace(/\/+$/, '') + '/api/auth/google/callback',
      passReqToCallback: true,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    request: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ) {
    const emails = profile?.emails;
    const primaryEmail = Array.isArray(emails)
      ? emails.find((mail: any) => mail?.value) || emails[0]
      : null;

    if (!primaryEmail || !primaryEmail.value) {
      return done(new Error('Không thể lấy thông tin email từ tài khoản Google'), null);
    }

    const email = String(primaryEmail.value).trim().toLowerCase();
    const googleUserInfo: GoogleUserDto = { email, profile };

    done(null, googleUserInfo);
  }
}
