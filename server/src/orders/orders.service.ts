import { Logger, Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, MethodNotAllowedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import Stripe from 'stripe';
import { buildPublicTrackingResponse } from './tracking-response.cjs';

import { Order, OrderStatus, PaymentStatus, ReturnRequestStatus, RefundStatus } from './models/order.model';
import * as fs from 'fs';
import { join } from 'path';
import { User } from '../auth/models/user.model';
import { OrderDto } from './dto/order.dto';
import { sendMsg } from '../shared/utils/email/mailer';
import { Translation } from '../translations/translation.model';
import { prepareCart } from '../shared/utils/prepareUtils';
import { Cart } from '../cart/utils/cart';

const secret = process.env.STRIPE_SECRETKEY;
export const stripe = new Stripe(secret, { apiVersion: '2020-08-27' });

@Injectable()
export class OrdersService {
  private logger = new Logger('OrdersService');

  private addressCache = {
    provinces: null as any[] | null,
    districts: new Map<string, any[]>(),
    wards: new Map<string, any[]>(),
  };

  constructor(
    @InjectModel('Order') private orderModel: Model<Order>,
    @InjectModel('Translation') private translationModel: Model<Translation>,
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('ProductVariant') private variantModel: Model<any>,
    @InjectModel('ShippingMethod') private shippingMethodModel: Model<any>,
    @InjectModel('PaymentMethod') private paymentMethodModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('Coupon') private couponModel: Model<any>,
    @InjectModel('Category') private categoryModel: Model<any>,
    @InjectModel('Interaction') private interactionModel?: Model<any>,
  ) {}

  /**
   * Tự động ghi nhận sự kiện PURCHASE vào user_interactions phục vụ huấn luyện Machine Learning.
   * Sử dụng cơ chế idempotent upsert để tránh ghi trùng khi cập nhật đơn hàng.
   */
  private async recordPurchaseInteractions(order: any): Promise<void> {
    if (!this.interactionModel || !order || !Array.isArray(order.items)) return;
    try {
      const orderCode = order.orderId || String(order._id);
      const userId = order.userId
        ? (isValidObjectId(order.userId) ? new Types.ObjectId(String(order.userId)) : null)
        : null;

      for (const it of order.items) {
        const rawPid = it.productId || it.id || it.item?._id;
        if (rawPid && isValidObjectId(rawPid)) {
          const productObjectId = new Types.ObjectId(String(rawPid));
          await this.interactionModel.updateOne(
            {
              orderId: orderCode,
              productId: productObjectId,
              eventType: 'PURCHASE',
            },
            {
              $setOnInsert: {
                userId,
                sessionId: order.sessionId || null,
                productId: productObjectId,
                variantId: it.variantId || null,
                orderId: orderCode,
                eventType: 'PURCHASE',
                timestamp: new Date(),
                isSynthetic: false,
                datasetType: 'real',
                metadata: {
                  isSynthetic: false,
                  source: 'order_checkout',
                  price: it.price || it.unitPrice || 0,
                  quantity: it.quantity || 1,
                },
              },
            },
            { upsert: true },
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to record purchase interaction for order ${order.orderId}: ${err.message}`);
    }
  }

  async validateCoupon(code: string, subtotal: number): Promise<{
    valid: boolean;
    code?: string;
    description?: string;
    discountType?: string;
    discountValue?: number;
    discountAmount?: number;
    maxDiscount?: number;
    minOrderValue?: number;
    startDate?: Date;
    endDate?: Date;
    usageLimit?: number;
    usedCount?: number;
    message: string;
  }> {
    if (!code || !code.trim()) {
      return { valid: false, message: 'Vui lòng nhập mã giảm giá' };
    }

    const cleanCode = code.trim().toUpperCase();
    await this.ensureDefaultCoupons();

    // 1. Kiểm tra mã tồn tại trong CSDL
    const coupon = await this.couponModel.findOne({ code: cleanCode });

    if (!coupon) {
      return { valid: false, message: 'Mã giảm giá không tồn tại hoặc không hợp lệ' };
    }

    // 2. Trạng thái hoạt động (isActive)
    if (!coupon.isActive) {
      return { valid: false, message: 'Mã giảm giá hiện đang tạm ngừng hoạt động' };
    }

    // 3. Ngày bắt đầu (startDate)
    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      const startFormatted = new Date(coupon.startDate).toLocaleDateString('vi-VN');
      return { valid: false, message: `Chương trình ưu đãi chỉ bắt đầu từ ${startFormatted}` };
    }

    // 4. Ngày kết thúc (endDate)
    if (coupon.endDate && new Date(coupon.endDate) < now) {
      const endFormatted = new Date(coupon.endDate).toLocaleDateString('vi-VN');
      return { valid: false, message: `Mã giảm giá đã hết hạn sử dụng (hết hạn ngày ${endFormatted})` };
    }

    // 5. Giới hạn lượt sử dụng (usageLimit & usedCount)
    if (coupon.usageLimit > 0 && (coupon.usedCount || 0) >= coupon.usageLimit) {
      return { valid: false, message: 'Mã giảm giá đã hết lượt sử dụng' };
    }

    // 6. Giá trị đơn tối thiểu (minOrderValue)
    if (coupon.minOrderValue > 0 && subtotal < coupon.minOrderValue) {
      const minFormatted = coupon.minOrderValue.toLocaleString('vi-VN');
      const diffFormatted = (coupon.minOrderValue - subtotal).toLocaleString('vi-VN');
      return {
        valid: false,
        message: `Mã ${cleanCode} chỉ áp dụng cho đơn hàng từ ${minFormatted} ₫ trở lên (cần thêm ${diffFormatted} ₫)`,
      };
    }

    // 7. Công thức tính tiền giảm:
    let discountAmount = 0;
    const discountVal = Number(coupon.discountValue) || 0;

    if (coupon.discountType === 'PERCENTAGE') {
      // Trường hợp 1: D = min(B * (r / 100), M)
      discountAmount = Math.round((subtotal * discountVal) / 100);
      const maxCap = Number(coupon.maxDiscount) || 0;
      if (maxCap > 0 && discountAmount > maxCap) {
        discountAmount = maxCap;
      }
    } else {
      // Trường hợp 2: D = min(F, B)
      discountAmount = discountVal;
    }

    // Không vượt quá tổng tiền hàng đủ điều kiện B
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }
    if (discountAmount < 0) {
      discountAmount = 0;
    }

    return {
      valid: true,
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      maxDiscount: coupon.maxDiscount || 0,
      minOrderValue: coupon.minOrderValue || 0,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      usageLimit: coupon.usageLimit || 0,
      usedCount: coupon.usedCount || 0,
      message: 'Áp dụng mã giảm giá thành công!',
    };
  }

  private async ensureDefaultCoupons(): Promise<void> {
    try {
      const count = await this.couponModel.countDocuments();
      if (count === 0) {
        await this.couponModel.insertMany([
          {
            code: 'CHERI10',
            description: 'Giảm 10% tối đa 100.000₫ cho đơn hàng từ 200.000₫',
            discountType: 'PERCENTAGE',
            discountValue: 10,
            maxDiscount: 100000,
            minOrderValue: 200000,
            isActive: true,
          },
          {
            code: 'CHERI50K',
            description: 'Giảm ngay 50.000₫ cho đơn hàng từ 300.000₫',
            discountType: 'FIXED',
            discountValue: 50000,
            minOrderValue: 300000,
            isActive: true,
          },
          {
            code: 'WELCOME',
            description: 'Ưu đãi khách hàng mới giảm 20.000₫ từ 100.000₫',
            discountType: 'FIXED',
            discountValue: 20000,
            minOrderValue: 100000,
            isActive: true,
          },
        ]);
        this.logger.log('Default coupons initialized successfully');
      }
    } catch (e) {
      this.logger.warn('Could not initialize default coupons: ' + e.message);
    }
  }

  async getProvinces(): Promise<any[]> {
    if (this.addressCache.provinces && this.addressCache.provinces.length > 0) {
      return this.addressCache.provinces;
    }
    try {
      const res = await fetch('https://provinces.open-api.vn/api/v1/p/');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.addressCache.provinces = data;
      return data;
    } catch (err) {
      this.logger.error('Error fetching provinces: ' + err.message);
      return [];
    }
  }

  async getDistricts(provinceCode: string): Promise<any[]> {
    const key = String(provinceCode);
    if (this.addressCache.districts.has(key)) {
      return this.addressCache.districts.get(key) || [];
    }
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/v1/p/${key}?depth=2`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const districts = (data && data.districts) ? data.districts : [];
      this.addressCache.districts.set(key, districts);
      return districts;
    } catch (err) {
      this.logger.error(`Error fetching districts for province ${key}: ` + err.message);
      return [];
    }
  }

  async getWards(districtCode: string): Promise<any[]> {
    const key = String(districtCode);
    if (this.addressCache.wards.has(key)) {
      return this.addressCache.wards.get(key) || [];
    }
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/v1/d/${key}?depth=2`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const wards = (data && data.wards) ? data.wards : [];
      this.addressCache.wards.set(key, wards);
      return wards;
    } catch (err) {
      this.logger.error(`Error fetching wards for district ${key}: ` + err.message);
      return [];
    }
  }

  // ─── Lấy orders của user ──────────────────────────────────────────────────
  async getOrders(user: User): Promise<Order[]> {
    const userConditions: any[] = [{ _user: user._id }, { userId: user._id }];
    if (isValidObjectId(user._id)) {
      const objId = new Types.ObjectId(user._id);
      userConditions.push({ _user: objId }, { userId: objId });
    }

    const orders = await this.orderModel
      .find({ $or: userConditions })
      .sort({ dateAdded: -1, createdAt: -1 });
    return orders;
  }

  // ─── Hủy đơn hàng (User / Khách hàng sở hữu đơn hàng) ──────────────────────
  async cancelOrder(
    id: string,
    payload: { reason?: string; reasonDetail?: string } | string,
    user: User,
  ): Promise<any> {
    const rawReason = typeof payload === 'string' ? payload : (payload?.reason || '');
    const rawDetail = typeof payload === 'object' ? (payload?.reasonDetail || '') : '';

    const parsedReason = rawReason.trim();
    const parsedDetail = rawDetail.trim();

    // 1. Kiểm tra lý do hủy
    if (!parsedReason) {
      throw new BadRequestException('Vui lòng chọn lý do hủy đơn hàng.');
    }

    if (parsedReason.startsWith('Lý do khác')) {
      if (!parsedDetail) {
        throw new BadRequestException('Vui lòng nhập nội dung lý do hủy cụ thể.');
      }
      if (parsedDetail.length < 3) {
        throw new BadRequestException('Nội dung lý do hủy phải có ít nhất 3 ký tự.');
      }
    }

    const idQuery = isValidObjectId(id)
      ? { $or: [{ orderId: id }, { _id: new Types.ObjectId(id) }] }
      : { orderId: id };

    const order: any = await this.orderModel.findOne(idQuery);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng cần hủy.');
    }

    // 2. Backend xác minh quyền sở hữu đơn hàng (hoặc admin)
    const orderUserId = (order.userId || order._user)?.toString();
    const currentUserId = user?._id?.toString();
    const orderEmail = (order.customerEmail || order.customer?.email || '').toLowerCase().trim();
    const userEmail = (user?.email || '').toLowerCase().trim();

    const userRoles = (user as any)?.roles || (user as any)?.role || [];
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
    const isAdmin = roles.some((r: any) => typeof r === 'string' && r.toLowerCase().includes('admin'));

    const isOwner = (orderUserId && currentUserId && orderUserId === currentUserId) ||
      (orderEmail && userEmail && orderEmail === userEmail);

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Bạn không có quyền hủy đơn hàng này.');
    }

    // 3. Backend xác minh trạng thái thực tế: chỉ cho phép hủy khi là PENDING / NEW / Chờ xác nhận
    const rawStatus = (order.status || '').toUpperCase().trim();
    if (rawStatus !== 'PENDING' && rawStatus !== 'NEW' && rawStatus !== 'CHỜ XÁC NHẬN') {
      throw new BadRequestException('Đơn hàng hiện không ở trạng thái Chờ xác nhận, không thể hủy.');
    }

    // 4. Cập nhật các trường dữ liệu hủy đơn hàng
    const cancelledAt = new Date();
    const cancelledBy = user?._id && isValidObjectId(user._id) ? new Types.ObjectId(user._id) : null;
    const fullCancelNote = parsedDetail
      ? `${parsedReason} - Chi tiết: ${parsedDetail}`
      : parsedReason;

    order.status = OrderStatus.CANCELLED;
    order.cancelReason = parsedReason;
    order.cancelReasonDetail = parsedDetail || null;
    order.cancelledAt = cancelledAt;
    order.cancelledBy = cancelledBy;

    // Ghi nhận vào notes (bảo toàn ghi chú cũ)
    order.notes = order.notes ? `${order.notes}\n[Hủy đơn]: ${fullCancelNote}` : `[Hủy đơn]: ${fullCancelNote}`;

    // Ghi nhận vào statusHistory
    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      status: OrderStatus.CANCELLED,
      updatedAt: cancelledAt,
      updatedBy: cancelledBy,
      note: fullCancelNote,
    });

    await order.save();
    return {
      success: true,
      message: 'Hủy đơn hàng thành công.',
      orderId: order.orderId,
      status: order.status,
      cancelReason: order.cancelReason,
      cancelReasonDetail: order.cancelReasonDetail,
      cancelledAt: order.cancelledAt,
      cancelledBy: order.cancelledBy,
      order,
    };
  }

  private saveBase64Image(dataUri: string, folderName = 'returns'): string | null {
    if (!dataUri || typeof dataUri !== 'string') return null;
    if (dataUri.startsWith('http://') || dataUri.startsWith('https://') || dataUri.startsWith('/uploads/')) {
      return dataUri;
    }
    const match = dataUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return null;
    try {
      const mime = match[1];
      const base64Data = match[2];
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const filename = `return_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const targetDir = join(process.cwd(), 'server', 'uploads', folderName);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(join(targetDir, filename), Buffer.from(base64Data, 'base64'));
      return `/uploads/${folderName}/${filename}`;
    } catch (e) {
      this.logger.error('Failed to save return image: ' + e?.message);
      return null;
    }
  }

  // ─── Yêu cầu Trả hàng / Hoàn tiền (Khách hàng sở hữu đơn hàng đã giao) ────
  async createReturnRequest(
    id: string,
    payload: any,
    user: User,
  ): Promise<any> {
    const idQuery = isValidObjectId(id)
      ? { $or: [{ orderId: id }, { _id: new Types.ObjectId(id) }] }
      : { orderId: id };

    const order: any = await this.orderModel.findOne(idQuery);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng cần yêu cầu đổi trả.');
    }

    // 1. Backend xác minh quyền sở hữu đơn hàng
    const orderUserId = (order.userId || order._user)?.toString();
    const currentUserId = user?._id?.toString();
    const orderEmail = (order.customerEmail || order.customer?.email || '').toLowerCase().trim();
    const userEmail = (user?.email || '').toLowerCase().trim();

    const isOwner = (orderUserId && currentUserId && orderUserId === currentUserId) ||
      (orderEmail && userEmail && orderEmail === userEmail);

    if (!isOwner) {
      throw new ForbiddenException('Bạn không có quyền gửi yêu cầu đổi trả cho đơn hàng này.');
    }

    // 2. Backend kiểm tra trạng thái thực tế: chỉ cho phép khi đã giao hàng (DELIVERED)
    const rawStatus = (order.status || '').toUpperCase().trim();
    if (rawStatus !== 'DELIVERED') {
      throw new BadRequestException('Chỉ có thể gửi yêu cầu trả hàng / hoàn tiền cho đơn hàng đã giao thành công.');
    }

    // 3. Chống gửi yêu cầu trùng lặp khi đang có yêu cầu PENDING
    const existingRequests: any[] = Array.isArray(order.returnRequests) ? order.returnRequests : [];
    const hasPending = existingRequests.some((r: any) => r.status === ReturnRequestStatus.PENDING) ||
      (order.returnRequest && order.returnRequest.status === 'PENDING');
    if (hasPending) {
      throw new ConflictException('Đơn hàng này đang có yêu cầu trả hàng / hoàn tiền chờ xử lý. Vui lòng chờ phản hồi từ Chéri trước khi gửi thêm yêu cầu mới.');
    }

    // 4. Kiểm tra lý do
    const reason = (payload?.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('Vui lòng chọn lý do yêu cầu trả hàng / hoàn tiền.');
    }

    // 5. Kiểm tra danh sách sản phẩm yêu cầu trả
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (items.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một sản phẩm cần trả hàng.');
    }

    // Tính toán phân bổ giảm giá thực tế của đơn hàng (nếu có)
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const orderSubtotal = Number(order.subtotal) || orderItems.reduce((acc: number, it: any) => acc + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
    const totalDiscounts = (Number(order.discountAmount) || 0) + (Number(order.couponDiscount) || 0);
    const discountRatio = orderSubtotal > 0 ? Math.min(1, Math.max(0, totalDiscounts / orderSubtotal)) : 0;

    // Xác minh từng sản phẩm, số lượng đã trả ở các yêu cầu trước đó
    const sanitizedItems: any[] = [];
    let totalRequestedAmount = 0;

    for (const item of items) {
      const pId = String(item.productId || item.id || '');
      const matchedOrderItem = orderItems.find((oi: any) => {
        const oiPid = String(oi.productId?._id || oi.productId || oi.id || '');
        return oiPid === pId;
      });

      if (!matchedOrderItem) {
        throw new BadRequestException(`Sản phẩm với mã ${pId} không tồn tại trong đơn hàng này.`);
      }

      const boughtQty = Number(matchedOrderItem.quantity) || 1;

      // Tính tổng số lượng sản phẩm này đã được yêu cầu trả ở các yêu cầu trước (ngoại trừ bị REJECTED hoặc CANCELLED)
      let previouslyReturnedQty = 0;
      for (const req of existingRequests) {
        if (req.status !== ReturnRequestStatus.REJECTED && req.status !== ReturnRequestStatus.CANCELLED) {
          for (const reqItem of (req.items || [])) {
            const reqPid = String(reqItem.productId?._id || reqItem.productId || reqItem.productSnapshot?.id || reqItem.productSnapshot?._id || '');
            if (reqPid === pId) {
              previouslyReturnedQty += Number(reqItem.quantity) || 0;
            }
          }
        }
      }

      const remainingAvailableQty = Math.max(0, boughtQty - previouslyReturnedQty);
      const returnQty = Number(item.quantity) || 1;

      if (returnQty <= 0) {
        throw new BadRequestException(`Số lượng trả cho sản phẩm "${matchedOrderItem.productSnapshot?.title || pId}" phải lớn hơn 0.`);
      }
      if (returnQty > remainingAvailableQty) {
        throw new BadRequestException(`Số lượng yêu cầu trả (${returnQty}) vượt quá số lượng còn đủ điều kiện trả (${remainingAvailableQty}) của sản phẩm "${matchedOrderItem.productSnapshot?.title || pId}".`);
      }

      const baseUnitPrice = Number(matchedOrderItem.unitPrice) || 0;
      // Giá sau khi phân bổ giảm giá thực tế của đơn hàng
      const effectiveUnitPrice = Math.max(0, Math.round(baseUnitPrice * (1 - discountRatio)));
      const lineSubtotal = effectiveUnitPrice * returnQty;
      totalRequestedAmount += lineSubtotal;

      const snapshotTitle = matchedOrderItem.productSnapshot?.title
        || matchedOrderItem.productSnapshot?.name
        || matchedOrderItem.title
        || matchedOrderItem.name
        || 'Sản phẩm';
      const snapshotSku = matchedOrderItem.productSnapshot?.sku
        || matchedOrderItem.sku
        || '';
      const snapshotImage = matchedOrderItem.productSnapshot?.image
        || matchedOrderItem.image
        || '';
      const snapshotVariant = matchedOrderItem.productSnapshot?.variant
        || matchedOrderItem.variant
        || { color: '', size: '', classification: '' };

      sanitizedItems.push({
        productId: matchedOrderItem.productId || matchedOrderItem.id,
        variantId: matchedOrderItem.variantId || null,
        productSnapshot: {
          title: snapshotTitle,
          name: snapshotTitle,
          sku: snapshotSku,
          image: snapshotImage,
          price: baseUnitPrice,
          variant: snapshotVariant,
        },
        quantity: returnQty,
        boughtQuantity: boughtQty,
        unitPrice: effectiveUnitPrice,
        subtotal: lineSubtotal,
        reason: item.reason || reason,
      });
    }

    // 6. Xử lý ảnh minh chứng (tối đa 5 ảnh, lưu vào disk)
    const rawImages = Array.isArray(payload?.images) ? payload.images : [];
    const savedImages: string[] = [];
    for (const img of rawImages.slice(0, 5)) {
      const saved = this.saveBase64Image(img);
      if (saved) savedImages.push(saved);
    }

    const requestedAt = new Date();
    const orderCode = order.orderId || String(order._id).slice(-6).toUpperCase();
    const requestId = `RET-${orderCode}-${Date.now().toString().slice(-4)}`;

    const newReturnRequest: any = {
      requestId,
      requestedAt,
      reason,
      description: String(payload?.description || '').trim(),
      images: savedImages,
      refundMethod: String(payload?.refundMethod || 'ORIGINAL_PAYMENT'),
      status: ReturnRequestStatus.PENDING,
      rejectionReason: '',
      items: sanitizedItems,
      returnShipping: {
        carrier: '',
        trackingCode: '',
        shippedAt: null,
        receivedAt: null,
        instructions: '',
      },
      inspection: {
        inspectedAt: null,
        inspectedBy: null,
        conditionNotes: '',
        isEligible: null,
        restocked: false,
      },
      refund: {
        status: RefundStatus.PENDING,
        requestedAmount: totalRequestedAmount,
        approvedAmount: 0,
        refundedAmount: 0,
        transactionId: '',
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        refundedAt: null,
        failureReason: '',
        notes: '',
      },
      history: [
        {
          action: 'CREATED',
          fromStatus: '',
          toStatus: ReturnRequestStatus.PENDING,
          updatedAt: requestedAt,
          updatedBy: user?._id || null,
          note: `Khách hàng gửi yêu cầu trả hàng / hoàn tiền cho ${sanitizedItems.length} sản phẩm. Tổng tiền đề nghị: ${totalRequestedAmount.toLocaleString('vi-VN')} đ`,
        },
      ],
    };

    if (!Array.isArray(order.returnRequests)) {
      order.returnRequests = [];
    }
    order.returnRequests.push(newReturnRequest);

    // Đồng bộ legacy returnRequest
    order.returnRequest = newReturnRequest;

    const noteEntry = `[Yêu cầu Trả hàng / Hoàn tiền - ${requestId}] Lý do: ${reason}. Số lượng món: ${sanitizedItems.length}. Đề nghị hoàn: ${totalRequestedAmount.toLocaleString('vi-VN')} đ`;
    order.notes = order.notes ? `${order.notes}\n${noteEntry}` : noteEntry;

    if (Array.isArray(order.statusHistory)) {
      order.statusHistory.push({
        status: order.status,
        updatedAt: requestedAt,
        note: `Khách hàng gửi yêu cầu đổi trả mã ${requestId}`,
        updatedBy: user?._id || null,
      });
    }

    // Chuẩn hóa và làm sạch dữ liệu các item cũ trong order để tránh lỗi validation khi lưu
    if (Array.isArray(order.items)) {
      for (const oi of order.items) {
        if (oi.productSnapshot) {
          if (!oi.productSnapshot.title) {
            oi.productSnapshot.title = oi.productSnapshot.name || oi.name || oi.title || 'Sản phẩm';
          }
          if (!oi.productSnapshot.sku) {
            oi.productSnapshot.sku = oi.sku || '';
          }
        }
      }
    }

    order.markModified('returnRequests');
    order.markModified('returnRequest');

    try {
      await order.save();
    } catch (saveErr: any) {
      this.logger.error(`Lỗi lưu đơn hàng khi tạo yêu cầu đổi trả (${orderCode}): ${saveErr?.message}`, saveErr?.stack);
      if (saveErr?.name === 'ValidationError') {
        const errorDetails = Object.values(saveErr.errors || {}).map((e: any) => e.message).join('; ');
        throw new BadRequestException(`Dữ liệu đơn hàng chưa hợp lệ: ${errorDetails}`);
      }
      throw saveErr;
    }

    return {
      success: true,
      message: 'Yêu cầu trả hàng / hoàn tiền đã được tiếp nhận thành công. Chéri sẽ kiểm tra và phản hồi sớm nhất.',
      data: newReturnRequest,
      order,
    };
  }

  // ─── Khách hàng: Hủy yêu cầu Trả hàng / Hoàn tiền (khi còn PENDING) ─────────
  async cancelReturnRequest(
    orderId: string,
    reqId: string,
    payload: { reason?: string },
    user: User,
  ): Promise<any> {
    const idQuery = isValidObjectId(orderId)
      ? { $or: [{ orderId: orderId }, { _id: new Types.ObjectId(orderId) }] }
      : { orderId: orderId };

    const order: any = await this.orderModel.findOne(idQuery);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng cần hủy yêu cầu đổi trả.');
    }

    // 1. Kiểm tra quyền sở hữu đơn hàng
    const orderUserId = (order.userId || order._user)?.toString();
    const currentUserId = user?._id?.toString();
    const orderEmail = (order.customerEmail || order.customer?.email || '').toLowerCase().trim();
    const userEmail = (user?.email || '').toLowerCase().trim();

    const isOwner = (orderUserId && currentUserId && orderUserId === currentUserId) ||
      (orderEmail && userEmail && orderEmail === userEmail);

    if (!isOwner) {
      throw new ForbiddenException('Bạn không có quyền hủy yêu cầu đổi trả cho đơn hàng này.');
    }

    // 2. Tìm yêu cầu trả hàng
    const requests: any[] = Array.isArray(order.returnRequests) ? order.returnRequests : [];
    let reqIndex = requests.findIndex((r: any) => r.requestId === reqId || String(r._id) === reqId);

    if (reqIndex === -1 && order.returnRequest && (order.returnRequest.requestId === reqId || reqId === 'latest')) {
      order.returnRequests = [order.returnRequest];
      reqIndex = 0;
    }

    if (reqIndex === -1) {
      throw new NotFoundException(`Không tìm thấy yêu cầu trả hàng với mã ${reqId}.`);
    }

    const req = order.returnRequests[reqIndex];

    // 3. Chỉ cho phép hủy khi đang ở trạng thái PENDING
    if (req.status !== ReturnRequestStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể hủy yêu cầu khi đang ở trạng thái Chờ duyệt. Yêu cầu này đã được tiếp nhận hoặc đã đóng.');
    }

    const now = new Date();
    const prevStatus = req.status;
    req.status = ReturnRequestStatus.CANCELLED;
    if (req.refund) {
      req.refund.status = RefundStatus.CANCELLED;
    }

    const cancelReason = (payload?.reason || '').trim() || 'Khách hàng chủ động hủy yêu cầu trả hàng / hoàn tiền.';

    if (!Array.isArray(req.history)) {
      req.history = [];
    }
    req.history.push({
      action: 'CANCELLED_BY_CUSTOMER',
      fromStatus: prevStatus,
      toStatus: ReturnRequestStatus.CANCELLED,
      updatedAt: now,
      updatedBy: user?._id || null,
      note: cancelReason,
    });

    // Đồng bộ legacy returnRequest
    if (order.returnRequest && (order.returnRequest.requestId === req.requestId || order.returnRequest.requestId === reqId)) {
      order.returnRequest = req;
    }

    if (Array.isArray(order.statusHistory)) {
      order.statusHistory.push({
        status: order.status,
        updatedAt: now,
        note: `Khách hàng hủy yêu cầu trả hàng / hoàn tiền mã ${req.requestId}. Lý do: ${cancelReason}`,
        updatedBy: user?._id || null,
      });
    }

    order.markModified('returnRequests');
    order.markModified('returnRequest');

    await order.save();

    return {
      success: true,
      message: 'Đã hủy yêu cầu trả hàng / hoàn tiền thành công.',
      data: req,
      order,
    };
  }

  // ─── Admin: Xử lý quy trình Trả hàng & Hoàn tiền ──────────────────────────
  async updateReturnRequestWorkflow(
    orderId: string,
    reqId: string,
    action: string,
    body: any,
    adminUser: any,
  ): Promise<any> {
    const idQuery = isValidObjectId(orderId)
      ? { $or: [{ orderId: orderId }, { _id: new Types.ObjectId(orderId) }] }
      : { orderId: orderId };

    const order: any = await this.orderModel.findOne(idQuery);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    const requests: any[] = Array.isArray(order.returnRequests) ? order.returnRequests : [];
    let reqIndex = requests.findIndex((r: any) => r.requestId === reqId || String(r._id) === reqId);

    // Nếu chưa có trong returnRequests nhưng có legacy returnRequest
    if (reqIndex === -1 && order.returnRequest && (order.returnRequest.requestId === reqId || reqId === 'legacy' || reqId === 'latest')) {
      order.returnRequests = [order.returnRequest];
      reqIndex = 0;
    }

    if (reqIndex === -1) {
      throw new NotFoundException(`Không tìm thấy yêu cầu trả hàng với mã ${reqId}.`);
    }

    const req = order.returnRequests[reqIndex];
    const now = new Date();

    switch ((action || '').toUpperCase()) {
      case 'APPROVE': {
        if (req.status !== ReturnRequestStatus.PENDING) {
          throw new BadRequestException(`Chỉ có thể duyệt yêu cầu khi đang ở trạng thái Chờ duyệt (PENDING). Trạng thái hiện tại: ${req.status}`);
        }
        const requestedAmt = Number(req.refund?.requestedAmount) || 0;
        const approvedAmt = Number(body?.approvedAmount) >= 0 ? Number(body.approvedAmount) : requestedAmt;

        req.status = ReturnRequestStatus.APPROVED;
        req.refund = req.refund || {};
        req.refund.approvedAmount = approvedAmt;
        if (body?.instructions) {
          req.returnShipping = req.returnShipping || {};
          req.returnShipping.instructions = String(body.instructions).trim();
        }

        req.history.push({
          action: 'APPROVED',
          fromStatus: ReturnRequestStatus.PENDING,
          toStatus: ReturnRequestStatus.APPROVED,
          updatedAt: now,
          updatedBy: adminUser?._id || null,
          note: `Admin duyệt yêu cầu. Số tiền duyệt dự kiến: ${approvedAmt.toLocaleString('vi-VN')} đ. ${body?.note || ''}`.trim(),
        });
        break;
      }

      case 'REJECT': {
        if (req.status === ReturnRequestStatus.COMPLETED || req.status === ReturnRequestStatus.CANCELLED) {
          throw new BadRequestException(`Không thể từ chối yêu cầu đã ở trạng thái ${req.status}`);
        }
        const reason = String(body?.reason || '').trim();
        if (!reason) {
          throw new BadRequestException('Từ chối yêu cầu bắt buộc phải có lý do cụ thể.');
        }

        const prevStatus = req.status;
        req.status = ReturnRequestStatus.REJECTED;
        req.rejectionReason = reason;
        req.refund = req.refund || {};
        req.refund.status = RefundStatus.NOT_REQUIRED;

        req.history.push({
          action: 'REJECTED',
          fromStatus: prevStatus,
          toStatus: ReturnRequestStatus.REJECTED,
          updatedAt: now,
          updatedBy: adminUser?._id || null,
          note: `Admin từ chối yêu cầu. Lý do: ${reason}`,
        });
        break;
      }

      case 'CUSTOMER_SHIPPED': {
        if (req.status !== ReturnRequestStatus.APPROVED && req.status !== ReturnRequestStatus.WAITING_FOR_RETURN_SHIPMENT) {
          throw new BadRequestException('Chỉ có thể xác nhận đã gửi hàng sau khi yêu cầu đã được duyệt.');
        }

        const prevStatus = req.status;
        req.status = ReturnRequestStatus.RETURN_SHIPPED;
        req.returnShipping = req.returnShipping || {};
        req.returnShipping.carrier = String(body?.carrier || req.returnShipping.carrier || '').trim();
        req.returnShipping.trackingCode = String(body?.trackingCode || req.returnShipping.trackingCode || '').trim();
        req.returnShipping.shippedAt = body?.shippedAt ? new Date(body.shippedAt) : now;

        req.history.push({
          action: 'CUSTOMER_SHIPPED',
          fromStatus: prevStatus,
          toStatus: ReturnRequestStatus.RETURN_SHIPPED,
          updatedAt: now,
          updatedBy: adminUser?._id || null,
          note: `Xác nhận khách đã gửi hàng hoàn. ĐVVC: ${req.returnShipping.carrier || 'Chưa rõ'}, Mã vận đơn: ${req.returnShipping.trackingCode || 'Chưa rõ'}`,
        });
        break;
      }

      case 'RECEIVE_GOODS': {
        if (req.status !== ReturnRequestStatus.RETURN_SHIPPED && req.status !== ReturnRequestStatus.APPROVED) {
          throw new BadRequestException('Chỉ có thể xác nhận đã nhận hàng sau khi đơn hàng hoàn đã được gửi hoặc duyệt.');
        }

        const prevStatus = req.status;
        req.status = ReturnRequestStatus.RETURN_RECEIVED;
        req.returnShipping = req.returnShipping || {};
        req.returnShipping.receivedAt = now;

        req.history.push({
          action: 'RECEIVE_GOODS',
          fromStatus: prevStatus,
          toStatus: ReturnRequestStatus.RETURN_RECEIVED,
          updatedAt: now,
          updatedBy: adminUser?._id || null,
          note: 'Chéri đã nhận kiện hàng hoàn từ khách hàng. Sẵn sàng chuyển qua bước kiểm tra sản phẩm.',
        });
        break;
      }

      case 'INSPECT_GOODS': {
        if (
          req.status !== ReturnRequestStatus.RETURN_RECEIVED &&
          req.status !== ReturnRequestStatus.RETURN_SHIPPED &&
          req.status !== ReturnRequestStatus.APPROVED
        ) {
          throw new BadRequestException('Chỉ có thể kiểm tra sản phẩm sau khi đã nhận được hàng hoàn.');
        }

        const prevStatus = req.status;
        req.status = ReturnRequestStatus.INSPECTED;
        const isEligible = Boolean(body?.isEligible !== false && body?.isEligible !== 'false');
        const conditionNotes = String(body?.conditionNotes || '').trim();
        const restock = Boolean(body?.restock);

        req.inspection = {
          inspectedAt: now,
          inspectedBy: adminUser?._id || null,
          conditionNotes,
          isEligible,
          restocked: restock,
        };

        req.refund = req.refund || {};
        if (isEligible) {
          const approvedAmount = Number(body?.approvedAmount) >= 0
            ? Number(body.approvedAmount)
            : (Number(req.refund?.approvedAmount) || Number(req.refund?.requestedAmount) || 0);
          req.refund.approvedAmount = approvedAmount;
          req.refund.status = RefundStatus.PENDING;

          // Cập nhật tồn kho nếu Admin xác nhận hàng đủ điều kiện nhập kho lại (Inventory Hook)
          if (restock) {
            for (const item of (req.items || [])) {
              try {
                const qtyToRestock = Number(item.quantity) || 0;
                if (qtyToRestock > 0) {
                  const vIdStr = item.variantId ? String(item.variantId).trim() : null;
                  const sku = item.productSnapshot?.sku || item.sku;
                  let variantUpdated = false;

                  // 1. Cập nhật ProductVariant collection
                  if (vIdStr && isValidObjectId(vIdStr)) {
                    const res = await this.variantModel.findByIdAndUpdate(vIdStr, {
                      $inc: { stock: qtyToRestock },
                    });
                    if (res) variantUpdated = true;
                  }

                  if (!variantUpdated && (sku || vIdStr)) {
                    const skuQuery = sku || vIdStr;
                    const res = await this.variantModel.findOneAndUpdate(
                      { sku: skuQuery },
                      { $inc: { stock: qtyToRestock } },
                    );
                    if (res) variantUpdated = true;
                  }

                  // 2. Cập nhật Product Model (cả quantity và stock)
                  const pId = item.productId;
                  if (pId && isValidObjectId(String(pId))) {
                    await this.productModel.findByIdAndUpdate(String(pId), {
                      $inc: { quantity: qtyToRestock, stock: qtyToRestock },
                    });

                    // Cập nhật subdocument embedded variants nếu có
                    if (sku) {
                      await this.productModel.updateOne(
                        { _id: new Types.ObjectId(String(pId)), 'variants.sku': sku },
                        { $inc: { 'variants.$.stock': qtyToRestock } },
                      );
                    }
                  }
                }
              } catch (restockErr) {
                this.logger.error('Lỗi khi hoàn kho sản phẩm: ' + restockErr?.message);
              }
            }
          }
        } else {
          req.refund.status = RefundStatus.NOT_REQUIRED;
          req.refund.approvedAmount = 0;
        }

        req.history.push({
          action: 'INSPECT_GOODS',
          fromStatus: prevStatus,
          toStatus: ReturnRequestStatus.INSPECTED,
          updatedAt: now,
          updatedBy: adminUser?._id || null,
          note: `Kiểm tra sản phẩm: ${isEligible ? 'Đủ điều kiện hoàn tiền' : 'Không đủ điều kiện'}. Ghi chú: ${conditionNotes || 'Không có'}. ${restock ? 'Đã cộng hoàn lại tồn kho.' : ''}`,
        });
        break;
      }

      case 'PROCESS_REFUND': {
        // Phải phân biệt rõ COD và Thanh toán trước, tuân thủ nguyên tắc an toàn
        const paymentMethod = (order.payment?.method || order.paymentMethodSnapshot?.method || '').toUpperCase();
        const paymentStatus = (order.payment?.status || order.paymentStatus || '').toUpperCase();
        const codCollected = Boolean(order.payment?.codCollected);

        // 1. Kiểm tra điều kiện thu tiền thực tế
        let actualCollected = Number(order.payment?.actualCollectedAmount) || 0;

        if (paymentMethod === 'COD') {
          if (!codCollected && paymentStatus !== 'PAID') {
            throw new BadRequestException(
              'Đơn hàng COD chưa có xác nhận đã thu tiền thực tế (chưa đối soát COD). Vui lòng cập nhật đối soát COD trước khi thực hiện hoàn tiền.',
            );
          }
          if (actualCollected <= 0) {
            actualCollected = Number(order.totalAmount) || Number(order.total) || 0;
          }
        } else {
          // Thanh toán trước (BANK_TRANSFER, STRIPE, ONEPAY, MOMO, PAYPAL, etc.)
          if (paymentStatus !== 'PAID' && paymentStatus !== 'PARTIALLY_REFUNDED') {
            throw new BadRequestException(
              'Đơn hàng thanh toán trực tuyến chưa hoàn tất thanh toán thành công (Trạng thái: ' + (paymentStatus || 'UNPAID') + '). Không thể thực hiện hoàn tiền.',
            );
          }
          if (actualCollected <= 0) {
            actualCollected = Number(order.totalAmount) || Number(order.total) || 0;
          }
        }

        // 2. Kiểm tra số tiền có thể hoàn
        const totalRefundedSoFar = Number(order.payment?.refundedAmount) || 0;
        const remainingRefundable = Math.max(0, actualCollected - totalRefundedSoFar);

        const refundAmt = Number(body?.refundAmount) > 0
          ? Number(body.refundAmount)
          : (Number(req.refund?.approvedAmount) || Number(req.refund?.requestedAmount) || 0);

        if (refundAmt <= 0) {
          throw new BadRequestException('Số tiền hoàn phải lớn hơn 0.');
        }

        if (refundAmt > remainingRefundable) {
          throw new BadRequestException(
            `Số tiền hoàn (${refundAmt.toLocaleString('vi-VN')} đ) vượt quá số tiền thực tế đã thu còn có thể hoàn (${remainingRefundable.toLocaleString('vi-VN')} đ).`,
          );
        }

        // 3. Ghi nhận giao dịch hoàn tiền
        const txId = String(body?.transactionId || `RFD-${order.orderId || String(order._id).slice(-6)}-${Date.now().toString().slice(-4)}`).trim();
        const bankName = String(body?.bankName || '').trim();
        const accountNumber = String(body?.accountNumber || '').trim();
        const accountHolder = String(body?.accountHolder || '').trim();
        const notes = String(body?.notes || '').trim();

        req.refund = req.refund || {};
        const prevReqStatus = req.status;
        req.refund.status = RefundStatus.COMPLETED;
        req.refund.refundedAmount = refundAmt;
        req.refund.transactionId = txId;
        req.refund.bankName = bankName;
        req.refund.accountNumber = accountNumber;
        req.refund.accountHolder = accountHolder;
        req.refund.refundedAt = now;
        req.refund.notes = notes;

        // Trạng thái trả hàng hoàn tất
        req.status = ReturnRequestStatus.COMPLETED;

        // Cập nhật Order payment
        order.payment = order.payment || {};
        const newTotalRefunded = totalRefundedSoFar + refundAmt;
        order.payment.refundedAmount = newTotalRefunded;
        order.payment.refundedAt = now;
        order.refundedAmount = newTotalRefunded;
        order.refundedAt = now;

        // Tính tổng số lượng sản phẩm đặt hàng ban đầu của đơn
        const totalOrderedQty = Array.isArray(order.items) && order.items.length > 0
          ? order.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)
          : (Number(order.cart?.totalQty) || 0);

        // Tính tổng số lượng sản phẩm hoàn trả thành công từ tất cả yêu cầu đã COMPLETED
        const allRequests: any[] = Array.isArray(order.returnRequests) ? order.returnRequests : [];
        let totalReturnedQty = 0;
        for (const r of allRequests) {
          if (r.status === ReturnRequestStatus.COMPLETED || r.requestId === req.requestId) {
            for (const it of (r.items || [])) {
              totalReturnedQty += (Number(it.quantity) || 0);
            }
          }
        }

        // Quy tắc cập nhật trạng thái đơn hàng cha (order.status):
        // - Trả hết toàn bộ sản phẩm: order.status = RETURNED & paymentStatus = REFUNDED
        // - Trả 1 phần sản phẩm: order.status giữ nguyên (DELIVERED) & paymentStatus = PARTIALLY_REFUNDED
        const isFullReturn = totalOrderedQty > 0 && totalReturnedQty >= totalOrderedQty;

        if (isFullReturn) {
          order.status = OrderStatus.RETURNED;
          order.payment.status = PaymentStatus.REFUNDED;
          order.paymentStatus = PaymentStatus.REFUNDED;
        } else {
          if (newTotalRefunded >= actualCollected) {
            order.payment.status = PaymentStatus.REFUNDED;
            order.paymentStatus = PaymentStatus.REFUNDED;
          } else {
            order.payment.status = PaymentStatus.PARTIALLY_REFUNDED;
            order.paymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
          }
        }

        req.history.push({
          action: 'PROCESS_REFUND',
          fromStatus: prevReqStatus,
          toStatus: ReturnRequestStatus.COMPLETED,
          updatedAt: now,
          updatedBy: adminUser?._id || null,
          note: `Xác nhận hoàn tiền thành công: ${refundAmt.toLocaleString('vi-VN')} đ. Mã GD: ${txId}. ${bankName ? 'Ngân hàng: ' + bankName + ' - STK: ' + accountNumber + ' - Chủ TK: ' + accountHolder : ''}. Ghi chú: ${notes || 'Không'}`,
        });

        if (Array.isArray(order.statusHistory)) {
          order.statusHistory.push({
            status: order.status,
            updatedAt: now,
            note: isFullReturn
              ? `Hoàn trả toàn bộ đơn hàng (${totalReturnedQty}/${totalOrderedQty} sản phẩm). Đơn hàng chuyển sang ĐÃ HOÀN TRẢ (RETURNED). Hoàn tiền: ${refundAmt.toLocaleString('vi-VN')} đ.`
              : `Hoàn trả một phần (${totalReturnedQty}/${totalOrderedQty} sản phẩm). Đơn hàng giữ trạng thái ${order.status}, trạng thái thanh toán: ${order.paymentStatus}. Hoàn tiền: ${refundAmt.toLocaleString('vi-VN')} đ.`,
            updatedBy: adminUser?._id || null,
          });
        }
        break;
      }

      case 'REFUND_FAILED': {
        const failureReason = String(body?.reason || body?.failureReason || 'Giao dịch hoàn tiền không thành công').trim();
        req.refund = req.refund || {};
        req.refund.status = RefundStatus.FAILED;
        req.refund.failureReason = failureReason;

        req.history.push({
          action: 'REFUND_FAILED',
          fromStatus: req.status,
          toStatus: req.status,
          updatedAt: now,
          updatedBy: adminUser?._id || null,
          note: `Hoàn tiền thất bại: ${failureReason}. Cho phép Admin kiểm tra và thực hiện lại an toàn.`,
        });
        break;
      }

      default:
        throw new BadRequestException(`Hành động "${action}" không hợp lệ trong quy trình xử lý trả hàng.`);
    }

    // Luôn đồng bộ vào legacy field returnRequest
    order.returnRequest = req;
    order.markModified('returnRequests');
    order.markModified('returnRequest');
    order.markModified('payment');

    await order.save();

    return {
      success: true,
      message: `Đã thực hiện thao tác ${action} thành công cho yêu cầu ${req.requestId}.`,
      data: req,
      order,
    };
  }

  // ─── Admin: Cập nhật xác nhận thu tiền / Đối soát COD ───────────────────────
  async updateCodReconciliation(
    orderId: string,
    body: any,
    adminUser: any,
  ): Promise<any> {
    const idQuery = isValidObjectId(orderId)
      ? { $or: [{ orderId: orderId }, { _id: new Types.ObjectId(orderId) }] }
      : { orderId: orderId };

    const order: any = await this.orderModel.findOne(idQuery);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    const codCollected = Boolean(body?.codCollected);
    const orderTotal = Number(order.totalAmount) || Number(order.total) || 0;
    const actualCollectedAmount = Number(body?.actualCollectedAmount) >= 0
      ? Number(body.actualCollectedAmount)
      : (codCollected ? orderTotal : 0);
    const codReconciliationStatus = String(body?.codReconciliationStatus || (codCollected ? 'COLLECTED_UNRECONCILED' : 'UNCOLLECTED'));
    const notes = String(body?.notes || '').trim();
    const now = new Date();

    order.payment = order.payment || {};
    order.payment.codCollected = codCollected;
    if (codCollected && !order.payment.codCollectedAt) {
      order.payment.codCollectedAt = now;
    } else if (!codCollected) {
      order.payment.codCollectedAt = null;
    }

    order.payment.actualCollectedAmount = actualCollectedAmount;
    order.payment.codReconciliationStatus = codReconciliationStatus;
    if (codReconciliationStatus === 'RECONCILED') {
      order.payment.codReconciledAt = now;
    }

    // Nếu đã thu tiền COD thực tế và trạng thái thanh toán đang là UNPAID hoặc PENDING, cập nhật sang PAID
    if (codCollected && (order.payment.status === 'UNPAID' || order.payment.status === 'PENDING' || !order.payment.status)) {
      order.payment.status = 'PAID';
      order.payment.paidAt = order.payment.paidAt || now;
    } else if (!codCollected && order.payment.status === 'PAID') {
      order.payment.status = 'UNPAID';
    }

    if (Array.isArray(order.statusHistory)) {
      order.statusHistory.push({
        status: order.status,
        updatedAt: now,
        note: `Admin cập nhật đối soát COD: ${codCollected ? 'ĐÃ THU TIỀN' : 'CHƯA THU TIỀN'} (Số tiền thực thu: ${actualCollectedAmount.toLocaleString('vi-VN')} đ, Trạng thái: ${codReconciliationStatus}). Ghi chú: ${notes || 'Không'}`,
        updatedBy: adminUser?._id || null,
      });
    }

    order.markModified('payment');
    await order.save();

    return {
      success: true,
      message: 'Cập nhật thông tin thu tiền và đối soát COD thành công.',
      order,
    };
  }


  // ─── Lấy tất cả orders (admin) ────────────────────────────────────────────
  async getAllOrders(): Promise<Order[]> {
    return this.orderModel.find({}).sort('-createdAt');
  }

  // ─── Lấy order theo orderId ───────────────────────────────────────────────
  async getOrderById(id: string): Promise<Order> {
    const query = isValidObjectId(id) ? { $or: [{ orderId: id }, { _id: id }] } : { orderId: id };
    const order = await this.orderModel.findOne(query);
    return order;
  }

  // ─── Cập nhật order (admin) ───────────────────────────────────────────────
  async updateOrder(reqOrder): Promise<Order> {
    const { orderId, status, updatedBy, note, paymentStatus, ...rest } = reqOrder;

    const updateData: any = { ...rest };

    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
    }

    // Thêm vào statusHistory nếu có thay đổi status
    if (status) {
      let mappedStatus: any = (status || '').toUpperCase();
      if (mappedStatus === 'NEW') {
        mappedStatus = OrderStatus.PENDING;
      } else if (mappedStatus === 'COMPLETED') {
        mappedStatus = OrderStatus.DELIVERED;
      } else if (mappedStatus === 'CANCELED') {
        mappedStatus = OrderStatus.CANCELLED;
      } else if (mappedStatus === 'PAID') {
        updateData.paymentStatus = PaymentStatus.PAID;
        mappedStatus = OrderStatus.PROCESSING;
      }

      const validStatuses = Object.values(OrderStatus) as string[];
      if (validStatuses.includes(mappedStatus)) {
        updateData.status = mappedStatus;
        updateData.$push = {
          statusHistory: {
            status: mappedStatus,
            updatedAt: new Date(),
            updatedBy: updatedBy && isValidObjectId(updatedBy) ? new Types.ObjectId(updatedBy) : null,
            note: note || '',
          },
        };
      }
    }

    const query = isValidObjectId(orderId)
      ? { $or: [{ orderId }, { _id: orderId }] }
      : { orderId };

    const order = await this.orderModel.findOneAndUpdate(
      query,
      updateData,
      { new: true },
    );
    return order;
  }

  // ─── Cập nhật riêng trường status (admin) ──────────────────────────────────
  async updateOrderStatus(id: string, status: string, note?: string, user?: any): Promise<any> {
    if (!status || typeof status !== 'string') {
      throw new BadRequestException('Vui lòng cung cấp trạng thái mới');
    }

    const targetStatus = status.trim().toUpperCase();
    const VALID_STATUSES: Record<string, string> = {
      DELIVERED: 'Đã giao',
      SHIPPING: 'Đang giao',
      PROCESSING: 'Đang xử lý',
      PENDING: 'Chờ xác nhận',
      CANCELLED: 'Đã hủy',
      RETURNED: 'Đã hoàn trả',
    };

    if (!VALID_STATUSES[targetStatus]) {
      throw new BadRequestException(
        `Trạng thái không hợp lệ. Các trạng thái được chấp nhận: ${Object.keys(VALID_STATUSES).join(', ')}`
      );
    }

    const trimmedId = id ? id.trim() : '';
    const query = isValidObjectId(trimmedId)
      ? { $or: [{ _id: trimmedId }, { orderId: trimmedId }] }
      : { orderId: trimmedId };

    const order = await this.orderModel.findOne(query);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const currentStatus = (order.status || 'PENDING').toUpperCase();
    if (currentStatus === targetStatus) {
      throw new BadRequestException(
        `Đơn hàng hiện tại đã ở trạng thái "${VALID_STATUSES[currentStatus] || currentStatus}".`
      );
    }

    const VALID_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPING', 'CANCELLED'],
      SHIPPING: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['RETURNED'],
      CANCELLED: [],
      RETURNED: [],
    };

    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      const allowedLabels = allowedTransitions.map(s => VALID_STATUSES[s] || s).join(', ') || 'Không có';
      throw new BadRequestException(
        `Trạng thái mới không hợp lệ với trạng thái hiện tại. Từ "${VALID_STATUSES[currentStatus] || currentStatus}" chỉ có thể chuyển sang: ${allowedLabels}.`
      );
    }

    const now = new Date();
    order.status = targetStatus as any;
    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }
    order.statusHistory.unshift({
      status: targetStatus as any,
      updatedAt: now,
      updatedBy: user?._id && isValidObjectId(user._id) ? new Types.ObjectId(user._id) : null,
      note: note || `Admin cập nhật trạng thái từ ${VALID_STATUSES[currentStatus] || currentStatus} sang ${VALID_STATUSES[targetStatus] || targetStatus}`,
    } as any);

    await order.save();

    return {
      success: true,
      message: `Đã cập nhật trạng thái đơn hàng thành "${VALID_STATUSES[targetStatus] || targetStatus}"`,
      data: order,
    };
  }

  // ─── Xóa order (Vô hiệu hóa để bảo vệ dữ liệu nghiệp vụ) ──────────────────
  async removeOrder(id: string): Promise<any> {
    throw new MethodNotAllowedException(
      'Không hỗ trợ thao tác xóa đơn hàng. Đơn hàng là dữ liệu nghiệp vụ cần được lưu trữ để tra cứu, đối soát và quản lý lịch sử giao dịch.',
    );
  }

  // ─── Tra cứu vận đơn dành cho khách vãng lai ─────────────────────────────
  // Tìm chính xác theo mã đơn / mã vận đơn + xác thực email / phone
  async trackOrder(query: {
    orderId?: string;
    trackingNumber?: string;
    trackingCode?: string;
    email?: string;
    phone?: string;
    authContact?: string;
  }): Promise<any> {
    try {
      const inputTrackingCode = (query.trackingCode || query.orderId || query.trackingNumber || '').trim();
      const inputAuthContact = (query.authContact || query.email || query.phone || '').trim();

      // Bắt buộc phải có cả mã tra cứu VÀ thông tin xác thực
      if (!inputTrackingCode) {
        return { error: 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.' };
      }
      if (!inputAuthContact) {
        return { error: 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.' };
      }

      const isEmail = inputAuthContact.includes('@');
      if (!isEmail && !/\d/.test(inputAuthContact)) {
        return { error: 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.' };
      }
      const escapedCode = inputTrackingCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const codeRegex = new RegExp(`^${escapedCode}$`, 'i');

      const codeConditions: any[] = [
        { orderId: codeRegex },
        { trackingNumber: codeRegex },
        { 'shipping.trackingNumber': codeRegex }
      ];
      if (isValidObjectId(inputTrackingCode)) {
        codeConditions.push({ _id: new Types.ObjectId(inputTrackingCode) });
      }

      const contactConditions: any[] = [];
      if (isEmail) {
        const emailRegex = new RegExp(`^${inputAuthContact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        contactConditions.push(
          { customerEmail: emailRegex },
          { 'customer.email': emailRegex },
          { 'shippingAddress.email': emailRegex },
          { 'addresses.email': emailRegex }
        );
      } else {
        // Chuẩn hóa số điện thoại: hỗ trợ cả +84, 84, 0 và các định dạng có dấu cách/gạch nối
        const digits = inputAuthContact.replace(/\D/g, '');
        let core = digits;
        if (digits.startsWith('84') && digits.length >= 10) {
          core = digits.slice(2);
        } else if (digits.startsWith('0') && digits.length >= 10) {
          core = digits.slice(1);
        }

        if (core) {
          const corePattern = core.split('').join('[\\s\\.\\-]*');
          const phoneRegex = new RegExp(`^(\\+?84|0)?[\\s\\.\\-]*${corePattern}$`, 'i');
          contactConditions.push(
            { customerPhone: phoneRegex },
            { 'customer.phone': phoneRegex },
            { 'shippingAddress.phone': phoneRegex },
            { 'addresses.phone': phoneRegex }
          );
        } else {
          const cleanPhone = inputAuthContact.replace(/[\s.()-]/g, '');
          contactConditions.push(
            { customerPhone: cleanPhone },
            { 'customer.phone': cleanPhone },
            { 'shippingAddress.phone': cleanPhone },
            { 'addresses.phone': cleanPhone }
          );
        }
      }

      // Query đối chiếu với dữ liệu Order thực tế trong MongoDB:
      // CẢ HAI thông tin (mã đơn VÀ email/sđt) phải thuộc CÙNG MỘT document
      const order: any = await this.orderModel.findOne({
        $and: [
          { $or: codeConditions },
          { $or: contactConditions }
        ]
      }).lean();

      if (!order) {
        return { error: 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.' };
      }

      // Keep the guest response to the explicit public tracking fields only.
      return buildPublicTrackingResponse(order);

    } catch (err: any) {
      return { error: 'Không thể tra cứu đơn hàng vào lúc này. Vui lòng thử lại sau.' };
    }
  }

  // ─── Shipping Methods CRUD ─────────────────────────────────────────────────
  async getActiveShippingMethods(): Promise<any[]> {
    const rawMethods = await this.shippingMethodModel
      .find({
        $or: [
          { status: 'ACTIVE' },
          { isActive: true },
        ],
      })
      .sort('baseFee baseCost')
      .lean();

    return rawMethods.map((m: any) => ({
      _id: m._id ? m._id.toString() : m.id,
      name: m.name,
      code: m.code,
      baseFee: m.baseFee !== undefined ? m.baseFee : (m.baseCost !== undefined ? m.baseCost : 25000),
      estimatedDeliveryTime: m.estimatedDeliveryTime || m.estimatedDays || '1–3 ngày làm việc',
      freeShippingCondition: m.freeShippingCondition || {
        enabled: (m.freeShippingThreshold || 0) > 0,
        minimumOrderValue: m.freeShippingThreshold || 0,
        description: (m.freeShippingThreshold || 0) > 0
          ? `Miễn phí vận chuyển cho đơn hàng từ ${(m.freeShippingThreshold).toLocaleString('vi-VN')} đ`
          : '',
      },
      status: m.status || (m.isActive !== false ? 'ACTIVE' : 'INACTIVE'),
      description: m.description || '',
    })).filter((m: any) => m.status === 'ACTIVE');
  }

  async getAllShippingMethods(): Promise<any[]> {
    return this.shippingMethodModel.find({}).sort('name').lean();
  }

  async upsertShippingMethod(data: any): Promise<any> {
    if (data._id) {
      return this.shippingMethodModel.findByIdAndUpdate(data._id, data, { new: true });
    }
    return this.shippingMethodModel.create(data);
  }

  async deleteShippingMethod(id: string): Promise<any> {
    return this.shippingMethodModel.findByIdAndDelete(id);
  }

  // ─── Payment Methods CRUD ──────────────────────────────────────────────────
  async getActivePaymentMethods(): Promise<any[]> {
    return this.paymentMethodModel.find({ status: 'ACTIVE' }).sort('name').lean();
  }

  async getAllPaymentMethods(): Promise<any[]> {
    return this.paymentMethodModel.find({}).sort('name').lean();
  }

  async upsertPaymentMethod(data: any): Promise<any> {
    if (data._id) {
      return this.paymentMethodModel.findByIdAndUpdate(data._id, data, { new: true });
    }
    return this.paymentMethodModel.create(data);
  }

  async deletePaymentMethod(id: string): Promise<any> {
    return this.paymentMethodModel.findByIdAndDelete(id);
  }


  private async isMaintenanceMode(): Promise<boolean> {
    try {
      const settings: any = await this.orderModel.db.collection('settings').findOne({});
      return Boolean(settings?.maintenance?.enabled);
    } catch {
      return false;
    }
  }

  // ─── Lấy thông tin địa chỉ gửi cửa hàng từ settings (MongoDB) cho hóa đơn ─
  async getStoreContact(): Promise<{ email: string; phone: string; address: string }> {
    try {
      const settings: any = await this.orderModel.db.collection('settings').findOne(
        {},
        { projection: { 'contact.email': 1, 'contact.phone': 1, 'contact.address': 1 } }
      );
      const contact = settings?.contact || {};
      return {
        email: contact.email ? String(contact.email).trim() : '',
        phone: contact.phone ? String(contact.phone).trim() : '',
        address: contact.address ? String(contact.address).trim() : '',
      };
    } catch {
      return { email: '', phone: '', address: '' };
    }
  }

  // ─── Thêm order COD ───────────────────────────────────────────────────────
  async addOrder(
    orderDto: OrderDto,
    user: User | null,
    lang = 'vi',
    session?: any,
    guestCartId?: string,
  ): Promise<{ error: string; result: Order }> {
    try {
      if (await this.isMaintenanceMode()) {
        return { error: 'Hệ thống đang bảo trì. Quý khách vui lòng quay lại sau.', result: null };
      }
      const orderData = await this.buildOrderData(orderDto, user, 'COD');
      const newOrder = new this.orderModel(orderData);
      await newOrder.save();

      // Ghi nhận tương tác mua hàng cho mô hình ML
      await this.recordPurchaseInteractions(newOrder);

      // Giảm tồn kho sản phẩm/biến thể
      await this.decreaseStock(newOrder.items);

      // Xóa các sản phẩm đã đặt khỏi giỏ hàng của user
      let updatedGuestCart: any = null;
      if (user) {
        if (orderDto.selectedItemIds && orderDto.selectedItemIds.length > 0) {
          const selectedSet = new Set(orderDto.selectedItemIds.map(id => String(id)));
          const freshUser: any = await this.userModel.findById(user._id).lean();
          const remainingItems = (freshUser?.cart?.items || []).filter((item: any) => {
            const pId = String(item.productId || item.id || item.item?._id || item.item?.id || '');
            const vId = item.variantId ? String(item.variantId) : null;
            const compoundId = vId ? `${pId}_${vId}` : pId;
            return !selectedSet.has(compoundId) && !selectedSet.has(pId) && (!item.id || !selectedSet.has(String(item.id)));
          });
          await this.userModel.findByIdAndUpdate(user._id, {
            $set: { 'cart.items': remainingItems },
          });
        } else {
          await this.userModel.findByIdAndUpdate(user._id, {
            'cart.items': [],
          });
        }
      } else if (session) {
        // Dọn giỏ hàng session của khách vãng lai & đồng bộ dữ liệu chuẩn
        updatedGuestCart = await this.syncGuestCartAfterOrder(
          session,
          guestCartId,
          orderDto.selectedItemIds,
          newOrder.items,
          lang,
        );
      }

      if (newOrder.couponCode) {
        await this.couponModel.updateOne(
          { code: newOrder.couponCode },
          { $inc: { usedCount: 1 } }
        );
      }

      await this.sendOrderEmail(newOrder, lang);
      return {
        error: '',
        result: newOrder,
        ...(updatedGuestCart ? { cart: updatedGuestCart } : {}),
      };
    } catch (err) {
      this.logger.error(err.stack || err.message);
      return { error: err.message || 'ORDER_CREATION_FAIL', result: null };
    }
  }

  // ─── Thêm order Stripe ────────────────────────────────────────────────────
  async orderWithStripe(
    body,
    user: User | null,
    lang = 'vi',
    session?: any,
    guestCartId?: string,
  ): Promise<{ error: string; result: Order; cart?: any }> {
    try {
      if (await this.isMaintenanceMode()) {
        return { error: 'Hệ thống đang bảo trì. Quý khách vui lòng quay lại sau.', result: null };
      }
      const orderData = await this.buildOrderData(body, user, 'STRIPE');
      const chargeCurrency = 'vnd';
      const charge = await stripe.charges.create({
        amount: orderData.totalAmount * 100,
        currency: chargeCurrency,
        description: 'Credit Card Payment - Chéri',
        source: body.token?.id,
        capture: false,
      });

      const newOrder = new this.orderModel({
        ...orderData,
        transactionId: charge.id,
        paymentStatus: PaymentStatus.PENDING,
      });

      const capturePayment = await stripe.charges.capture(charge.id);
      let updatedGuestCart: any = null;
      if (capturePayment) {
        newOrder.paymentStatus = PaymentStatus.PAID;
        newOrder.paidAt = new Date();
        await newOrder.save();

        // Ghi nhận tương tác mua hàng cho mô hình ML
        await this.recordPurchaseInteractions(newOrder);

        await this.decreaseStock(newOrder.items);

        if (user) {
          if (body.selectedItemIds && body.selectedItemIds.length > 0) {
            const selectedSet = new Set(body.selectedItemIds.map(id => String(id)));
            const freshUser: any = await this.userModel.findById(user._id).lean();
            const remainingItems = (freshUser?.cart?.items || []).filter((item: any) => {
              const pId = String(item.productId || item.id || item.item?._id || item.item?.id || '');
              const vId = item.variantId ? String(item.variantId) : null;
              const compoundId = vId ? `${pId}_${vId}` : pId;
              return !selectedSet.has(compoundId) && !selectedSet.has(pId) && (!item.id || !selectedSet.has(String(item.id)));
            });
            await this.userModel.findByIdAndUpdate(user._id, {
              $set: { 'cart.items': remainingItems },
            });
          } else {
            await this.userModel.findByIdAndUpdate(user._id, {
              'cart.items': [],
            });
          }
        } else if (session) {
          updatedGuestCart = await this.syncGuestCartAfterOrder(
            session,
            guestCartId,
            body.selectedItemIds,
            newOrder.items,
            lang,
          );
        }

        if (newOrder.couponCode) {
          await this.couponModel.updateOne(
            { code: newOrder.couponCode },
            { $inc: { usedCount: 1 } }
          );
        }

        await this.sendOrderEmail(newOrder, lang);
      }

      return {
        error: '',
        result: newOrder,
        ...(updatedGuestCart ? { cart: updatedGuestCart } : {}),
      };
    } catch (err) {
      this.logger.error(err.stack || err.message);
      return { error: 'ORDER_CREATION_FAIL', result: null };
    }
  }

  /**
   * Đồng bộ & làm sạch giỏ hàng của khách vãng lai sau khi đơn hàng được tạo thành công
   */
  private async syncGuestCartAfterOrder(
    session: any,
    guestCartId: string | undefined,
    selectedItemIds: string[] | undefined,
    purchasedItems: any[],
    lang = 'vi',
  ): Promise<any> {
    if (!session) return { items: [], totalQty: 0, totalPrice: 0 };

    const guestKey = guestCartId ? `cart_${guestCartId}` : null;
    const existingGuestCart = (guestKey && session[guestKey]) ? session[guestKey] : session.cart;
    const rawItems: any[] = Array.isArray(existingGuestCart?.items) ? existingGuestCart.items : [];

    let remainingItems: any[] = [];

    if (rawItems.length > 0) {
      const selectedSet = new Set((selectedItemIds || []).map((id: any) => String(id)));

      const purchasedMatchList = (Array.isArray(purchasedItems) ? purchasedItems : []).map((p: any) => {
        const prodId = String(p.productId || p.item?._id || p.item?.id || p.id || '');
        const varId = (p.variantId !== undefined && p.variantId !== null && p.variantId !== '') ? String(p.variantId).trim() : null;
        return { prodId, varId, compoundId: varId ? `${prodId}_${varId}` : prodId };
      });

      remainingItems = rawItems.filter((item: any) => {
        const rawPId = item.productId || item.item?._id || item.item?.id || item.id || '';
        const pId = String(typeof rawPId === 'string' && rawPId.includes('_') ? rawPId.split('_')[0] : rawPId);
        const vId = (item.variantId !== undefined && item.variantId !== null && item.variantId !== '') ? String(item.variantId).trim() : null;
        const compoundId = vId ? `${pId}_${vId}` : pId;
        const itemId = item.id ? String(item.id) : '';

        const isSelected = selectedSet.size > 0 && (
          selectedSet.has(compoundId) ||
          selectedSet.has(itemId) ||
          selectedSet.has(pId)
        );

        const isPurchased = purchasedMatchList.some((p: any) => {
          if (p.prodId && p.prodId === pId) {
            if (p.varId || vId) {
              return p.varId === vId;
            }
            return true;
          }
          return false;
        });

        if (selectedSet.size > 0) {
          return !isSelected && !isPurchased;
        } else {
          return !isPurchased;
        }
      });
    }

    const updatedCartObj = new Cart({ items: remainingItems } as any);
    if (guestKey) {
      session[guestKey] = updatedCartObj;
    }
    session.cart = updatedCartObj;

    if (typeof session.save === 'function') {
      try {
        await new Promise<void>((resolve, reject) => {
          session.save((err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (err: any) {
        this.logger.error(`Error saving guest cart session: ${err?.message || err}`);
      }
    }

    return prepareCart(updatedCartObj, lang, session?.config);
  }

  // ─── Build order data từ cart của user ────────────────────────────────────
  private async buildOrderData(orderDto: OrderDto, user: User | null, type: string) {
    // Lấy cart items từ DB user hoặc fallback từ body
    let cartItems: any[] = [];
    if (user) {
      const freshUser = await this.userModel.findById(user._id).lean() as any;
      cartItems = freshUser?.cart?.items || [];
    }

    if (!cartItems.length && (orderDto as any).items && Array.isArray((orderDto as any).items)) {
      cartItems = (orderDto as any).items;
    }

    // Lọc theo selectedItemIds nếu có
    if (orderDto.selectedItemIds && Array.isArray(orderDto.selectedItemIds) && orderDto.selectedItemIds.length > 0) {
      const selectedSet = new Set(orderDto.selectedItemIds.map(id => String(id)));
      cartItems = cartItems.filter(item => {
        const pId = String(item.productId || item.id || item.item?._id || item.item?.id || '');
        const vId = item.variantId ? String(item.variantId) : null;
        const compoundId = vId ? `${pId}_${vId}` : pId;
        return selectedSet.has(compoundId) || selectedSet.has(pId) || (item.id && selectedSet.has(String(item.id)));
      });
    }

    if (!cartItems.length) {
      throw new Error('Vui lòng chọn ít nhất 1 sản phẩm để đặt hàng');
    }

    // Build items với snapshot
    const orderItems = await this.buildOrderItems(cartItems);

    if (!orderItems.length) {
      throw new Error('Không có sản phẩm hợp lệ để đặt hàng');
    }

    // Tính subtotal
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Lấy thông tin shipping method từ DB và tính toán server-authoritative
    let shippingFee = 0;
    let shippingMethodId = null;
    let shippingMethodSnapshot = null;

    let shippingMethod: any = null;
    if (orderDto.shippingMethodId) {
      if (isValidObjectId(orderDto.shippingMethodId)) {
        shippingMethod = await this.shippingMethodModel.findById(orderDto.shippingMethodId).lean();
      }
      if (!shippingMethod) {
        shippingMethod = await this.shippingMethodModel.findOne({
          code: orderDto.shippingMethodId,
          $or: [{ status: 'ACTIVE' }, { isActive: true }],
        }).lean();
      }
    }

    // Fallback: nếu không tìm thấy hoặc user không gửi, chọn method ACTIVE đầu tiên từ DB
    if (!shippingMethod) {
      shippingMethod = await this.shippingMethodModel
        .findOne({ $or: [{ status: 'ACTIVE' }, { isActive: true }] })
        .sort('baseFee baseCost')
        .lean();
    }

    if (shippingMethod) {
      shippingMethodId = shippingMethod._id;
      const baseFee = shippingMethod.baseFee !== undefined
        ? shippingMethod.baseFee
        : (shippingMethod.baseCost !== undefined ? shippingMethod.baseCost : 25000);
      shippingFee = baseFee;

      // Kiểm tra điều kiện miễn phí ship từ DB
      const freeThreshold =
        shippingMethod.freeShippingCondition?.minimumOrderValue ||
        shippingMethod.freeShippingThreshold ||
        0;
      const isFreeEnabled =
        shippingMethod.freeShippingCondition?.enabled || freeThreshold > 0;
      if (isFreeEnabled && freeThreshold > 0 && subtotal >= freeThreshold) {
        shippingFee = 0;
      }

      shippingMethodSnapshot = {
        name: shippingMethod.name,
        code: shippingMethod.code,
        fee: baseFee,
        estimatedDeliveryTime: shippingMethod.estimatedDeliveryTime || shippingMethod.estimatedDays || '1–3 ngày làm việc',
      };
    }

    // Lấy thông tin payment method từ DB và kiểm tra hợp lệ
    let paymentFee = 0;
    let paymentMethodId = null;
    let paymentMethodSnapshot = null;

    let paymentMethod: any = null;
    if (orderDto.paymentMethodId) {
      if (isValidObjectId(orderDto.paymentMethodId)) {
        paymentMethod = await this.paymentMethodModel.findById(orderDto.paymentMethodId).lean();
      }
      if (!paymentMethod) {
        paymentMethod = await this.paymentMethodModel.findOne({
          code: orderDto.paymentMethodId,
        }).lean();
      }
      if (!paymentMethod) {
        throw new BadRequestException('Phương thức thanh toán đã chọn không tồn tại trong hệ thống.');
      }
      if (paymentMethod.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Phương thức thanh toán "${paymentMethod.name}" hiện không khả dụng. Vui lòng chọn phương thức khác.`
        );
      }
    } else {
      // Fallback nếu client cũ chưa truyền paymentMethodId: tìm phương thức ACTIVE tương ứng
      const targetCode = type === 'STRIPE' ? 'STRIPE' : 'COD';
      paymentMethod = await this.paymentMethodModel.findOne({
        code: targetCode,
        status: 'ACTIVE',
      }).lean();
      if (!paymentMethod) {
        paymentMethod = await this.paymentMethodModel.findOne({ status: 'ACTIVE' }).lean();
      }
      if (!paymentMethod) {
        throw new BadRequestException('Hiện tại không có phương thức thanh toán nào khả dụng.');
      }
    }

    paymentMethodId = paymentMethod._id;

    if (paymentMethod.transactionFee?.enabled) {
      if (paymentMethod.transactionFee.type === 'PERCENTAGE') {
        paymentFee = Math.round((subtotal * paymentMethod.transactionFee.value) / 100);
      } else {
        paymentFee = paymentMethod.transactionFee.value || 0;
      }
    }

    paymentMethodSnapshot = {
      name: paymentMethod.name,
      code: paymentMethod.code,
      paymentType: paymentMethod.paymentType,
      paymentFee,
    };

    let couponDiscount = 0;
    let appliedCouponCode = '';
    if (orderDto.couponCode) {
      const couponCheck = await this.validateCoupon(orderDto.couponCode, subtotal);
      if (couponCheck.valid) {
        couponDiscount = couponCheck.discountAmount || 0;
        appliedCouponCode = couponCheck.code || orderDto.couponCode.toUpperCase();
      }
    }

    const totalAmount = Math.max(0, subtotal + shippingFee + paymentFee - couponDiscount);
    const orderId = `CHE${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Chuẩn hóa shippingAddress đảm bảo lưu đầy đủ code + name + addressDetail
    const rawAddr = (orderDto as any).shippingAddress || (orderDto as any).addresses?.[0] || {};
    const fullAddrString = [
      rawAddr.addressDetail || rawAddr.address || rawAddr.line1,
      rawAddr.wardName || rawAddr.ward,
      rawAddr.districtName || rawAddr.district,
      rawAddr.provinceName || rawAddr.province || rawAddr.city
    ].filter(Boolean).join(', ');

    const normalizedShippingAddress = {
      fullName: rawAddr.fullName || rawAddr.name || (orderDto as any).name || (user as any)?.fullName || (user as any)?.name || '',
      phone: rawAddr.phone || orderDto.customerPhone || (orderDto as any).phone || (user as any)?.phoneNumber || '',
      address: rawAddr.fullAddress || fullAddrString || rawAddr.addressDetail || rawAddr.address || '',
      addressDetail: rawAddr.addressDetail || rawAddr.address || rawAddr.line1 || '',
      fullAddress: rawAddr.fullAddress || fullAddrString,
      provinceCode: String(rawAddr.provinceCode || ''),
      provinceName: rawAddr.provinceName || rawAddr.province || rawAddr.city || '',
      province: rawAddr.provinceName || rawAddr.province || rawAddr.city || '',
      districtCode: String(rawAddr.districtCode || ''),
      districtName: rawAddr.districtName || rawAddr.district || '',
      district: rawAddr.districtName || rawAddr.district || '',
      wardCode: String(rawAddr.wardCode || ''),
      wardName: rawAddr.wardName || rawAddr.ward || '',
      ward: rawAddr.wardName || rawAddr.ward || '',
    };

    return {
      orderId,
      _user: user ? new Types.ObjectId(user._id as string) : null,
      userId: user ? new Types.ObjectId(user._id as string) : null,
      customerEmail: orderDto.email,
      customerPhone: orderDto.customerPhone || normalizedShippingAddress.phone || '',
      status: OrderStatus.PENDING,
      notes: orderDto.notes || '',
      items: orderItems,
      shippingAddress: normalizedShippingAddress,
      addresses: [normalizedShippingAddress],
      customer: {
        name: normalizedShippingAddress.fullName,
        email: orderDto.email,
        phone: normalizedShippingAddress.phone,
      },
      shippingMethodId,
      shippingMethodSnapshot,
      shippingFee,
      payment: {
        method: paymentMethodSnapshot?.code || (type === 'STRIPE' ? 'STRIPE' : 'COD'),
        status: PaymentStatus.PENDING,
        provider: paymentMethodSnapshot?.name || (type === 'STRIPE' ? 'Stripe' : 'COD'),
        transactionId: null,
        paidAt: null,
      },
      paymentMethodId,
      paymentMethodSnapshot,
      paymentStatus: type === 'STRIPE' ? PaymentStatus.PENDING : PaymentStatus.PENDING,
      paymentFee,
      subtotal,
      discountAmount: couponDiscount,
      taxAmount: 0,
      couponCode: appliedCouponCode,
      couponDiscount,
      totalAmount,
      currency: orderDto.currency || 'VND',
      statusHistory: [
        {
          status: OrderStatus.PENDING,
          updatedAt: new Date(),
          updatedBy: null,
          note: 'Đơn hàng vừa được tạo',
        },
      ],
    };
  }

  // ─── Build order items với productSnapshot ────────────────────────────────
  private async buildOrderItems(cartItems: any[]) {
    const orderItems = [];

    for (const cartItem of cartItems) {
      // 1. Trích xuất productId an toàn: hỗ trợ ObjectId thuần, compound id (prodId_varId) hoặc snapshot item
      let rawProdId = cartItem.productId || cartItem.item?._id || cartItem.item?.id || cartItem.id;
      let cleanProdId = '';
      if (rawProdId) {
        cleanProdId = String(rawProdId).trim();
        if (cleanProdId.includes('_')) {
          cleanProdId = cleanProdId.split('_')[0];
        }
      }

      // 2. Trích xuất variantId an toàn
      let variantId = cartItem.variantId;
      if (!variantId && typeof cartItem.id === 'string' && cartItem.id.includes('_')) {
        const parts = cartItem.id.split('_');
        if (parts.length > 1) {
          variantId = parts.slice(1).join('_');
        }
      }

      const quantity = Math.max(1, Number(cartItem.quantity || cartItem.qty) || 1);

      // 3. Tìm sản phẩm trong DB bằng findById (nếu ObjectId hợp lệ) hoặc findOne theo SKU/code
      let product: any = null;
      if (cleanProdId && isValidObjectId(cleanProdId)) {
        product = await this.productModel.findById(cleanProdId).lean() as any;
      }

      if (!product && cleanProdId) {
        product = await this.productModel.findOne({
          $or: [
            { sku: cleanProdId },
            { code: cleanProdId },
            { 'vi.sku': cleanProdId },
          ]
        }).lean() as any;
      }

      // 4. Nếu không tìm thấy product trong DB nhưng cartItem có snapshot/item sẵn (phòng vệ cao)
      if (!product && (cartItem.productSnapshot || cartItem.item)) {
        const fallbackItem = cartItem.item || {};
        const fallbackSnapshot = cartItem.productSnapshot || {};
        const title = fallbackSnapshot.title || fallbackItem.title || fallbackItem.vi?.title || 'Sản phẩm Chéri';
        const sku = fallbackSnapshot.sku || fallbackItem.sku || fallbackItem.vi?.sku || (cleanProdId ? `SKU-${cleanProdId}` : 'SKU-CHERI');
        const image = fallbackSnapshot.image || fallbackItem.mainImage?.url || fallbackItem.image || (Array.isArray(fallbackItem.images) && (fallbackItem.images[0]?.url || fallbackItem.images[0])) || '';
        const unitPrice = Number(cartItem.unitPrice || cartItem.price || fallbackItem.salePrice || fallbackItem.price || 0);

        orderItems.push({
          productId: cleanProdId && isValidObjectId(cleanProdId) ? new Types.ObjectId(cleanProdId) : null,
          variantId: variantId && isValidObjectId(String(variantId)) ? new Types.ObjectId(String(variantId)) : (variantId ? String(variantId) : null),
          productSnapshot: {
            title,
            sku,
            image,
            variant: fallbackSnapshot.variant || null,
          },
          quantity,
          unitPrice,
          subtotal: unitPrice * quantity,
        });
        continue;
      }

      if (!product) continue;

      // Chặn nếu sản phẩm bị Ẩn (Case 3 & 4)
      if (product.visibility === false || product.vi?.visibility === false) {
        throw new Error(`Sản phẩm "${product.title || product.vi?.title || 'Sản phẩm'}" hiện đang tạm ẩn, không thể đặt hàng.`);
      }

      let availableQty = product.quantity !== undefined ? product.quantity : (product.vi?.quantity || 0);

      let unitPrice = product.salePrice || product.regularPrice || product.price || 0;
      const snapshot: any = {
        title: product.title || product.name || product.vi?.title || 'Sản phẩm Chéri',
        sku: product.sku || product.vi?.sku || (product.code ? String(product.code) : `SKU-${product._id}`),
        image: product.mainImage?.url || product.image || (Array.isArray(product.images) && (product.images[0]?.url || product.images[0])) || '',
      };

      let matchedVariantDocId: Types.ObjectId | null = null;
      if (variantId) {
        const vIdStr = String(variantId).trim();
        const isObjectId = isValidObjectId(vIdStr);
        let variant: any = null;

        // 1. Thử tìm theo _id nếu là ObjectId hợp lệ
        if (isObjectId) {
          variant = await this.variantModel.findById(vIdStr).lean() as any;
        }

        // 2. Thử tìm theo SKU (hoặc _id) trong ProductVariant collection
        if (!variant) {
          variant = await this.variantModel.findOne({
            $or: [
              { sku: vIdStr },
              ...(isObjectId ? [{ _id: new Types.ObjectId(vIdStr) }] : []),
            ],
            ...(product?._id ? { productId: product._id } : {}),
          }).lean() as any;
        }
        if (!variant) {
          variant = await this.variantModel.findOne({ sku: vIdStr }).lean() as any;
        }

        // 3. Fallback: tìm trong mảng variants nhúng của product
        if (!variant && Array.isArray(product.variants) && product.variants.length > 0) {
          variant = product.variants.find((v: any) =>
            (v._id && String(v._id) === vIdStr) ||
            (v.id && String(v.id) === vIdStr) ||
            (v.sku && String(v.sku) === vIdStr)
          );
        }

        if (variant) {
          if (variant._id && isValidObjectId(String(variant._id))) {
            matchedVariantDocId = new Types.ObjectId(String(variant._id));
          }
          availableQty = variant.stock !== undefined ? variant.stock : (variant.quantity || 0);
          unitPrice = variant.discountPrice || variant.price || unitPrice;
          snapshot.variant = {
            color: variant.color || '',
            size: variant.size || '',
            classification: variant.classification || '',
          };
          snapshot.sku = variant.sku || snapshot.sku;
        } else if (cartItem.productSnapshot?.variant) {
          snapshot.variant = cartItem.productSnapshot.variant;
        }
      }

      // Chặn nếu hết hàng hoặc số lượng đặt vượt quá tồn kho (Case 2 & 4)
      if (availableQty <= 0) {
        throw new Error(`Sản phẩm "${snapshot.title || 'Sản phẩm'}" đã hết hàng.`);
      }
      if (quantity > availableQty) {
        throw new Error(`Sản phẩm "${snapshot.title || 'Sản phẩm'}" chỉ còn ${availableQty} sản phẩm trong kho.`);
      }

      const finalVariantId = matchedVariantDocId
        || (variantId && isValidObjectId(String(variantId)) ? new Types.ObjectId(String(variantId)) : (variantId ? String(variantId) : null));

      const finalProductId = product._id && isValidObjectId(String(product._id))
        ? new Types.ObjectId(String(product._id))
        : (cleanProdId && isValidObjectId(cleanProdId) ? new Types.ObjectId(cleanProdId) : null);

      orderItems.push({
        productId: finalProductId,
        variantId: finalVariantId,
        productSnapshot: snapshot,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
      });
    }

    return orderItems;
  }

  // ─── Trừ tồn kho sau khi đặt hàng thành công ─────────────────────────────
  private async decreaseStock(items: any[]) {
    for (const item of items) {
      if (item.variantId) {
        const vIdStr = String(item.variantId).trim();
        let updated = false;

        if (isValidObjectId(vIdStr)) {
          const res = await this.variantModel.findByIdAndUpdate(vIdStr, {
            $inc: { stock: -item.quantity },
          });
          if (res) updated = true;
        }

        if (!updated) {
          const res = await this.variantModel.findOneAndUpdate(
            { sku: vIdStr },
            { $inc: { stock: -item.quantity } },
          );
          if (res) updated = true;
        }

        if (item.productId && isValidObjectId(String(item.productId))) {
          await this.productModel.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -item.quantity },
          });
        }
      } else if (item.productId && isValidObjectId(String(item.productId))) {
        await this.productModel.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity },
        });
      }
    }
  }

  // ─── Gửi email xác nhận ───────────────────────────────────────────────────
  private async sendOrderEmail(order: Order, lang: string) {
    try {
      const translations = await this.translationModel.findOne({ lang });

      const emailPayload = {
        subject: 'Xác nhận đơn hàng',
        orderId: order.orderId,
        items: order.items,
        shippingAddress: order.shippingAddress,
        totalAmount: order.totalAmount,
        currency: order.currency,
        notes: order.notes,
        date: new Date(),
      };

      await sendMsg(order.customerEmail, emailPayload, translations);

      if (process.env.ADMIN_EMAILS) {
        const adminEmails = process.env.ADMIN_EMAILS.split(',').filter(Boolean);
        for (const email of adminEmails) {
          await sendMsg(email, emailPayload, translations);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to send order email: ${err.stack || err.message}`);
    }
  }

  async getOrderStats(period: 'week' | 'month' = 'week'): Promise<any> {
    const now = new Date();
    const days = period === 'week' ? 7 : 30;

    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days);
    currentStart.setHours(0, 0, 0, 0);

    const prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - days);

    const [allOrders, allProducts] = await Promise.all([
      this.orderModel.find({
        $or: [
          { createdAt: { $gte: prevStart } },
          { dateAdded: { $gte: prevStart } },
        ],
      }).lean(),
      this.productModel.find({}).lean(),
    ]);

    const getOrderTime = (o: any) => {
      const d = o.createdAt || o.dateAdded;
      return d ? new Date(d).getTime() : 0;
    };

    const currentOrders = allOrders.filter(o => getOrderTime(o) >= currentStart.getTime());
    const prevOrders    = allOrders.filter(o => getOrderTime(o) < currentStart.getTime());

    const isPaid = (o: any) => o.paymentStatus === PaymentStatus.PAID || o.status === OrderStatus.DELIVERED;
    const currentRevenue = currentOrders
      .filter(isPaid)
      .reduce((sum, o) => sum + (o.totalAmount || (o as any).amount || 0), 0);
    const prevRevenue = prevOrders
      .filter(isPaid)
      .reduce((sum, o) => sum + (o.totalAmount || (o as any).amount || 0), 0);

    const calcGrowth = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const chart: { label: string; value: number }[] = [];
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const dayRevenue = currentOrders
        .filter(o => {
          const t = getOrderTime(o);
          return t >= dayStart.getTime() && t <= dayEnd.getTime() && isPaid(o);
        })
        .reduce((sum, o) => sum + (o.totalAmount || (o as any).amount || 0), 0);

      const label = period === 'week'
        ? dayNames[d.getDay()]
        : `${d.getDate()}/${d.getMonth() + 1}`;

      chart.push({ label, value: dayRevenue });
    }

    const inStockCount = allProducts.filter(
      p => p.stock !== 'outOfStock' && p.stock !== 'out',
    ).length;

    return {
      success: true,
      chart,
      growth: {
        products: calcGrowth(allProducts.length, allProducts.length),
        orders:   calcGrowth(currentOrders.length, prevOrders.length),
        revenue:  calcGrowth(currentRevenue, prevRevenue),
        inStock:  calcGrowth(inStockCount, inStockCount),
      },
      stats: {
        totalRevenue: currentRevenue,
        totalOrders: currentOrders.length,
        totalProducts: allProducts.length,
        inStockCount,
      },
    };
  }

  async getNotifications(recipientId: string = 'admin'): Promise<any[]> {
    const db = this.orderModel.db;
    const notifCol = db.collection('notification-popup');
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [orders, products, users] = await Promise.all([
      this.orderModel.find({
        $or: [
          { createdAt: { $gte: since } },
          { dateAdded: { $gte: since } },
        ],
      }).sort('-createdAt').lean(),
      this.productModel.find({}).select('title titleUrl stock dateAdded quantity updatedAt').lean(),
      this.userModel.find({
        $or: [
          { createdAt: { $gte: since } },
          { dateAdded: { $gte: since } },
        ],
      }).select('email name fullName status createdAt dateAdded').sort('-createdAt').lean(),
    ]);

    const activeEvents: any[] = [];

    // ── 🔔 ĐƠN HÀNG ──────────────────────────────────────────────────────────
    const newOrders = orders.filter(o => o.status === OrderStatus.PENDING || (o as any).status === 'NEW' || (o as any).status === 'Pending');
    if (newOrders.length) {
      activeEvents.push({
        id: 'orders-new',
        type: 'order_new',
        group: 'orders',
        icon: 'new-order',
        title: 'Có đơn hàng mới',
        message: `${newOrders.length} đơn hàng mới chờ xử lý`,
        count: newOrders.length,
        level: 'info',
        time: newOrders[0]?.createdAt || (newOrders[0] as any)?.dateAdded || new Date(),
        targetUrl: '/admin/orders?status=PENDING',
      });
    }

    const confirmedOrders = orders.filter(
      o => o.status === OrderStatus.CONFIRMED || (o as any).status === 'CONFIRMED' ||
           o.status === OrderStatus.PROCESSING || (o as any).status === 'PROCESSING' ||
           (o as any).status === 'Confirmed' || (o as any).status === 'Processing'
    );
    if (confirmedOrders.length) {
      activeEvents.push({
        id: 'orders-confirmed',
        type: 'order_confirmed',
        group: 'orders',
        icon: 'confirmed',
        title: 'Đơn đã xác nhận cần xuất kho',
        message: `${confirmedOrders.length} đơn đã xác nhận và cần xuất kho`,
        count: confirmedOrders.length,
        level: 'info',
        time: confirmedOrders[0]?.createdAt || (confirmedOrders[0] as any)?.dateAdded || new Date(),
        targetUrl: '/admin/orders?status=CONFIRMED',
      });
    }

    const paidOrders = orders.filter(o => o.paymentStatus === PaymentStatus.PAID || (o as any).paymentStatus === 'Paid' || (o as any).status === 'PAID');
    if (paidOrders.length) {
      activeEvents.push({
        id: 'orders-paid',
        type: 'order_paid',
        group: 'orders',
        icon: 'paid',
        title: 'Đơn hàng được thanh toán',
        message: `${paidOrders.length} đơn đã thanh toán thành công`,
        count: paidOrders.length,
        level: 'success',
        time: paidOrders[0]?.createdAt || (paidOrders[0] as any)?.dateAdded || new Date(),
        targetUrl: '/admin/orders?status=CONFIRMED',
      });
    }

    const canceledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED || (o as any).status === 'CANCELLED' || (o as any).status === 'CANCELED' || (o as any).status === 'Cancelled');
    if (canceledOrders.length) {
      activeEvents.push({
        id: 'orders-canceled',
        type: 'order_canceled',
        group: 'orders',
        icon: 'cancel',
        title: 'Đơn hàng bị hủy',
        message: `${canceledOrders.length} đơn hàng đã bị hủy`,
        count: canceledOrders.length,
        level: 'error',
        time: canceledOrders[0]?.createdAt || (canceledOrders[0] as any)?.dateAdded || new Date(),
        targetUrl: '/admin/orders?status=CANCELLED',
      });
    }

    const returnOrders = orders.filter(
      o => o.status === OrderStatus.RETURNED ||
           (o as any).type === 'RETURN' ||
           (Array.isArray((o as any).returnRequests) && (o as any).returnRequests.some((r: any) => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'INSPECTED')) ||
           ((o as any).returnRequest && ((o as any).returnRequest.status === 'PENDING' || (o as any).returnRequest.status === 'APPROVED')) ||
           (o.notes && /đổi|trả|refund|return/i.test(o.notes)),
    );
    if (returnOrders.length) {
      activeEvents.push({
        id: 'orders-return',
        type: 'order_return',
        group: 'orders',
        icon: 'return',
        title: 'Đơn hàng yêu cầu đổi/trả',
        message: `${returnOrders.length} đơn yêu cầu đổi/trả`,
        count: returnOrders.length,
        level: 'warning',
        time: returnOrders[0]?.createdAt || (returnOrders[0] as any)?.dateAdded || new Date(),
        targetUrl: '/admin/orders?status=RETURN_PENDING',
      });
    }

    // ── 🔔 SẢN PHẨM & KHO ────────────────────────────────────────────────────
    const outOfStock = products.filter(p => p.stock === 'outOfStock' || p.stock === 'out' || p.quantity === 0);
    if (outOfStock.length) {
      activeEvents.push({
        id: 'stock-out',
        type: 'stock_out',
        group: 'products',
        icon: 'out-of-stock',
        title: 'Sản phẩm hết hàng',
        message: `${outOfStock.length} sản phẩm đã hết hàng`,
        count: outOfStock.length,
        level: 'error',
        items: outOfStock.slice(0, 3).map((p: any) => p.title || p.titleUrl),
        targetUrl: '/admin/products?status=out',
        time: new Date(),
      });
    }

    const lowStock = products.filter(
      p => p.stock === 'lowStock' || p.stock === 'low' ||
           (typeof p.quantity === 'number' && p.quantity > 0 && p.quantity <= 5),
    );
    if (lowStock.length) {
      activeEvents.push({
        id: 'stock-low',
        type: 'stock_low',
        group: 'products',
        icon: 'low-stock',
        title: 'Sản phẩm sắp hết hàng',
        message: `${lowStock.length} sản phẩm sắp hết hàng`,
        count: lowStock.length,
        level: 'warning',
        items: lowStock.slice(0, 3).map((p: any) => p.title || p.titleUrl),
        targetUrl: '/admin/products?status=out',
        time: new Date(),
      });
    }

    const recentlyRestocked = products.filter(p => {
      if (p.stock !== 'inStock' && p.stock !== 'in' && (!p.quantity || p.quantity <= 0)) return false;
      const d = (p as any).dateAdded || (p as any).updatedAt;
      return d && new Date(d) >= since;
    });
    if (recentlyRestocked.length) {
      activeEvents.push({
        id: 'stock-in',
        type: 'stock_in',
        group: 'products',
        icon: 'restock',
        title: 'Nhập kho thành công',
        message: `${recentlyRestocked.length} sản phẩm được cập nhật vào kho`,
        count: recentlyRestocked.length,
        level: 'success',
        targetUrl: '/admin/products',
        time: new Date(),
      });
    }

    const recentlyShipped = orders.filter(
      o => o.status === OrderStatus.SHIPPING || o.status === OrderStatus.DELIVERED,
    );
    if (recentlyShipped.length) {
      activeEvents.push({
        id: 'stock-out-shipped',
        type: 'stock_shipped',
        group: 'products',
        icon: 'shipped',
        title: 'Xuất kho thành công',
        message: `${recentlyShipped.length} đơn hàng đã xuất kho`,
        count: recentlyShipped.length,
        level: 'info',
        targetUrl: '/admin/orders?status=SHIPPING',
        time: recentlyShipped[0]?.createdAt || (recentlyShipped[0] as any)?.dateAdded || new Date(),
      });
    }

    // ── 🔔 NGƯỜI DÙNG ─────────────────────────────────────────────────────────
    const newUsers = users.filter(u => {
      const d = (u as any).createdAt || (u as any).dateAdded;
      return d && new Date(d) >= since;
    });
    if (newUsers.length) {
      activeEvents.push({
        id: 'users-new',
        type: 'user_new',
        group: 'users',
        icon: 'new-user',
        title: 'Người dùng mới đăng ký',
        message: `${newUsers.length} tài khoản mới trong 30 ngày`,
        count: newUsers.length,
        level: 'info',
        time: (newUsers[0] as any)?.createdAt || (newUsers[0] as any)?.dateAdded || new Date(),
        targetUrl: '/admin/users',
      });
    }

    const totalLockedCount = await this.userModel.countDocuments({ status: false });
    if (totalLockedCount > 0) {
      activeEvents.push({
        id: 'users-locked',
        type: 'user_locked',
        group: 'users',
        icon: 'locked-user',
        title: 'Người dùng bị khóa/kích hoạt',
        message: `${totalLockedCount} tài khoản đang bị khóa`,
        count: totalLockedCount,
        level: 'warning',
        targetUrl: '/admin/users',
        time: new Date(),
      });
    }

    // Đồng bộ vào MongoDB collection 'notification-popup'
    const existingDocs = await notifCol.find({ recipientId }).toArray();
    const existingMap = new Map(existingDocs.map((d: any) => [d.id, d]));

    for (const event of activeEvents) {
      const existing = existingMap.get(event.id);
      if (existing) {
        const countIncreased = typeof event.count === 'number' && typeof existing.count === 'number'
          ? event.count > existing.count
          : (event.count !== existing.count && event.count > 0);

        const updateDoc: any = {
          title: event.title,
          message: event.message,
          count: event.count,
          level: event.level,
          icon: event.icon,
          group: event.group,
          type: event.type,
          targetUrl: event.targetUrl,
          items: event.items || [],
          updatedAt: new Date(),
        };

        if (countIncreased) {
          updateDoc.isRead = false;
          updateDoc.readAt = null;
          updateDoc.time = event.time || new Date();
        } else {
          updateDoc.time = existing.time || event.time || new Date();
        }

        await notifCol.updateOne({ _id: existing._id }, { $set: updateDoc });
      } else {
        await notifCol.insertOne({
          ...event,
          items: event.items || [],
          isRead: false,
          readAt: null,
          recipientId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Xóa những thông báo không còn sự kiện active
    const activeIds = activeEvents.map(e => e.id);
    if (activeIds.length > 0) {
      await notifCol.deleteMany({ recipientId, id: { $nin: activeIds } });
    } else {
      await notifCol.deleteMany({ recipientId });
    }

    return await notifCol.find({ recipientId }).sort({ createdAt: -1 }).toArray();
  }

  async getUnreadNotificationCount(recipientId: string = 'admin'): Promise<{ success: boolean; unreadCount: number }> {
    const unreadCount = await this.orderModel.db.collection('notification-popup').countDocuments({ recipientId, isRead: false });
    return { success: true, unreadCount };
  }

  async markNotificationRead(id: string, recipientId: string = 'admin'): Promise<any> {
    const notifCol = this.orderModel.db.collection('notification-popup');
    const filter: any = { recipientId };
    try {
      const { ObjectId } = require('mongodb');
      if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
        filter.$or = [{ _id: new ObjectId(id) }, { id: id }];
      } else {
        filter.id = id;
      }
    } catch {
      filter.id = id;
    }

    await notifCol.updateOne(filter, { $set: { isRead: true, readAt: new Date(), updatedAt: new Date() } });
    const notification = await notifCol.findOne(filter);
    return { success: true, message: 'Đã đánh dấu thông báo là đã đọc', notification };
  }

  async markAllNotificationsRead(recipientId: string = 'admin'): Promise<any> {
    const notifCol = this.orderModel.db.collection('notification-popup');
    const result = await notifCol.updateMany(
      { recipientId, isRead: false },
      { $set: { isRead: true, readAt: new Date(), updatedAt: new Date() } },
    );
    return { success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc', modifiedCount: result.modifiedCount };
  }

  async getDashboardDetailedStats(
    period: '7d' | '30d' | 'this_month' | 'last_month' | 'custom' = '7d',
    customStart?: Date,
    customEnd?: Date,
  ): Promise<any> {
    const now = new Date();

    // Compute period boundaries
    let periodStart: Date;
    let periodEnd: Date;
    let prevStart: Date;
    let prevEnd: Date;
    let days: number;

    if (period === 'this_month') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      periodEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const elapsed = now.getDate();
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd   = new Date(now.getFullYear(), now.getMonth() - 1, elapsed, 23, 59, 59, 999);
      days = periodEnd.getDate();
    } else if (period === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodStart = new Date(lm.getFullYear(), lm.getMonth(), 1, 0, 0, 0, 0);
      periodEnd   = new Date(lm.getFullYear(), lm.getMonth() + 1, 0, 23, 59, 59, 999);
      const pm = new Date(lm.getFullYear(), lm.getMonth() - 1, 1);
      prevStart = new Date(pm.getFullYear(), pm.getMonth(), 1, 0, 0, 0, 0);
      prevEnd   = new Date(pm.getFullYear(), pm.getMonth() + 1, 0, 23, 59, 59, 999);
      days = periodEnd.getDate();
    } else if (period === '30d') {
      days = 30;
      periodEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodStart = new Date(periodEnd.getTime() - (days - 1) * 86400000);
      periodStart.setHours(0, 0, 0, 0);
      prevEnd   = new Date(periodStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
      prevStart.setHours(0, 0, 0, 0);
    } else if (period === 'custom' && customStart && customEnd) {
      periodStart = new Date(customStart);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(customEnd);
      periodEnd.setHours(23, 59, 59, 999);
      days = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
      prevEnd   = new Date(periodStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
      prevStart.setHours(0, 0, 0, 0);
    } else {
      days = 7;
      periodEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodStart = new Date(periodEnd.getTime() - (days - 1) * 86400000);
      periodStart.setHours(0, 0, 0, 0);
      prevEnd   = new Date(periodStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
      prevStart.setHours(0, 0, 0, 0);
    }

    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [allOrders, allProducts, allCategories, allUsers] = await Promise.all([
      this.orderModel.find({}).sort('-createdAt').lean(),
      this.productModel.find({}).lean(),
      this.categoryModel.find({}).lean(),
      this.userModel.find({}).lean(),
    ]);

    const getOrderTime = (o: any) => {
      const d = o.createdAt || o.dateAdded;
      if (d) {
        const t = new Date(d).getTime();
        if (!isNaN(t)) return t;
      }
      if (o._id && typeof o._id.getTimestamp === 'function') {
        return o._id.getTimestamp().getTime();
      }
      return 0;
    };

    const getOrderAmount = (o: any) => {
      const amt = Number(o.totalAmount !== undefined && o.totalAmount !== null ? o.totalAmount : (o.cart?.totalPrice !== undefined ? o.cart.totalPrice : (o.amount || 0)));
      return isNaN(amt) ? 0 : amt;
    };

    const normalizeStatus = (st: any): string => {
      if (!st) return 'PENDING';
      const upper = String(st).trim().toUpperCase();
      if (upper === 'NEW') return 'PENDING';
      if (upper === 'COMPLETED') return 'DELIVERED';
      if (upper === 'CANCELED') return 'CANCELLED';
      if (upper === 'RETURN') return 'RETURNED';
      return upper;
    };

    const isPaid = (o: any) => {
      const st = normalizeStatus(o.status || o.statusHistory?.[0]?.status);
      if (st === 'CANCELLED' || st === 'RETURNED' || st === 'DELIVERY_FAILED') return false;
      const paySt = String(o.paymentStatus || o.payment?.status || '').toUpperCase();
      return paySt === 'PAID' || st === 'DELIVERED' || paySt === 'COMPLETED';
    };

    // Category mapping
    const categoryMap = new Map<string, string>();
    for (const c of allCategories) {
      const title = c.vi?.title || c.title || c.titleUrl || 'Danh mục';
      categoryMap.set(String(c._id), title);
      if (c.titleUrl) categoryMap.set(c.titleUrl, title);
    }

    // User mapping for customer name lookup
    const userMap = new Map<string, string>();
    for (const u of allUsers) {
      userMap.set(String(u._id), u.fullName || u.name || u.email);
    }

    // Customer Users calculation (Exclude Admin & staff)
    const isCustomer = (u: any) => {
      if (u.isAdmin === true) return false;
      const roles = Array.isArray(u.roles) ? u.roles : (u.roles ? [u.roles] : (Array.isArray(u.role) ? u.role : (u.role ? [u.role] : [])));
      const hasAdmin = roles.some((r: any) => typeof r === 'string' && (r.toLowerCase() === 'admin' || r.toLowerCase() === 'super-admin'));
      return !hasAdmin;
    };

    const customerUsers = allUsers.filter(isCustomer);
    const usersCount = customerUsers.length;
    let new7DaysUsers = 0;
    let new30DaysUsers = 0;
    for (const u of customerUsers) {
      const d = (u as any).createdAt || (u as any).dateAdded;
      if (d) {
        const ud = new Date(d);
        if (!isNaN(ud.getTime())) {
          if (ud >= sevenDaysAgo) new7DaysUsers++;
          if (ud >= thirtyDaysAgo) new30DaysUsers++;
        }
      }
    }

    // 4. Biểu đồ timeline
    const revenueTimeline: { label: string; date: string; fullDate?: string; revenue: number; ordersCount: number }[] = [];
    const curDay = new Date(periodStart);
    while (curDay <= periodEnd) {
      const dStart = new Date(curDay.getFullYear(), curDay.getMonth(), curDay.getDate(), 0, 0, 0, 0).getTime();
      const dEnd   = new Date(curDay.getFullYear(), curDay.getMonth(), curDay.getDate(), 23, 59, 59, 999).getTime();

      const dayOrders = allOrders.filter(o => {
        const t = getOrderTime(o);
        return t >= dStart && t <= dEnd;
      });

      const dayRevenue = dayOrders.filter(isPaid).reduce((sum, o) => sum + getOrderAmount(o), 0);
      const label = `${String(curDay.getDate()).padStart(2, '0')}/${String(curDay.getMonth() + 1).padStart(2, '0')}`;
      const fullDate = `${label}/${curDay.getFullYear()}`;
      const dateStr = `${curDay.getFullYear()}-${String(curDay.getMonth() + 1).padStart(2, '0')}-${String(curDay.getDate()).padStart(2, '0')}`;

      revenueTimeline.push({
        label,
        date: dateStr,
        fullDate,
        revenue: dayRevenue,
        ordersCount: dayOrders.length,
      });

      curDay.setDate(curDay.getDate() + 1);
    }

    // 5. Đơn hàng trong kỳ (period) + theo trạng thái
    const pStart = periodStart.getTime();
    const pEnd   = periodEnd.getTime();
    const periodOrders = allOrders.filter(o => { const t = getOrderTime(o); return t >= pStart && t <= pEnd; });
    const prevOrders   = allOrders.filter(o => { const t = getOrderTime(o); return t >= prevStart.getTime() && t <= prevEnd.getTime(); });

    const periodRevenue      = periodOrders.filter(isPaid).reduce((s, o) => s + getOrderAmount(o), 0);
    const prevPeriodRevenue  = prevOrders.filter(isPaid).reduce((s, o) => s + getOrderAmount(o), 0);
    const periodOrdersCount  = periodOrders.length;
    const prevPeriodOrdersCount = prevOrders.length;

    const fst = (orders: any[], ...st: string[]) => {
      const upperSt = st.map(s => s.toUpperCase());
      return orders.filter(o => {
        const norm = normalizeStatus(o.status || o.statusHistory?.[0]?.status);
        return upperSt.includes(norm);
      }).length;
    };

    const ordersByStatus: Record<string, number> = {
      delivered:       fst(periodOrders, OrderStatus.DELIVERED, 'COMPLETED'),
      shipping:        fst(periodOrders, OrderStatus.SHIPPING),
      processing:      fst(periodOrders, OrderStatus.PROCESSING, 'CONFIRMED'),
      pending:         fst(periodOrders, OrderStatus.PENDING, 'NEW'),
      cancelled:       fst(periodOrders, OrderStatus.CANCELLED, 'CANCELED'),
      returned:        fst(periodOrders, OrderStatus.RETURNED, 'RETURN', 'DELIVERY_FAILED'),
    };

    // UPPERCASE aliases for compatibility
    ordersByStatus['DELIVERED'] = ordersByStatus['delivered'];
    ordersByStatus['SHIPPING'] = ordersByStatus['shipping'];
    ordersByStatus['PROCESSING'] = ordersByStatus['processing'];
    ordersByStatus['PENDING'] = ordersByStatus['pending'];
    ordersByStatus['CANCELLED'] = ordersByStatus['cancelled'];
    ordersByStatus['RETURNED'] = ordersByStatus['returned'];

    // 6. Tồn kho & Sản phẩm sắp hết hàng (<= 5)
    let outOfStockCount = 0;
    let inStockCount = 0;
    let totalStock = 0;
    const lowStockProducts: any[] = [];

    for (const p of allProducts) {
      const vi = (p as any).vi || {};
      let qty = 0;

      if (Array.isArray((p as any).variants) && (p as any).variants.length > 0) {
        qty = (p as any).variants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0);
      } else if (typeof p.quantity === 'number') {
        qty = p.quantity;
      } else if (typeof vi.quantity === 'number') {
        qty = vi.quantity;
      } else if (typeof (p as any).stock === 'number') {
        qty = (p as any).stock;
      } else if (typeof vi.stock === 'number') {
        qty = vi.stock;
      }

      totalStock += qty;

      if (qty === 0 || vi.stock === 'outOfStock' || (p as any).stock === 'outOfStock') {
        outOfStockCount++;
      } else {
        inStockCount++;
      }

      if (qty <= 5) {
        const rawCat = vi.categoryLevel1 || p.categoryLevel1;
        const catKey = Array.isArray(rawCat) ? rawCat[0] : rawCat;
        const catName = categoryMap.get(String(catKey)) || (typeof catKey === 'string' && catKey.trim() ? catKey.trim() : 'Thời trang nữ');

        lowStockProducts.push({
          id: String(p._id),
          name: vi.title || p.title || (p as any).titleUrl || 'Sản phẩm',
          sku: (p as any).variants?.[0]?.sku || vi.sku || p.sku || ('SP-' + String(p._id).slice(-6).toUpperCase()),
          stock: qty,
          price: vi.salePrice || vi.regularPrice || p.regularPrice || 0,
          image: p.mainImage?.url || (Array.isArray(p.images) ? p.images[0] : ''),
          category: catName,
        });
      }
    }

    lowStockProducts.sort((a, b) => a.stock - b.stock);
    const topLowStock = lowStockProducts.slice(0, 5);

    // 7. Top sản phẩm bán chạy (chỉ từ các đơn đủ điều kiện kinh doanh)
    const productSalesMap = new Map<string, { id: string; title: string; name: string; sku: string; image: string; totalSold: number; revenue: number }>();
    for (const order of allOrders) {
      if (!isPaid(order)) continue;
      const items = (Array.isArray(order.items) && order.items.length > 0)
        ? order.items
        : (Array.isArray((order as any).cart?.items) ? (order as any).cart.items : []);

      for (const item of items) {
        const key = String(item.productId || item.productSnapshot?.sku || item.id || (item as any).item?._id || 'item');
        const name = item.name || item.productSnapshot?.name || item.productSnapshot?.title || (item as any).item?.vi?.title || (item as any).item?.title || 'Sản phẩm';
        const image = item.image || item.productSnapshot?.image || (item as any).item?.mainImage?.url || (Array.isArray((item as any).item?.images) ? (item as any).item.images[0] : '');
        const sku = item.sku || item.productSnapshot?.sku || (item as any).item?.vi?.sku || (item as any).item?.sku || '';
        const qty = Number(item.quantity || (item as any).qty || 1);
        const price = Number(item.unitPrice || item.price || (item as any).item?.salePrice || 0);

        const existing = productSalesMap.get(key) || {
          id: key,
          title: name,
          name,
          sku,
          image,
          totalSold: 0,
          revenue: 0,
        };
        existing.totalSold += qty;
        existing.revenue += qty * price;
        productSalesMap.set(key, existing);
      }
    }

    const topSellingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    // 8. Đơn hàng gần nhất (5 đơn)
    const recentOrders = allOrders.slice(0, 5).map(o => {
      let customerName = 'Khách hàng';
      if (o.customer?.name && o.customer.name.trim()) {
        customerName = o.customer.name.trim();
      } else if (o.shippingAddress?.fullName && o.shippingAddress.fullName.trim()) {
        customerName = o.shippingAddress.fullName.trim();
      } else if (typeof o.shippingAddress?.address === 'string' && (o.shippingAddress as any).name) {
        customerName = (o.shippingAddress as any).name.trim();
      } else if (Array.isArray((o as any).addresses) && (o as any).addresses[0]?.name) {
        customerName = (o as any).addresses[0].name.trim();
      } else if (o.userId && userMap.has(String(o.userId))) {
        customerName = userMap.get(String(o.userId)) || 'Khách hàng';
      } else if ((o as any)._user && userMap.has(String((o as any)._user))) {
        customerName = userMap.get(String((o as any)._user)) || 'Khách hàng';
      } else if ((o as any).customerName && typeof (o as any).customerName === 'string') {
        customerName = (o as any).customerName;
      }

      const customerEmail = o.customerEmail || o.customer?.email || (o.shippingAddress as any)?.email || (Array.isArray((o as any).addresses) ? (o as any).addresses[0]?.email : '') || '';
      const rawStatus = normalizeStatus(o.status || (o as any).statusHistory?.[0]?.status);
      const totalAmount = getOrderAmount(o);
      const createdAt = new Date(getOrderTime(o)).toISOString();

      const statusLabels: Record<string, string> = {
        PENDING: 'Chờ xác nhận',
        CONFIRMED: 'Đã xác nhận',
        PROCESSING: 'Đang xử lý',
        SHIPPING: 'Đang giao',
        DELIVERED: 'Đã giao',
        CANCELLED: 'Đã hủy',
        RETURNED: 'Đã hoàn trả',
        DELIVERY_FAILED: 'Giao thất bại',
      };

      const statusVariants: Record<string, string> = {
        PENDING: 'neutral',
        CONFIRMED: 'primary',
        PROCESSING: 'warning',
        SHIPPING: 'primary',
        DELIVERED: 'success',
        CANCELLED: 'danger',
        RETURNED: 'neutral',
        DELIVERY_FAILED: 'danger',
      };

      return {
        _id: String(o._id),
        id: String(o._id),
        orderId: o.orderId || ('#DH' + String(o._id).slice(-6).toUpperCase()),
        code: o.orderId || ('#DH' + String(o._id).slice(-6).toUpperCase()),
        customerName,
        customer: customerName,
        customerEmail,
        totalAmount,
        total: totalAmount,
        status: statusLabels[rawStatus] || rawStatus,
        statusLabel: statusLabels[rawStatus] || rawStatus,
        statusCode: rawStatus,
        statusVariant: statusVariants[rawStatus] || 'neutral',
        createdAt,
        date: createdAt,
      };
    });

    return {
      totalRevenue: periodRevenue,
      prevPeriodRevenue,
      ordersCount: periodOrdersCount,
      prevPeriodOrdersCount,
      productsCount: allProducts.length,
      categoriesCount: allCategories.length,
      usersCount,
      outOfStockCount,
      lowStockCount: lowStockProducts.length,
      lowStockThreshold: 5,
      customers: {
        total: usersCount,
        new7Days: new7DaysUsers,
        new30Days: new30DaysUsers,
      },
      revenueTimeline,
      ordersByStatus,
      inventory: {
        totalStock,
        outOfStockCount,
        lowStockCount: lowStockProducts.length,
        inStockCount,
      },
      topSellingProducts,
      lowStockProducts: topLowStock,
      recentOrders,
    };
  }

  async getAdminOrders(query: any = {}): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.status) {
      const statusUpper = String(query.status).trim().toUpperCase();
      if (statusUpper === 'PENDING') {
        filter.$or = [{ status: OrderStatus.PENDING }, { status: 'NEW' }];
      } else if (statusUpper === 'CONFIRMED') {
        filter.$or = [
          { status: OrderStatus.CONFIRMED },
          { status: OrderStatus.PROCESSING },
          { status: 'CONFIRMED' },
          { status: 'PROCESSING' },
        ];
      } else if (statusUpper === 'PROCESSING') {
        filter.$or = [{ status: OrderStatus.PROCESSING }, { status: 'PROCESSING' }];
      } else if (statusUpper === 'SHIPPING') {
        filter.status = OrderStatus.SHIPPING;
      } else if (statusUpper === 'DELIVERED') {
        filter.$or = [{ status: OrderStatus.DELIVERED }, { status: 'COMPLETED' }];
      } else if (statusUpper === 'CANCELLED') {
        filter.$or = [
          { status: OrderStatus.CANCELLED },
          { status: 'CANCELLED' },
          { status: 'CANCELED' },
        ];
      } else if (statusUpper === 'RETURN_PENDING') {
        filter.$or = [
          { 'returnRequests.status': ReturnRequestStatus.PENDING },
          { 'returnRequest.status': 'PENDING' },
        ];
      } else if (statusUpper === 'RETURNED' || statusUpper === 'RETURN_REQUESTS' || statusUpper === 'RETURN') {
        filter.$or = [
          { status: OrderStatus.RETURNED },
          { type: 'RETURN' },
          { 'returnRequests.0': { $exists: true } },
          { 'returnRequest.status': { $exists: true } },
        ];
      } else {
        filter.status = statusUpper;
      }
    }

    if (query.paymentMethod) {
      const pm = String(query.paymentMethod).trim();
      const pmOr = [
        { 'payment.method': pm },
        { 'paymentMethodSnapshot.code': pm },
        { type: pm },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: pmOr }];
        delete filter.$or;
      } else {
        filter.$or = pmOr;
      }
    }

    if (query.search) {
      const s = String(query.search).trim();
      const regex = new RegExp(s, 'i');
      const searchOr = [
        { orderId: regex },
        { customerEmail: regex },
        { customerPhone: regex },
        { 'customer.name': regex },
        { 'customer.email': regex },
        { 'shippingAddress.fullName': regex },
        { 'shippingAddress.phone': regex },
      ];
      if (filter.$and) {
        filter.$and.push({ $or: searchOr });
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const [total, pendingReturnCount] = await Promise.all([
      this.orderModel.countDocuments(filter),
      this.orderModel.countDocuments({
        $or: [
          { 'returnRequests.status': ReturnRequestStatus.PENDING },
          { 'returnRequest.status': 'PENDING' },
        ],
      }),
    ]);

    const orders = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1, dateAdded: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const statusMap: Record<string, { label: string; variant: string }> = {
      PENDING: { label: 'Chờ xác nhận', variant: 'warning' },
      CONFIRMED: { label: 'Đã xác nhận', variant: 'info' },
      PROCESSING: { label: 'Đang xử lý', variant: 'info' },
      SHIPPING: { label: 'Đang giao', variant: 'primary' },
      DELIVERED: { label: 'Đã giao', variant: 'success' },
      CANCELLED: { label: 'Đã hủy', variant: 'danger' },
      RETURNED: { label: 'Đã hoàn trả', variant: 'neutral' },
      DELIVERY_FAILED: { label: 'Giao thất bại', variant: 'danger' },
    };

    const formatted = orders.map((o: any) => {
      const statusKey = String(o.status || 'PENDING').toUpperCase();
      const statusMeta = statusMap[statusKey] || {
        label: o.status || 'Không rõ',
        variant: 'neutral',
      };
      const isGuest = !o.userId && !o._user;
      const rawCustomerName =
        o.customer?.name ||
        o.shippingAddress?.fullName ||
        (o.addresses && o.addresses[0]?.name) ||
        o.customerEmail ||
        '';
      const customerName = rawCustomerName
        ? (isGuest ? `${rawCustomerName} (Khách vãng lai)` : rawCustomerName)
        : 'Khách vãng lai';

      const totalVal = o.totalAmount ?? o.amount ?? o.subtotal ?? o.total ?? 0;
      const paymentMethodName =
        o.paymentMethodSnapshot?.name ||
        o.payment?.provider ||
        o.payment?.method ||
        o.type ||
        'COD';

      const returnRequests = Array.isArray(o.returnRequests) && o.returnRequests.length > 0
        ? o.returnRequests
        : (o.returnRequest ? [o.returnRequest] : []);
      const pendingReq = returnRequests.find((r: any) => r.status === ReturnRequestStatus.PENDING || r.status === 'PENDING');
      const activeReq = pendingReq || (returnRequests.length > 0 ? returnRequests[returnRequests.length - 1] : null);
      const hasPendingReturn = Boolean(pendingReq);

      return {
        ...o,
        id: o._id?.toString() || o.id,
        code: o.orderId || ('#' + String(o._id).slice(-6).toUpperCase()),
        customer: customerName,
        isGuest,
        customerType: isGuest ? 'GUEST' : 'MEMBER',
        total: totalVal,
        payment: paymentMethodName,
        status: o.status,
        statusText: statusMeta.label,
        statusVariant: statusMeta.variant,
        returnRequestsCount: returnRequests.length,
        hasPendingReturn,
        latestReturnStatus: activeReq ? activeReq.status : null,
        latestReturnRequestId: activeReq ? activeReq.requestId : null,
        latestReturnRequestedAmount: activeReq ? (activeReq.refund?.requestedAmount || 0) : 0,
        createdAt: o.createdAt || o.dateAdded,
      };
    });

    return {
      success: true,
      data: formatted,
      pendingReturnCount,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
