import { Logger, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import Stripe from 'stripe';

import { Order, OrderStatus, PaymentStatus } from './models/order.model';
import { User } from '../auth/models/user.model';
import { OrderDto } from './dto/order.dto';
import { sendMsg } from '../shared/utils/email/mailer';
import { Translation } from '../translations/translation.model';

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
  ) {}

  async validateCoupon(code: string, subtotal: number): Promise<{
    valid: boolean;
    code?: string;
    description?: string;
    discountType?: string;
    discountValue?: number;
    discountAmount?: number;
    message: string;
  }> {
    if (!code || !code.trim()) {
      return { valid: false, message: 'Vui lòng nhập mã giảm giá' };
    }

    const cleanCode = code.trim().toUpperCase();
    await this.ensureDefaultCoupons();

    const coupon = await this.couponModel.findOne({
      code: cleanCode,
      isActive: true,
    });

    if (!coupon) {
      return { valid: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' };
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return { valid: false, message: 'Chương trình ưu đãi chưa bắt đầu' };
    }
    if (coupon.endDate && new Date(coupon.endDate) < now) {
      return { valid: false, message: 'Mã giảm giá đã hết hạn sử dụng' };
    }
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, message: 'Mã giảm giá đã hết lượt sử dụng' };
    }
    if (coupon.minOrderValue > 0 && subtotal < coupon.minOrderValue) {
      const minFormatted = coupon.minOrderValue.toLocaleString('vi-VN');
      return {
        valid: false,
        message: `Mã ${cleanCode} chỉ áp dụng cho đơn hàng từ ${minFormatted} ₫ trở lên`,
      };
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    return {
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
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

  // ─── Xóa order ────────────────────────────────────────────────────────────
  async removeOrder(id: string): Promise<any> {
    return this.orderModel.findOneAndDelete({
      $or: [{ orderId: id }, { _id: id }],
    });
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
        return { error: 'Vui lòng nhập mã đơn hàng hoặc mã vận đơn.' };
      }
      if (!inputAuthContact) {
        return { error: 'Vui lòng nhập email hoặc số điện thoại để xác thực.' };
      }

      const isEmail = inputAuthContact.includes('@');
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
          const cleanPhone = inputAuthContact.replace(/[\s\.\-\(\)]/g, '');
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

      // Che 4 số giữa của số điện thoại cho khách vãng lai
      const rawPhone = order.shippingAddress?.phone || order.addresses?.[0]?.phone || '';
      const maskedPhone = rawPhone && rawPhone.length >= 7
        ? rawPhone.slice(0, 3) + '****' + rawPhone.slice(-3)
        : rawPhone;

      // Chuẩn hóa địa chỉ nhận hàng
      const addr = order.shippingAddress || (Array.isArray(order.addresses) ? order.addresses[0] : null) || {};
      const fullAddress = [
        addr.line1 || addr.address,
        addr.line2,
        addr.ward,
        addr.district,
        addr.city || addr.province,
        addr.country
      ].filter(Boolean).join(', ');

      // Chuẩn hóa danh sách sản phẩm (hỗ trợ cả order.items và order.cart.items)
      const items = (Array.isArray(order.items) && order.items.length > 0)
        ? order.items.map((it: any) => ({
            title: it.productSnapshot?.title || 'Sản phẩm',
            sku: it.productSnapshot?.sku || '',
            image: it.productSnapshot?.image || '',
            variant: it.productSnapshot?.variant || null,
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            subtotal: it.subtotal || ((it.unitPrice || 0) * (it.quantity || 1))
          }))
        : (order.cart?.items || []).map((it: any) => ({
            title: it.item?.title || 'Sản phẩm',
            sku: it.item?.sku || '',
            image: it.item?.mainImage?.url || it.item?.images?.[0] || '',
            variant: it.item?.variants?.[0] ? {
              color: it.item.variants[0].color,
              size: it.item.variants[0].size,
              classification: it.item.variants[0].classification
            } : (it.variant || null),
            quantity: it.qty || 1,
            unitPrice: it.price || 0,
            subtotal: (it.price || 0) * (it.qty || 1)
          }));

      // Chuẩn hóa logs vận chuyển và lịch sử trạng thái
      const shippingLogs = Array.isArray(order.shipping?.logs) && order.shipping.logs.length > 0
        ? order.shipping.logs
        : (Array.isArray(order.shippingLogs) ? order.shippingLogs : []);

      const statusHistory = Array.isArray(order.statusHistory)
        ? order.statusHistory.map((h: any) => ({
            status: h.status,
            updatedAt: h.updatedAt || h.timestamp,
            note: h.note || h.description || ''
          }))
        : [];

      return {
        orderId: order.orderId,
        status: order.status || order.shipping?.status,
        trackingNumber: order.shipping?.trackingNumber || order.trackingNumber || null,
        trackingUrl: order.shipping?.trackingUrl || order.trackingUrl || null,
        carrierName: order.shipping?.carrierName || order.shippingProvider || order.shippingMethodSnapshot?.name || null,
        estimatedDelivery: order.shipping?.estimatedDelivery || order.estimatedDeliveryDate || null,
        dateAdded: order.dateAdded || order.createdAt || null,
        shippedAt: order.shippedAt || null,
        deliveredAt: order.deliveredAt || null,
        shippingAddress: {
          name: addr.name || addr.fullName || addr.receiverName || '',
          phone: maskedPhone,
          line1: addr.line1 || addr.address || '',
          line2: addr.line2 || '',
          ward: addr.ward || '',
          district: addr.district || '',
          city: addr.city || addr.province || '',
          country: addr.country || 'Việt Nam',
          fullAddress: fullAddress || 'Theo thông tin đăng ký'
        },
        shippingLogs,
        statusHistory,
        items,
        paymentMethod: order.type || order.paymentMethod || order.paymentMethodSnapshot?.name || 'COD',
        subtotal: order.cart?.totalPrice ?? order.subtotal ?? 0,
        shippingFee: order.cart?.shippingCost ?? order.shippingFee ?? 0,
        totalAmount: order.amount ?? order.totalAmount ?? 0,
        currency: order.currency || 'VND'
      };
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


  // ─── Thêm order COD ───────────────────────────────────────────────────────
  async addOrder(
    orderDto: OrderDto,
    user: User | null,
    lang = 'vi',
  ): Promise<{ error: string; result: Order }> {
    try {
      const orderData = await this.buildOrderData(orderDto, user, 'COD');
      const newOrder = new this.orderModel(orderData);
      await newOrder.save();

      // Xóa các sản phẩm đã đặt khỏi giỏ hàng của user
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
      }

      if (newOrder.couponCode) {
        await this.couponModel.updateOne(
          { code: newOrder.couponCode },
          { $inc: { usedCount: 1 } }
        );
      }

      await this.sendOrderEmail(newOrder, lang);
      return { error: '', result: newOrder };
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
  ): Promise<{ error: string; result: Order }> {
    try {
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
      if (capturePayment) {
        newOrder.paymentStatus = PaymentStatus.PAID;
        newOrder.paidAt = new Date();
        await newOrder.save();

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
        }

        if (newOrder.couponCode) {
          await this.couponModel.updateOne(
            { code: newOrder.couponCode },
            { $inc: { usedCount: 1 } }
          );
        }

        await this.sendOrderEmail(newOrder, lang);
      }

      return { error: '', result: newOrder };
    } catch (err) {
      this.logger.error(err.stack || err.message);
      return { error: 'ORDER_CREATION_FAIL', result: null };
    }
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
      discountAmount: 0,
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
      const productId = cartItem.productId;
      const variantId = cartItem.variantId;
      const quantity = cartItem.quantity || 1;

      const product = await this.productModel.findById(productId).lean() as any;
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

      orderItems.push({
        productId: new Types.ObjectId(productId.toString()),
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

        if (item.productId) {
          await this.productModel.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -item.quantity },
          });
        }
      } else if (item.productId) {
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

  async getNotifications(): Promise<any[]> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [orders, products, users] = await Promise.all([
      this.orderModel.find({
        $or: [
          { createdAt: { $gte: since } },
          { dateAdded: { $gte: since } },
        ],
      }).sort('-createdAt').lean(),
      this.productModel.find({}).select('title titleUrl stock dateAdded quantity').lean(),
      this.userModel.find({
        $or: [
          { createdAt: { $gte: since } },
          { dateAdded: { $gte: since } },
        ],
      }).select('email name fullName status createdAt dateAdded').sort('-createdAt').lean(),
    ]);

    const notifications: any[] = [];

    // ── 🔔 ĐƠN HÀNG ──────────────────────────────────────────────────────────
    const newOrders = orders.filter(o => o.status === OrderStatus.PENDING || (o as any).status === 'NEW');
    if (newOrders.length) {
      notifications.push({
        id: 'orders-new',
        group: 'orders',
        icon: 'new-order',
        title: 'Có đơn hàng mới',
        message: `${newOrders.length} đơn hàng mới chờ xử lý`,
        count: newOrders.length,
        level: 'info',
        time: newOrders[0]?.createdAt || (newOrders[0] as any)?.dateAdded,
      });
    }

    const confirmedOrders = orders.filter(
      o => o.status === OrderStatus.CONFIRMED || (o as any).status === 'CONFIRMED' ||
           o.status === OrderStatus.PROCESSING || (o as any).status === 'PROCESSING'
    );
    if (confirmedOrders.length) {
      notifications.push({
        id: 'orders-confirmed',
        group: 'orders',
        icon: 'confirmed',
        title: 'Đơn đã xác nhận cần xuất kho',
        message: `${confirmedOrders.length} đơn đã xác nhận và cần xuất kho`,
        count: confirmedOrders.length,
        level: 'info',
        time: confirmedOrders[0]?.createdAt || (confirmedOrders[0] as any)?.dateAdded,
      });
    }

    const paidOrders = orders.filter(o => o.paymentStatus === PaymentStatus.PAID || (o as any).status === 'PAID');
    if (paidOrders.length) {
      notifications.push({
        id: 'orders-paid',
        group: 'orders',
        icon: 'paid',
        title: 'Đơn hàng được thanh toán',
        message: `${paidOrders.length} đơn đã thanh toán thành công`,
        count: paidOrders.length,
        level: 'success',
        time: paidOrders[0]?.createdAt || (paidOrders[0] as any)?.dateAdded,
      });
    }

    const canceledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED || (o as any).status === 'CANCELLED' || (o as any).status === 'CANCELED');
    if (canceledOrders.length) {
      notifications.push({
        id: 'orders-canceled',
        group: 'orders',
        icon: 'cancel',
        title: 'Đơn hàng bị hủy',
        message: `${canceledOrders.length} đơn hàng đã bị hủy`,
        count: canceledOrders.length,
        level: 'error',
        time: canceledOrders[0]?.createdAt || (canceledOrders[0] as any)?.dateAdded,
      });
    }

    const returnOrders = orders.filter(
      o => o.status === OrderStatus.RETURNED ||
           (o as any).type === 'RETURN' ||
           (o.notes && /đổi|trả|refund|return/i.test(o.notes)),
    );
    if (returnOrders.length) {
      notifications.push({
        id: 'orders-return',
        group: 'orders',
        icon: 'return',
        title: 'Đơn hàng yêu cầu đổi/trả',
        message: `${returnOrders.length} đơn yêu cầu đổi/trả`,
        count: returnOrders.length,
        level: 'warning',
        time: returnOrders[0]?.createdAt || (returnOrders[0] as any)?.dateAdded,
      });
    }

    // ── 🔔 SẢN PHẨM & KHO ────────────────────────────────────────────────────
    const outOfStock = products.filter(p => p.stock === 'outOfStock' || p.stock === 'out' || p.quantity === 0);
    if (outOfStock.length) {
      notifications.push({
        id: 'stock-out',
        group: 'products',
        icon: 'out-of-stock',
        title: 'Sản phẩm hết hàng',
        message: `${outOfStock.length} sản phẩm đã hết hàng`,
        count: outOfStock.length,
        level: 'error',
        items: outOfStock.slice(0, 3).map((p: any) => p.title || p.titleUrl),
      });
    }

    const lowStock = products.filter(
      p => p.stock === 'lowStock' || p.stock === 'low' ||
           (typeof p.quantity === 'number' && p.quantity > 0 && p.quantity <= 5),
    );
    if (lowStock.length) {
      notifications.push({
        id: 'stock-low',
        group: 'products',
        icon: 'low-stock',
        title: 'Sản phẩm sắp hết hàng',
        message: `${lowStock.length} sản phẩm sắp hết hàng`,
        count: lowStock.length,
        level: 'warning',
        items: lowStock.slice(0, 3).map((p: any) => p.title || p.titleUrl),
      });
    }

    const recentlyRestocked = products.filter(p => {
      if (p.stock !== 'inStock' && p.stock !== 'in' && (!p.quantity || p.quantity <= 0)) return false;
      const d = (p as any).dateAdded || (p as any).updatedAt;
      return d && new Date(d) >= since;
    });
    if (recentlyRestocked.length) {
      notifications.push({
        id: 'stock-in',
        group: 'products',
        icon: 'restock',
        title: 'Nhập kho thành công',
        message: `${recentlyRestocked.length} sản phẩm được cập nhật vào kho`,
        count: recentlyRestocked.length,
        level: 'success',
      });
    }

    const recentlyShipped = orders.filter(
      o => o.status === OrderStatus.SHIPPING || o.status === OrderStatus.DELIVERED,
    );
    if (recentlyShipped.length) {
      notifications.push({
        id: 'stock-out-shipped',
        group: 'products',
        icon: 'shipped',
        title: 'Xuất kho thành công',
        message: `${recentlyShipped.length} đơn hàng đã xuất kho`,
        count: recentlyShipped.length,
        level: 'info',
      });
    }

    // ── 🔔 NGƯỜI DÙNG ─────────────────────────────────────────────────────────
    const newUsers = users.filter(u => {
      const d = (u as any).createdAt || (u as any).dateAdded;
      return d && new Date(d) >= since;
    });
    if (newUsers.length) {
      notifications.push({
        id: 'users-new',
        group: 'users',
        icon: 'new-user',
        title: 'Người dùng mới đăng ký',
        message: `${newUsers.length} tài khoản mới trong 30 ngày`,
        count: newUsers.length,
        level: 'info',
        time: (newUsers[0] as any)?.createdAt || (newUsers[0] as any)?.dateAdded,
      });
    }

    const totalLockedCount = await this.userModel.countDocuments({ status: false });
    if (totalLockedCount > 0) {
      notifications.push({
        id: 'users-locked',
        group: 'users',
        icon: 'locked-user',
        title: 'Người dùng bị khóa/kích hoạt',
        message: `${totalLockedCount} tài khoản đang bị khóa`,
        count: totalLockedCount,
        level: 'warning',
      });
    }

    return notifications;
  }

  async getDashboardDetailedStats(period: 'week' | 'month' = 'week'): Promise<any> {
    const now = new Date();
    const days = period === 'week' ? 7 : 30;

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [allOrders, allProducts, allCategories, allUsers] = await Promise.all([
      this.orderModel.find({}).sort('-createdAt').lean(),
      this.productModel.find({}).lean(),
      this.categoryModel.find({}).lean(),
      this.userModel.find({}).lean(),
    ]);

    const getOrderTime = (o: any) => {
      const d = o.createdAt || o.dateAdded;
      return d ? new Date(d).getTime() : 0;
    };

    const isPaid = (o: any) =>
      o.paymentStatus === PaymentStatus.PAID ||
      o.status === OrderStatus.DELIVERED ||
      (o as any).status === 'PAID';

    // 1. Tổng doanh thu (từ các đơn hoàn tất / đã thanh toán)
    const totalRevenue = allOrders
      .filter(isPaid)
      .reduce((sum, o) => sum + (o.totalAmount || (o as any).amount || 0), 0);

    // 2. Số lượng các chỉ số
    const ordersCount = allOrders.length;
    const productsCount = allProducts.length;
    const categoriesCount = allCategories.length;
    const usersCount = allUsers.length;

    // 3. User mới trong 7 ngày
    const new7DaysUsers = allUsers.filter(u => {
      const d = (u as any).createdAt || (u as any).dateAdded;
      return d && new Date(d) >= sevenDaysAgo;
    }).length;

    // 4. Biểu đồ timeline
    const revenueTimeline: { label: string; date: string; revenue: number; ordersCount: number }[] = [];
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime();
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

      const dayOrders = allOrders.filter(o => {
        const t = getOrderTime(o);
        return t >= dayStart && t <= dayEnd;
      });

      const dayRevenue = dayOrders
        .filter(isPaid)
        .reduce((sum, o) => sum + (o.totalAmount || (o as any).amount || 0), 0);

      const label = period === 'week'
        ? dayNames[d.getDay()]
        : `${d.getDate()}/${d.getMonth() + 1}`;

      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      revenueTimeline.push({
        label,
        date: dateStr,
        revenue: dayRevenue,
        ordersCount: dayOrders.length,
      });
    }

    // 5. Đơn hàng theo trạng thái
    const ordersByStatus = {
      pending: allOrders.filter(o => o.status === OrderStatus.PENDING || (o as any).status === 'NEW').length,
      confirmed: allOrders.filter(o => o.status === OrderStatus.CONFIRMED).length,
      processing: allOrders.filter(o => o.status === OrderStatus.PROCESSING).length,
      shipping: allOrders.filter(o => o.status === OrderStatus.SHIPPING).length,
      delivered: allOrders.filter(o => o.status === OrderStatus.DELIVERED || (o as any).status === 'COMPLETED').length,
      cancelled: allOrders.filter(o => o.status === OrderStatus.CANCELLED || (o as any).status === 'CANCELED').length,
      returned: allOrders.filter(o => o.status === OrderStatus.RETURNED || (o as any).type === 'RETURN').length,
    };

    // 6. Tồn kho
    const outOfStockCount = allProducts.filter(
      p => p.stock === 'outOfStock' || p.stock === 'out' || p.quantity === 0,
    ).length;
    const lowStockCount = allProducts.filter(
      p => p.stock === 'lowStock' || p.stock === 'low' || (typeof p.quantity === 'number' && p.quantity > 0 && p.quantity <= 5),
    ).length;
    const inStockCount = Math.max(0, productsCount - outOfStockCount);

    const totalStock = allProducts.reduce((sum, p) => sum + (typeof p.quantity === 'number' ? p.quantity : 1), 0);

    // 7. Top sản phẩm bán chạy (tính từ items trong orders)
    const productSalesMap = new Map<string, { title: string; sku: string; image: string; totalSold: number; revenue: number }>();
    for (const order of allOrders) {
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const key = String(item.productId || item.productSnapshot?.sku || 'item');
          const existing = productSalesMap.get(key) || {
            title: item.productSnapshot?.title || 'Sản phẩm',
            sku: item.productSnapshot?.sku || '',
            image: item.productSnapshot?.image || '',
            totalSold: 0,
            revenue: 0,
          };
          existing.totalSold += item.quantity || 1;
          existing.revenue += (item.unitPrice || 0) * (item.quantity || 1);
          productSalesMap.set(key, existing);
        }
      }
    }

    const topSellingProducts = Array.from(productSalesMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    // 8. Đơn hàng gần nhất (5 đơn)
    const recentOrders = allOrders.slice(0, 5).map(o => ({
      _id: o._id,
      orderId: o.orderId,
      customerName: o.customer?.name || o.shippingAddress?.fullName || (o as any).customerName || 'Khách hàng',
      customerEmail: o.customerEmail,
      totalAmount: o.totalAmount || (o as any).amount || 0,
      status: o.status,
      paymentStatus: o.paymentStatus || (o as any).payment?.status || 'PENDING',
      createdAt: o.createdAt || (o as any).dateAdded || new Date(),
    }));

    return {
      totalRevenue,
      ordersCount,
      productsCount,
      categoriesCount,
      usersCount,
      customers: {
        new7Days: new7DaysUsers,
      },
      revenueTimeline,
      ordersByStatus,
      inventory: {
        totalStock,
        outOfStockCount,
        lowStockCount,
        inStockCount,
      },
      topSellingProducts,
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
      } else if (statusUpper === 'RETURNED') {
        filter.$or = [{ status: OrderStatus.RETURNED }, { type: 'RETURN' }];
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

    const total = await this.orderModel.countDocuments(filter);
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
      const customerName =
        o.customer?.name ||
        o.shippingAddress?.fullName ||
        (o.addresses && o.addresses[0]?.name) ||
        o.customerEmail ||
        'Khách vãng lai';

      const totalVal = o.totalAmount ?? o.amount ?? o.subtotal ?? o.total ?? 0;
      const paymentMethodName =
        o.paymentMethodSnapshot?.name ||
        o.payment?.provider ||
        o.payment?.method ||
        o.type ||
        'COD';

      return {
        ...o,
        id: o._id?.toString() || o.id,
        code: o.orderId || ('#' + String(o._id).slice(-6).toUpperCase()),
        customer: customerName,
        total: totalVal,
        payment: paymentMethodName,
        status: o.status,
        statusText: statusMeta.label,
        statusVariant: statusMeta.variant,
        createdAt: o.createdAt || o.dateAdded,
      };
    });

    return {
      success: true,
      data: formatted,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
