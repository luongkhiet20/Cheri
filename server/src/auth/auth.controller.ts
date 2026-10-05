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

import { RolesGuard, AdminJwtAuthGuard } from './roles.guard';
import { AuthCredentialDto } from './dto/auth-credential.dto';
import { AuthService } from './auth.service';
import { User } from './models/user.model';
import { GetUser } from './utils/get-user.decorator';
import { GoogleUserDto } from './dto/google-user.dto';

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
  } {
    const roles = Array.isArray(user.roles) ? [...user.roles] : (user as any).role ? [(user as any).role] : ['user'];
    return {
      id: user._id,
      email: user.email,
      roles,
      name: user.name || (user as any).fullName || user.email.split('@')[0],
      fullName: (user as any).fullName || user.name || user.email.split('@')[0],
      phoneNumber: (user as any).phoneNumber || '',
      address: (user as any).address || '',
      gender: (user as any).gender || '',
      avatar: (user as any).avatar || '',
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('/profile')
  async updateProfile(@GetUser() user: User, @Body() body: any) {
    const updated = await this.authService.updateUser(user._id.toString(), body);
    const roles = Array.isArray(updated.roles) ? [...updated.roles] : (updated as any).role ? [(updated as any).role] : ['user'];
    return {
      id: updated._id,
      email: updated.email,
      roles,
      name: updated.name || (updated as any).fullName || updated.email.split('@')[0],
      fullName: (updated as any).fullName || updated.name || updated.email.split('@')[0],
      phoneNumber: (updated as any).phoneNumber || '',
      address: (updated as any).address || '',
      gender: (updated as any).gender || '',
      avatar: (updated as any).avatar || '',
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
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleLoginCallback(@Req() req, @Res() res) {
    const googleUserDto: GoogleUserDto = req.user;
    const accessToken = await this.authService.signInGoogle(googleUserDto);
    const tokenUrl = process.env.ORIGIN + '/jwtToken/' + accessToken;
    res.redirect(tokenUrl);
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
