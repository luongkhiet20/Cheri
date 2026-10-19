import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';
import { AccountController } from './account.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt.strategy';
import { GoogleStrategy } from './strategy/google.strategy';
import UserSchema from './schemas/user.schema';
import PasswordResetSchema from './schemas/password-reset.schema';
import { SessionSerializer } from './utils/session.serializer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'PasswordReset', schema: PasswordResetSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('Thiếu cấu hình biến môi trường bắt buộc: JWT_SECRET');
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRATION') || process.env.JWT_EXPIRATION || '7d',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, UsersController, AccountController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, SessionSerializer],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
