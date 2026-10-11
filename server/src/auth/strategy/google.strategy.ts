import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { GoogleUserDto } from '../dto/google-user.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'not_configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not_configured',
      callbackURL: (process.env.SERVER_URL || 'http://localhost:4000') + '/api/auth/google/callback',
      passReqToCallback: true,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    request: any,
    accessToken: string,
    refreshToken: string,
    profile,
    done: Function,
  ) {
    const { emails } = profile;
    const email = emails.filter((mail) => mail.value)[0].value;
    const googleUserInfo: GoogleUserDto = { email, profile };

    done(null, googleUserInfo);
  }
}
