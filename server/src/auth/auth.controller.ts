import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  UseGuards,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';

import { RolesGuard, AdminJwtAuthGuard, GoogleAuthGuard, FacebookAuthGuard } from './roles.guard';
import { AuthCredentialDto } from './dto/auth-credential.dto';
import { AuthService } from './auth.service';
import { User } from './models/user.model';
import { GetUser } from './utils/get-user.decorator';
import { GoogleUserDto } from './dto/google-user.dto';
import { FacebookUserDto } from './dto/facebook-user.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/users')
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/users')
  async createUser(@Body() body: any) {
    return this.authService.createUser(body);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Put('/users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.authService.updateUser(id, body);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  getUser(@GetUser() user: User): {
    id: string;
    email: string;
    roles: string[];
    name?: string;
    fullName?: string;
    phoneNumber?: string;
    address?: string;
    gender?: string;
    avatar?: string;
    avatarUrl?: string;
    images?: any[];
  } {
    const roles = Array.isArray(user.roles) ? [...user.roles] : (user as any).role ? [(user as any).role] : ['user'];
    const rawAvatar = (user as any).avatar || (user as any).avatarUrl || ((user as any).images?.[0]?.url || (user as any).images?.[0]) || '';
    const images = Array.isArray((user as any).images) && (user as any).images.length > 0 ? (user as any).images : rawAvatar ? [rawAvatar] : [];
    return {
      id: user._id,
      email: user.email,
      roles,
      name: user.name || (user as any).fullName || user.email.split('@')[0],
      fullName: (user as any).fullName || user.name || user.email.split('@')[0],
      phoneNumber: (user as any).phoneNumber || '',
      address: (user as any).address || '',
      gender: (user as any).gender || '',
      avatar: rawAvatar,
      avatarUrl: rawAvatar,
      images,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('/profile')
  async updateProfile(@GetUser() user: User, @Body() body: any) {
    const updated = await this.authService.updateUser(user._id.toString(), body);
    const roles = Array.isArray(updated.roles) ? [...updated.roles] : (updated as any).role ? [(updated as any).role] : ['user'];
    const rawAvatar = (updated as any).avatar || (updated as any).avatarUrl || ((updated as any).images?.[0]?.url || (updated as any).images?.[0]) || '';
    const images = Array.isArray((updated as any).images) && (updated as any).images.length > 0 ? (updated as any).images : rawAvatar ? [rawAvatar] : [];
    return {
      id: updated._id,
      email: updated.email,
      roles,
      name: updated.name || (updated as any).fullName || updated.email.split('@')[0],
      fullName: (updated as any).fullName || updated.name || updated.email.split('@')[0],
      phoneNumber: (updated as any).phoneNumber || '',
      address: (updated as any).address || '',
      gender: (updated as any).gender || '',
      avatar: rawAvatar,
      avatarUrl: rawAvatar,
      images,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadAvatar(
    @GetUser() user: User,
    @UploadedFile() file: any,
  ) {
    return this.authService.uploadAvatar(user, file);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async patchAvatar(
    @GetUser() user: User,
    @UploadedFile() file: any,
  ) {
    return this.authService.uploadAvatar(user, file);
  }

  @Post('/signup')
  signUp(
    @Body(ValidationPipe) authCredentialsDto: AuthCredentialDto,
  ): Promise<{
    accessToken: string;
    id: string;
    email: string;
    roles?: string[];
    name?: string;
    fullName?: string;
  }> {
    return this.authService.signUp(authCredentialsDto);
  }

  @Post('/signin')
  signIn(
    @Body(ValidationPipe) authCredentialsDto: AuthCredentialDto,
  ): Promise<{
    accessToken: string;
    id: string;
    email: string;
    roles?: string[];
  }> {
    return this.authService.signIn(authCredentialsDto);
  }

  @Get('/google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {}

  @Get('/google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleLoginCallback(@Req() req, @Res() res) {
    if (res.headersSent) {
      return;
    }
    try {
      const googleUserDto: GoogleUserDto = req.user;
      let feOrigin = process.env.ORIGIN || 'http://localhost:3000';
      const state = req.query?.state as string;
      if (state && (state.startsWith('http://') || state.startsWith('https://')) && !state.includes('google.com')) {
        feOrigin = state.replace(/\/+$/, '');
      } else if (req.session?.returnOrigin && !req.session.returnOrigin.includes('google.com')) {
        feOrigin = req.session.returnOrigin.replace(/\/+$/, '');
      }

      if (!googleUserDto || !googleUserDto.email) {
        return res.redirect(`${feOrigin}/vi/authorize/signin?error=google_auth_failed`);
      }

      const accessToken = await this.authService.signInGoogle(googleUserDto);

      res.cookie('accessToken', accessToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: false,
        sameSite: 'lax',
      });
      if (req.session) {
        req.session.accessToken = accessToken;
        req.session.token = accessToken;
      }

      const tokenUrl = `${feOrigin}/jwtToken/${accessToken}`;
      return res.redirect(tokenUrl);
    } catch (err: any) {
      console.error('Google OAuth callback error:', err?.message || err);
      let feOrigin = process.env.ORIGIN || 'http://localhost:3000';
      const state = req.query?.state as string;
      if (state && (state.startsWith('http://') || state.startsWith('https://')) && !state.includes('google.com')) {
        feOrigin = state.replace(/\/+$/, '');
      } else if (req.session?.returnOrigin && !req.session.returnOrigin.includes('google.com')) {
        feOrigin = req.session.returnOrigin.replace(/\/+$/, '');
      }

      const isAccountLocked = err?.message?.toLowerCase().includes('khóa');
      const isConflict =
        err?.message?.toLowerCase().includes('mật khẩu') ||
        err?.message?.toLowerCase().includes('tồn tại');

      const errorCode = isAccountLocked
        ? 'account_disabled'
        : isConflict
        ? 'email_conflict'
        : 'google_login_error';

      return res.redirect(`${feOrigin}/vi/authorize/signin?error=${errorCode}`);
    }
  }

  @Get('/facebook')
  @UseGuards(FacebookAuthGuard)
  facebookLogin() {}

  @Get('/facebook/callback')
  @UseGuards(FacebookAuthGuard)
  async facebookLoginCallback(@Req() req, @Res() res) {
    if (res.headersSent) {
      return;
    }
    try {
      const facebookUserDto: FacebookUserDto = req.user;
      let feOrigin = process.env.ORIGIN || 'http://localhost:3000';
      const state = req.query?.state as string;
      if (
        state &&
        (state.startsWith('http://') || state.startsWith('https://')) &&
        !state.includes('facebook.com') &&
        !state.includes('fb.com')
      ) {
        feOrigin = state.replace(/\/+$/, '');
      } else if (
        req.session?.returnOrigin &&
        !req.session.returnOrigin.includes('facebook.com') &&
        !req.session.returnOrigin.includes('fb.com')
      ) {
        feOrigin = req.session.returnOrigin.replace(/\/+$/, '');
      }

      if (!facebookUserDto || !facebookUserDto.email) {
        return res.redirect(`${feOrigin}/vi/authorize/signin?error=facebook_email_required`);
      }

      const accessToken = await this.authService.signInFacebook(facebookUserDto);

      res.cookie('accessToken', accessToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: false,
        sameSite: 'lax',
      });
      if (req.session) {
        req.session.accessToken = accessToken;
        req.session.token = accessToken;
      }

      const tokenUrl = `${feOrigin}/jwtToken/${accessToken}`;
      return res.redirect(tokenUrl);
    } catch (err: any) {
      console.error('Facebook OAuth callback error:', err?.message || err);
      let feOrigin = process.env.ORIGIN || 'http://localhost:3000';
      const state = req.query?.state as string;
      if (
        state &&
        (state.startsWith('http://') || state.startsWith('https://')) &&
        !state.includes('facebook.com') &&
        !state.includes('fb.com')
      ) {
        feOrigin = state.replace(/\/+$/, '');
      } else if (
        req.session?.returnOrigin &&
        !req.session.returnOrigin.includes('facebook.com') &&
        !req.session.returnOrigin.includes('fb.com')
      ) {
        feOrigin = req.session.returnOrigin.replace(/\/+$/, '');
      }

      const isAccountLocked = err?.message?.toLowerCase().includes('khóa');
      const isConflict =
        err?.message?.toLowerCase().includes('mật khẩu') ||
        err?.message?.toLowerCase().includes('tồn tại') ||
        err?.message?.toLowerCase().includes('liên kết');
      const isMissingEmail = err?.message?.toLowerCase().includes('email');

      const errorCode = isAccountLocked
        ? 'account_disabled'
        : isConflict
        ? 'email_conflict'
        : isMissingEmail
        ? 'facebook_email_required'
        : 'facebook_login_error';

      return res.redirect(`${feOrigin}/vi/authorize/signin?error=${errorCode}`);
    }
  }

  @Post('/signout')
  signOut(@Req() req, @Res() res) {
    if (req.session) {
      req.session.destroy(() => {});
    }
    res.clearCookie('jwt');
    res.clearCookie('token');
    res.clearCookie('accessToken');
    res.clearCookie('connect.sid');
    return res.status(200).json({ success: true, message: 'Signed out successfully' });
  }

  @Get('/signout')
  signOutGet(@Req() req, @Res() res) {
    return this.signOut(req, res);
  }
}
