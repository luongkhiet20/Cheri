import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShippingMethod } from './models/shipping.model';
import { CreateShippingMethodDto, UpdateShippingMethodDto } from './dto/shipping.dto';

// ─── Dữ liệu giả lập 5 phương thức vận chuyển phổ biến tại Việt Nam ───
const SEED_SHIPPING_METHODS = [
  {
    name: 'Viettel Post',
    code: 'VIETTEL_POST',
    baseCost: 30000,
    estimatedDays: '2–4 ngày làm việc',
    coverageArea: 'national',
    freeShippingThreshold: 500000,
    isActive: true,
    description: 'Dịch vụ chuyển phát của Viettel, phủ sóng toàn quốc với mạng lưới rộng khắp 63 tỉnh thành.',
  },
  {
    name: 'SPX Express (Shopee)',
    code: 'SPX_EXPRESS',
    baseCost: 25000,
    estimatedDays: '1–3 ngày làm việc',
    coverageArea: 'national',
    freeShippingThreshold: 300000,
    isActive: true,
    description: 'Dịch vụ vận chuyển của Shopee, tốc độ nhanh, theo dõi đơn hàng theo thời gian thực.',
  },
  {
    name: 'GHN Express',
    code: 'GHN_EXPRESS',
    baseCost: 28000,
    estimatedDays: '1–2 ngày làm việc',
    coverageArea: 'national',
    freeShippingThreshold: 400000,
    isActive: true,
    description: 'Giao Hàng Nhanh — đơn vị vận chuyển chuyên nghiệp, giao nhanh nội thành trong ngày.',
  },
  {
    name: 'J&T Express',
    code: 'JT_EXPRESS',
    baseCost: 22000,
    estimatedDays: '2–5 ngày làm việc',
    coverageArea: 'national',
    freeShippingThreshold: 500000,
    isActive: true,
    description: 'Dịch vụ J&T Express với mức giá cạnh tranh, thích hợp cho đơn hàng khối lượng lớn.',
  },
  {
    name: 'Grab Express',
    code: 'GRAB_EXPRESS',
    baseCost: 35000,
    estimatedDays: 'Hỏa tốc — giao trong 2 giờ',
    coverageArea: 'regional',
    freeShippingThreshold: 0,
    isActive: false,
    description: 'Giao hàng hỏa tốc qua ứng dụng Grab. Hiện chỉ áp dụng tại các thành phố lớn.',
  },
];

@Injectable()
export class ShippingService implements OnModuleInit {
  private readonly logger = new Logger('ShippingService');

  constructor(
    @InjectModel('ShippingMethod') private shippingModel: Model<ShippingMethod>,
  ) {}

  // ─── CSDL gốc đã có sẵn data trong collection 'shippingmethods' ───
  // Không cần seed thêm nữa
  async onModuleInit(): Promise<void> {
    const count = await this.shippingModel.countDocuments();
    this.logger.log(`ShippingService ready — collection 'shippingmethods' có ${count} bản ghi.`);
  }

  // ─── Lấy tất cả phương thức ───
  async getAll(): Promise<ShippingMethod[]> {
    return this.shippingModel.find().sort({ createdAt: 1 }).lean();
  }

  // ─── Lấy danh sách đang hoạt động (public) ───
  async getActive(): Promise<ShippingMethod[]> {
    return this.shippingModel.find({ isActive: true }).sort({ baseCost: 1 }).lean();
  }

  // ─── Lấy theo ID ───
  async getById(id: string): Promise<ShippingMethod> {
    const method = await this.shippingModel.findById(id).lean();
    if (!method) throw new NotFoundException('Không tìm thấy phương thức vận chuyển');
    return method;
  }

  // ─── Thêm mới ───
  async create(dto: CreateShippingMethodDto): Promise<ShippingMethod> {
    const created = new this.shippingModel({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return created.save();
  }

  // ─── Chỉnh sửa ───
  async update(id: string, dto: UpdateShippingMethodDto): Promise<ShippingMethod> {
    const updated = await this.shippingModel
      .findByIdAndUpdate(id, { ...dto, code: dto.code?.toUpperCase() }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Không tìm thấy phương thức vận chuyển');
    return updated;
  }

  // ─── Bật / Tắt ───
  async toggle(id: string): Promise<ShippingMethod> {
    const method = await this.shippingModel.findById(id);
    if (!method) throw new NotFoundException('Không tìm thấy phương thức vận chuyển');
    method.isActive = !method.isActive;
    return method.save();
  }

  // ─── Xóa ───
  async delete(id: string): Promise<void> {
    const result = await this.shippingModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Không tìm thấy phương thức vận chuyển');
  }

  // ─── Xóa nhiều (Bulk Delete) ───
  async deleteBulk(ids: string[]): Promise<{ deleted: number }> {
    const result = await this.shippingModel.deleteMany({ _id: { $in: ids } });
    return { deleted: result.deletedCount };
  }
}
