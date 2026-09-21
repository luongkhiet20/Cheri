import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  UseGuards,
  Get,
  Put,
  Delete,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { RolesGuard } from './roles.guard';
import { AuthCredentialDto } from './dto/auth-credential.dto';
import { AuthService } from './auth.service';
import { User } from './models/user.model';
import { GetUser } from './utils/get-user.decorator';
import { GoogleUserDto } from './dto/google-user.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('/users')
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('/users')
  async createUser(@Body() body: any) {
    return this.authService.createUser(body);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Put('/users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.authService.updateUser(id, body);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
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
  } {
    const adminEmails = (process.env.ADMIN_EMAILS || 'contact.cheri@gmail.com,admin@example.com')
      .split(',')
      .map((e) => e.trim().toLowerCase());
    const roles = Array.isArray(user.roles) ? [...user.roles] : [];
    if (user.email && adminEmails.includes(user.email.toLowerCase()) && !roles.includes('admin')) {
      roles.push('admin');
    }
    return { id: user._id, email: user.email, roles };
  }

  @Post('/signup')
  signUp(
    @Body(ValidationPipe) authCredentialsDto: AuthCredentialDto,
  ): Promise<void> {
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
