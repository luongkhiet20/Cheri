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
  } {
    const roles = Array.isArray(user.roles) ? [...user.roles] : (user as any).role ? [(user as any).role] : ['user'];
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
