
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { FacebookUserDto } from '../dto/facebook-user.dto';

@Injectable()
export class FacebookStrategy extends PassportStrategy(
  Strategy,
  'facebook',
) {
  constructor(private readonly configService?: ConfigService) {
    const appId =
      configService?.get<string>('FACEBOOK_APP_ID') ||
      configService?.get<string>('FACEBOOK_CLIENT_ID') ||
      process.env.FACEBOOK_APP_ID ||
      process.env.FACEBOOK_CLIENT_ID;

    const appSecret =
      configService?.get<string>('FACEBOOK_APP_SECRET') ||
      configService?.get<string>('FACEBOOK_CLIENT_SECRET') ||
      process.env.FACEBOOK_APP_SECRET ||
      process.env.FACEBOOK_CLIENT_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        'Facebook OAuth configuration is missing. ' +
        'Please define FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env.',
      );
    }

    const serverUrl = (
      configService?.get<string>('SERVER_URL') ||
      process.env.SERVER_URL ||
      'http://localhost:4000'
    ).replace(/\/+$/, '');

    super({
      clientID: appId,
      clientSecret: appSecret,
      callbackURL: `${serverUrl}/api/auth/facebook/callback`,
      scope: ['email', 'public_profile'],
      profileFields: [
        'id',
        'displayName',
        'name',
        'photos',
        'email',
      ],
      graphAPIVersion: 'v20.0',
      passReqToCallback: true,
    });
  }

  async validate(
    request: any,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<FacebookUserDto> {
    const emails = profile?.emails || [];

    const email =
      emails.find((mail: any) => mail?.value)?.value ||
      emails[0]?.value ||
      (profile as any)?._json?.email ||
      '';

    const facebookUserInfo: FacebookUserDto = {
      email,
      profile,
    };

    return facebookUserInfo;
  }
}
