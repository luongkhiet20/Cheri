import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { GoogleUserDto } from '../dto/google-user.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    const serverUrl = (process.env.SERVER_URL || 'http://localhost:4000').replace(/\/+$/, '');
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${serverUrl}/api/auth/google/callback`,
      passReqToCallback: true,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    request: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<GoogleUserDto> {
    const emails = profile?.emails || [];
    const email =
      emails.find((mail: any) => mail?.value)?.value ||
      emails[0]?.value ||
      profile?._json?.email ||
      '';
    const googleUserInfo: GoogleUserDto = { email, profile };

    return googleUserInfo;
  }
}
