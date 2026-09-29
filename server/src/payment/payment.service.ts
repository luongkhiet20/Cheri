import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentMethod } from './models/payment.model';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment.dto';

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger('PaymentService');

  constructor(
    @InjectModel('PaymentMethod') private paymentModel: Model<PaymentMethod>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.paymentModel.countDocuments();
    this.logger.log(`PaymentService ready — collection 'payment_methods' có ${count} bản ghi.`);
  }

  // ─── Lấy tất cả (admin) ───
  async getAll(): Promise<PaymentMethod[]> {
    return this.paymentModel.find().sort({ createdAt: 1 }).lean();
  }

  // ─── Lấy đang hoạt động (public — dùng cho giỏ hàng) ───
  async getActive(): Promise<PaymentMethod[]> {
    return this.paymentModel.find({ isActive: true }).sort({ name: 1 }).lean();
  }

  // ─── Lấy theo ID ───
  async getById(id: string): Promise<PaymentMethod> {
    const method = await this.paymentModel.findById(id).lean();
    if (!method) throw new NotFoundException('Không tìm thấy phương thức thanh toán');
    return method;
  }

  // ─── Thêm mới ───
  async create(dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const created = new this.paymentModel({
      ...dto,
      code: dto.code.toUpperCase(),
      status: dto.isActive !== false ? 'ACTIVE' : 'INACTIVE',
    });
    return created.save();
  }

  // ─── Chỉnh sửa ───
  async update(id: string, dto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    const updated = await this.paymentModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        code: dto.code?.toUpperCase(),
        status: dto.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundException('Không tìm thấy phương thức thanh toán');
    return updated;
  }

  // ─── Bật / Tắt ───
  async toggle(id: string): Promise<PaymentMethod> {
    const method = await this.paymentModel.findById(id);
    if (!method) throw new NotFoundException('Không tìm thấy phương thức thanh toán');
    method.isActive = !method.isActive;
    method.status = method.isActive ? 'ACTIVE' : 'INACTIVE';
    return method.save();
  }

  // ─── Xóa một ───
  async delete(id: string): Promise<void> {
    const result = await this.paymentModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Không tìm thấy phương thức thanh toán');
  }

  // ─── Xóa nhiều (Bulk Delete) ───
  async deleteBulk(ids: string[]): Promise<{ deleted: number }> {
    const result = await this.paymentModel.deleteMany({ _id: { $in: ids } });
    return { deleted: result.deletedCount };
  }
}
