import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
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
import * as cloudinary from 'cloudinary';
import * as streamifier from 'streamifier';
import * as fs from 'fs';
import * as path from 'path';
import {
  randomInt,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from 'crypto';
import { sendPasswordResetOtp } from '../shared/utils/email/mailer';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

@Injectable()
export class AuthService {
  constructor(
  @InjectModel('User') private userModel: Model<User>,
  @InjectModel('PasswordReset') private passwordResetModel: Model<any>,
  private jwtService: JwtService,
) {}

  async signUp(authCredentialsDto: AuthCredentialDto): Promise<{
    accessToken: string;
    id: string;
    roles: string[];
    email: string;
    name: string;
    fullName: string;
  }> {
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
      if (error.code === '23505' || error.code === 11000) {
        throw new ConflictException('Username already exist');
      } else {
        throw new InternalServerErrorException();
      }
    }

    const payload: JwtPayload = { email: user.email, id: user._id.toString(), roles: user.roles };
    const accessToken = await this.jwtService.sign(payload);

    return {
      accessToken,
      id: user._id.toString(),
      roles: user.roles,
      email: user.email,
      name: user.name,
      fullName: user.fullName,
    };
  }

  async signIn(
    authCredentialsDto: AuthCredentialDto,
  ): Promise<{
    accessToken: string;
    id: string;
    email: string;
    roles?: string[];
    name?: string;
    fullName?: string;
    avatar?: string;
    avatarUrl?: string;
    images?: any[];
  }> {
    const { email, password } = authCredentialsDto;
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = await this.userModel.findOne({ email: cleanEmail });
    const loggedUser = user && (await this.validatePassword(password, user));
    const userEmail = loggedUser ? user.email : null;
    if (!userEmail) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status === false) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động');
    }

    const payload: JwtPayload = { email: user.email, id: user._id.toString(), roles: user.roles };
    const accessToken = await this.jwtService.sign(payload);

    const rawAvatar = user.avatar || (user as any).avatarUrl || ((user as any).images?.[0]?.url || (user as any).images?.[0]) || '';
    const images = Array.isArray((user as any).images) && (user as any).images.length > 0 ? (user as any).images : rawAvatar ? [rawAvatar] : [];

    return {
      accessToken,
      id: user._id.toString(),
      roles: user.roles,
      email: user.email,
      name: user.name || (user as any).fullName || user.email.split('@')[0],
      fullName: (user as any).fullName || user.name || user.email.split('@')[0],
      avatar: rawAvatar,
      avatarUrl: rawAvatar,
      images,
    };
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

    if (!email || !email.trim()) {
      throw new BadRequestException('Vui lòng cung cấp email hợp lệ');
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email: cleanEmail });
    if (existing) {
      throw new ConflictException('Email đã tồn tại trong hệ thống');
    }

    const resolvedName = (fullName || name || cleanEmail.split('@')[0] || 'User').trim();
    const cleanDateOfBirth = dateOfBirth ? String(dateOfBirth).trim() : '';
    if (cleanDateOfBirth) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (cleanDateOfBirth > todayStr) {
        throw new BadRequestException('Ngày sinh không hợp lệ: Không được chọn ngày trong tương lai');
      }
      if (cleanDateOfBirth < '1900-01-01') {
        throw new BadRequestException('Ngày sinh không hợp lệ: Ngày sinh không được nhỏ hơn 01/01/1900');
      }
    }

    const resolvedRoles = Array.isArray(roles) && roles.length
      ? roles
      : typeof roles === 'string' && roles
      ? [roles]
      : ['user'];

    const user = new this.userModel({
      email: cleanEmail,
      name: resolvedName,
      fullName: resolvedName,
      phoneNumber: (phoneNumber || '').trim(),
      address: (address || '').trim(),
      gender: gender || 'Khác',
      dateOfBirth: cleanDateOfBirth,
      avatar: (avatar || '').trim(),
      roles: resolvedRoles,
      status: status !== undefined ? Boolean(status) : true,
      description: (description || '').trim(),
      images: Array.isArray(images) ? images : avatar ? [avatar] : [],
      cart: cart || { items: [] },
    });

    const rawPassword = (password && password.trim()) || 'Cheri@123456';
    user.salt = await bcrypt.genSalt();
    user.password = await this.hashPassword(rawPassword, user.salt);

    try {
      await user.save();
      return user.toObject();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('Thông tin người dùng bị trùng lặp trong cơ sở dữ liệu');
      }
      throw new BadRequestException(err.message || 'Lỗi khi lưu người dùng vào CSDL');
    }
  }

  async updateUser(id: string, updateData: any): Promise<any> {
    const dataToUpdate = { ...updateData };
    if (dataToUpdate.email) {
      dataToUpdate.email = dataToUpdate.email.trim().toLowerCase();
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
    if (dataToUpdate.dateOfBirth !== undefined) {
      const cleanDob = dataToUpdate.dateOfBirth ? String(dataToUpdate.dateOfBirth).trim() : '';
      if (cleanDob) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (cleanDob > todayStr) {
          throw new BadRequestException('Ngày sinh không hợp lệ: Không được chọn ngày trong tương lai');
        }
        if (cleanDob < '1900-01-01') {
          throw new BadRequestException('Ngày sinh không hợp lệ: Ngày sinh không được nhỏ hơn 01/01/1900');
        }
      }
      dataToUpdate.dateOfBirth = cleanDob;
    }
    if (dataToUpdate.password && dataToUpdate.password.trim()) {
      const salt = await bcrypt.genSalt();
      dataToUpdate.password = await this.hashPassword(dataToUpdate.password, salt);
      dataToUpdate.salt = salt;
    } else {
      delete dataToUpdate.password;
      delete dataToUpdate.salt;
    }
    try {
      return await this.userModel
        .findByIdAndUpdate(id, { $set: dataToUpdate }, { new: true })
        .exec();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('Thông tin người dùng bị trùng lặp trong cơ sở dữ liệu');
      }
      throw new BadRequestException(err.message || 'Lỗi khi cập nhật dữ liệu lên CSDL');
    }
  }

  async deleteUser(id: string): Promise<any> {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async getUserById(id: string): Promise<any> {
    return this.userModel.findById(id).exec();
  }

  async bulkDeleteUsers(ids: string[]): Promise<any> {
    return this.userModel.deleteMany({ _id: { $in: ids } }).exec();
  }

  async getUserOrders(userId: string): Promise<any[]> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const conditions: any[] = [];
    if (isValidObjectId(userId)) {
      const objId = new Types.ObjectId(userId);
      conditions.push({ _user: objId }, { userId: objId });
    }
    conditions.push({ _user: userId }, { userId });

    if (user.email) {
      conditions.push({ customerEmail: user.email }, { 'customer.email': user.email });
    }

    const orders = await this.userModel.db
      .collection('orders')
      .find({ $or: conditions })
      .sort({ createdAt: -1, dateAdded: -1 })
      .toArray();

    return orders.map((o: any) => ({
      ...o,
      id: o._id?.toString() || o.id,
      code: o.orderId || ('#' + String(o._id).slice(-6).toUpperCase()),
      totalAmount: o.totalAmount ?? o.amount ?? o.subtotal ?? o.total ?? 0,
      payment: o.paymentMethodSnapshot?.name || o.payment?.provider || o.payment?.method || o.type || 'COD',
      status: o.status,
      createdAt: o.createdAt || o.dateAdded,
    }));
  }

  async uploadAvatar(user: User, file: any): Promise<any> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Định dạng ảnh không hợp lệ. Chỉ chấp nhận jpg, jpeg, png, webp');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('Ảnh đại diện không được vượt quá 5MB');
    }

    let avatarUrl = '';

    const isCloudinaryConfigured =
      process.env.CLOUDINARY_NAME &&
      process.env.CLOUDINARY_KEY &&
      process.env.CLOUDINARY_SECRET &&
      !process.env.CLOUDINARY_KEY.includes('dummy') &&
      !process.env.CLOUDINARY_KEY.includes('placeholder');

    if (isCloudinaryConfigured) {
      try {
        const uploaded: any = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.v2.uploader.upload_stream(
            {
              folder: 'cheri/avatars',
              resource_type: 'image',
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            },
          );
          streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
        avatarUrl = uploaded.secure_url || uploaded.url;
      } catch (cldErr: any) {
        console.warn('Cloudinary avatar upload error, fallback to local storage:', cldErr?.message || cldErr);
      }
    }

    if (!avatarUrl) {
      try {
        const uploadDir = path.join(process.cwd(), 'server', 'uploads', 'avatars');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const ext = path.extname(file.originalname) || `.${file.mimetype.split('/')[1] || 'png'}`;
        const filename = `avatar-${user._id}-${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, file.buffer);
        const serverUrl = process.env.SERVER_URL || 'http://localhost:4000';
        avatarUrl = `${serverUrl}/uploads/avatars/${filename}`;
      } catch (fsErr: any) {
        console.warn('Local file write failed, fallback to data URI:', fsErr?.message || fsErr);
        const b64 = file.buffer.toString('base64');
        avatarUrl = `data:${file.mimetype};base64,${b64}`;
      }
    }

    const updated = await this.userModel.findByIdAndUpdate(
      user._id,
      { $set: { avatar: avatarUrl } },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    const roles = Array.isArray(updated.roles)
      ? [...updated.roles]
      : (updated as any).role
      ? [(updated as any).role]
      : ['user'];

    return {
      id: updated._id,
      email: updated.email,
      roles,
      name: updated.name || (updated as any).fullName || updated.email.split('@')[0],
      fullName: (updated as any).fullName || updated.name || updated.email.split('@')[0],
      phoneNumber: (updated as any).phoneNumber || '',
      address: (updated as any).address || '',
      gender: (updated as any).gender || '',
      avatar: updated.avatar || avatarUrl,
      avatarUrl: updated.avatar || avatarUrl,
    };
  }

async requestPasswordReset(email: string): Promise<{ message: string }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const message =
    'Nếu email này đã đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi nếu đủ điều kiện.';

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new BadRequestException('Email không hợp lệ');
  }

  const user = await this.userModel.findOne({ email: cleanEmail });

  // Trả thông báo giống nhau để hạn chế dò tìm email có tài khoản.
  if (!user) {
    return { message };
  }

  const existing = await this.passwordResetModel.findOne({
    email: cleanEmail,
  });

  // Giới hạn gửi lại: mỗi email chỉ được yêu cầu OTP mới sau 60 giây.
  if (
    existing &&
    existing.createdAt &&
    Date.now() - new Date(existing.createdAt).getTime() < 60_000
  ) {
    return { message };
  }

  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret || secret.length < 32) {
    throw new InternalServerErrorException(
      'Password reset is not configured',
    );
  }

  const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const otpHash = createHmac('sha256', secret)
    .update(`${cleanEmail}:${otp}`)
    .digest('hex');

  // Lưu OTP trước khi gửi; OTP hết hạn sau 5 phút.
  await this.passwordResetModel.findOneAndUpdate(
    { email: cleanEmail },
    {
      $set: {
        otpHash,
        expiresAt: new Date(Date.now() + 5 * 60_000),
        attempts: 0,
        verified: false,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
      $setOnInsert: { email: cleanEmail },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  try {
    await sendPasswordResetOtp(cleanEmail, otp);
  } catch (error) {
    // Không để OTP vừa tạo tiếp tục được sử dụng nếu email gửi thất bại.
    await this.passwordResetModel.deleteOne({ email: cleanEmail });
    throw new InternalServerErrorException(
      'Không thể gửi email xác minh lúc này',
    );
  }

  return { message };
}
async verifyPasswordResetOtp(
  email: string,
  otp: string,
): Promise<{ message: string; resetToken: string }> {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!/^\d{6}$/.test(otp || '')) {
    throw new BadRequestException('Mã OTP không hợp lệ');
  }

  const record = await this.passwordResetModel.findOne({
    email: cleanEmail,
  });

  if (!record || record.verified) {
    throw new BadRequestException(
      'OTP không hợp lệ hoặc đã hết hạn',
    );
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await this.passwordResetModel.deleteOne({ email: cleanEmail });
    throw new BadRequestException('Mã OTP đã hết hạn');
  }

  if (record.attempts >= 5) {
    await this.passwordResetModel.deleteOne({ email: cleanEmail });
    throw new BadRequestException(
      'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.',
    );
  }

  const secret = process.env.PASSWORD_RESET_SECRET;

  if (!secret || secret.length < 32) {
    throw new InternalServerErrorException(
      'Password reset is not configured',
    );
  }

  const submittedHash = createHmac('sha256', secret)
    .update(`${cleanEmail}:${otp}`)
    .digest('hex');

  const expected = Buffer.from(record.otpHash, 'hex');
  const submitted = Buffer.from(submittedHash, 'hex');

  const isValid =
    expected.length === submitted.length &&
    timingSafeEqual(expected, submitted);

  if (!isValid) {
    await this.passwordResetModel.updateOne(
      { _id: record._id },
      { $inc: { attempts: 1 } },
    );

    throw new BadRequestException('Mã OTP không chính xác');
  }

  const resetToken = randomBytes(32).toString('hex');

  const resetTokenHash = createHmac('sha256', secret)
    .update(`${cleanEmail}:${resetToken}`)
    .digest('hex');

  await this.passwordResetModel.updateOne(
    { _id: record._id },
    {
      $set: {
        verified: true,
        resetTokenHash,
        resetTokenExpiresAt: new Date(Date.now() + 10 * 60_000),
      },
    },
  );

  return {
    message: 'Xác minh OTP thành công',
    resetToken,
  };
}
async resetPassword(
  email: string,
  resetToken: string,
  newPassword: string,
): Promise<{ message: string }> {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !resetToken || !newPassword) {
    throw new BadRequestException('Vui lòng nhập đầy đủ thông tin');
  }

  if (newPassword.length < 8) {
    throw new BadRequestException(
      'Mật khẩu mới phải có ít nhất 8 ký tự',
    );
  }

  const secret = process.env.PASSWORD_RESET_SECRET;

  if (!secret || secret.length < 32) {
    throw new InternalServerErrorException(
      'Password reset is not configured',
    );
  }

  const record = await this.passwordResetModel.findOne({
    email: cleanEmail,
    verified: true,
  });

  if (
    !record ||
    !record.resetTokenHash ||
    !record.resetTokenExpiresAt ||
    new Date(record.resetTokenExpiresAt).getTime() <= Date.now()
  ) {
    throw new BadRequestException(
      'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
    );
  }

  const submittedHash = createHmac('sha256', secret)
    .update(`${cleanEmail}:${resetToken}`)
    .digest('hex');

  const expected = Buffer.from(record.resetTokenHash, 'hex');
  const submitted = Buffer.from(submittedHash, 'hex');

  const isValid =
    expected.length === submitted.length &&
    timingSafeEqual(expected, submitted);

  if (!isValid) {
    throw new BadRequestException('Phiên đặt lại mật khẩu không hợp lệ');
  }

  const user = await this.userModel.findOne({ email: cleanEmail });

  if (!user) {
    throw new BadRequestException('Không tìm thấy tài khoản');
  }

  const salt = await bcrypt.genSalt();
  const hashedPassword = await this.hashPassword(newPassword, salt);

  user.salt = salt;
  user.password = hashedPassword;
  await user.save();

  await this.passwordResetModel.deleteOne({ _id: record._id });

  return { message: 'Đặt lại mật khẩu thành công' };
}
}


