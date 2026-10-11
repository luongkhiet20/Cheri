import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

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
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: process.env.JWT_EXPIRATION,
      },
    }),
  ],
  controllers: [AuthController, UsersController, AccountController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, SessionSerializer],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
