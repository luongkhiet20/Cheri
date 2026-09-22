import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

import { GoogleUserDto } from './dto/google-user.dto';
import { User } from './models/user.model';
import { JwtPayload } from './models/jwt-payload.interface';
import { AuthCredentialDto } from './dto/auth-credential.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async signUp(authCredentialsDto: AuthCredentialDto): Promise<void> {
    const { email, password, name, fullName, phoneNumber, address, gender, dateOfBirth, avatar } = authCredentialsDto;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : '';

    if (!cleanEmail || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(cleanEmail)) {
      throw new BadRequestException('Email phải đúng định dạng @gmail.com mới được đăng ký');
    }

    const userExist = await this.userModel.findOne({ email: cleanEmail });
    if (userExist) {
      throw new ConflictException('Username already exist');
    }
    const resolvedName = fullName || name || cleanEmail.split('@')[0];
    const user = new this.userModel({
      ...authCredentialsDto,
      email: cleanEmail,
      phoneNumber: cleanPhone || '',
      name: resolvedName,
      fullName: resolvedName,
      address: address || '',
      gender: gender || '',
      dateOfBirth: dateOfBirth || '',
      avatar: avatar || '',
      roles: ['user'],
      status: true,
    });
    user.salt = await bcrypt.genSalt();
    user.password = await this.hashPassword(password, user.salt);

    try {
      await user.save();
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Username already exist');
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  async signIn(
    authCredentialsDto: AuthCredentialDto,
  ): Promise<{
    accessToken: string;
    id: string;
    email: string;
    roles?: string[];
  }> {
    const { email, password } = authCredentialsDto;
    const user = await this.userModel.findOne({ email });
    const loggedUser = user && (await this.validatePassword(password, user));
    const userEmail = loggedUser ? user.email : null;
    if (!userEmail) {
      throw new UnauthorizedException('Invalid credential');
    }

    const adminEmails = (process.env.ADMIN_EMAILS || 'contact.cheri@gmail.com,admin@example.com')
      .split(',')
      .map((e) => e.trim().toLowerCase());
    if (adminEmails.includes(user.email.toLowerCase()) && (!user.roles || !user.roles.includes('admin'))) {
      user.roles = [...(user.roles || []), 'admin'];
      await this.userModel.updateOne({ _id: user._id }, { $addToSet: { roles: 'admin' } });
    }

    const payload: JwtPayload = { email };
    const accessToken = await this.jwtService.sign(payload);

    return { accessToken, id: user._id, roles: user.roles, email };
  }

  async signInGoogle(googleUserDto: GoogleUserDto) {
    const { email, profile } = googleUserDto;
    const user = await this.userModel.findOne({ email });

    if (!user) {
      const googleUser = await new this.userModel({
        email,
        googleId: profile.id,
      });
      googleUser.save();
    }

    const payload: JwtPayload = { email };
    const accessToken: string = await this.jwtService.sign(payload);

    return accessToken;
  }

  async getGoogleUser(email: string, profile: any) {
    const user = this.userModel.findOne({ email });
    const googleUser =
      user || (await new this.userModel({ email, googleId: profile.id }));

    return googleUser;
  }

  private async hashPassword(password: string, salt: string): Promise<string> {
    return bcrypt.hash(password, salt);
  }

  private async validatePassword(
    password: string,
    user: User,
  ): Promise<boolean> {
    const hash = await bcrypt.hash(password, user.salt);
    return hash === user.password;
  }

  async getAllUsers(): Promise<any[]> {
    return this.userModel.find({}).sort({ createdAt: -1, dateAdded: -1 }).exec();
  }

  async createUser(userData: any): Promise<any> {
    const {
      email,
      password,
      name,
      fullName,
      phoneNumber,
      address,
      gender,
      dateOfBirth,
      avatar,
      roles,
      status,
      description,
      images,
      cart,
    } = userData;
    const existing = await this.userModel.findOne({ email });
    if (existing) {
      throw new ConflictException('Email đã tồn tại trong hệ thống');
    }
    const resolvedName = fullName || name || email.split('@')[0];
    const user = new this.userModel({
      email,
      name: resolvedName,
      fullName: resolvedName,
      phoneNumber: phoneNumber || '',
      address: address || '',
      gender: gender || '',
      dateOfBirth: dateOfBirth || '',
      avatar: avatar || '',
      roles: roles && roles.length ? roles : ['admin'],
      status: status !== undefined ? status : true,
      description: description || '',
      images: images || [],
      cart: cart || { items: [] },
    });
    if (password) {
      user.salt = await bcrypt.genSalt();
      user.password = await this.hashPassword(password, user.salt);
    }
    await user.save();
    return user.toObject();
  }

  async updateUser(id: string, updateData: any): Promise<any> {
    const dataToUpdate = { ...updateData };
    if (dataToUpdate.email) {
      const existing = await this.userModel.findOne({
        email: dataToUpdate.email,
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException('Email đã tồn tại trong hệ thống');
      }
    }
    if (dataToUpdate.fullName && !dataToUpdate.name) {
      dataToUpdate.name = dataToUpdate.fullName;
    } else if (dataToUpdate.name && !dataToUpdate.fullName) {
      dataToUpdate.fullName = dataToUpdate.name;
    }
    if (dataToUpdate.password && dataToUpdate.password.trim()) {
      const salt = await bcrypt.genSalt();
      dataToUpdate.password = await this.hashPassword(dataToUpdate.password, salt);
      dataToUpdate.salt = salt;
    } else {
      delete dataToUpdate.password;
      delete dataToUpdate.salt;
    }
    return this.userModel
      .findByIdAndUpdate(id, { $set: dataToUpdate }, { new: true })
      .exec();
  }

  async deleteUser(id: string): Promise<any> {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}

