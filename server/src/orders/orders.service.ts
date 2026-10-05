import { Logger, Injectable, NotFoundException } from '@nestjs/common';
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

  constructor(
    @InjectModel('Order') private orderModel: Model<Order>,
    @InjectModel('Translation') private translationModel: Model<Translation>,
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('ProductVariant') private variantModel: Model<any>,
    @InjectModel('ShippingMethod') private shippingMethodModel: Model<any>,
    @InjectModel('PaymentMethod') private paymentMethodModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
  ) {}

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
        mappedStatus = OrderStatus.CONFIRMED;
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
    return this.shippingMethodModel.find({ status: 'ACTIVE' }).sort('name').lean();
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

      // Trừ tồn kho
      await this.decreaseStock(newOrder.items);

      // Xóa giỏ hàng của user sau khi đặt hàng thành công
      if (user) {
        await this.userModel.findByIdAndUpdate(user._id, {
          'cart.items': [],
        });
      }

      await this.sendOrderEmail(newOrder, lang);
      return { error: '', result: newOrder };
    } catch (err) {
      this.logger.error(err.stack || err.message);
      return { error: 'ORDER_CREATION_FAIL', result: null };
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
          await this.userModel.findByIdAndUpdate(user._id, {
            'cart.items': [],
          });
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
    // Lấy cart items từ DB user hoặc từ body (guest checkout)
    let cartItems: any[] = [];
    if (user) {
      const freshUser = await this.userModel.findById(user._id).lean() as any;
      cartItems = freshUser?.cart?.items || [];
    }

    if (!cartItems.length) {
      throw new Error('Giỏ hàng trống, không thể đặt hàng');
    }

    // Build items với snapshot
    const orderItems = await this.buildOrderItems(cartItems);

    if (!orderItems.length) {
      throw new Error('Không có sản phẩm hợp lệ để đặt hàng');
    }

    // Tính subtotal
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Lấy thông tin shipping method
    let shippingFee = 0;
    let shippingMethodId = null;
    let shippingMethodSnapshot = null;

    if (orderDto.shippingMethodId) {
      const shippingMethod = await this.shippingMethodModel
        .findById(orderDto.shippingMethodId)
        .lean() as any;
      if (shippingMethod) {
        shippingMethodId = shippingMethod._id;
        shippingFee = shippingMethod.baseFee;

        // Kiểm tra điều kiện miễn phí ship
        if (
          shippingMethod.freeShippingCondition?.enabled &&
          subtotal >= shippingMethod.freeShippingCondition.minimumOrderValue
        ) {
          shippingFee = 0;
        }

        shippingMethodSnapshot = {
          name: shippingMethod.name,
          code: shippingMethod.code,
          fee: shippingMethod.baseFee,
          estimatedDeliveryTime: shippingMethod.estimatedDeliveryTime,
        };
      }
    }

    // Lấy thông tin payment method
    let paymentFee = 0;
    let paymentMethodId = null;
    let paymentMethodSnapshot = null;

    if (orderDto.paymentMethodId) {
      const paymentMethod = await this.paymentMethodModel
        .findById(orderDto.paymentMethodId)
        .lean() as any;
      if (paymentMethod) {
        paymentMethodId = paymentMethod._id;

        if (paymentMethod.transactionFee?.enabled) {
          if (paymentMethod.transactionFee.type === 'PERCENTAGE') {
            paymentFee = Math.round((subtotal * paymentMethod.transactionFee.value) / 100);
          } else {
            paymentFee = paymentMethod.transactionFee.value;
          }
        }

        paymentMethodSnapshot = {
          name: paymentMethod.name,
          code: paymentMethod.code,
          paymentType: paymentMethod.paymentType,
          paymentFee,
        };
      }
    }

    const totalAmount = subtotal + shippingFee + paymentFee;
    const orderId = `CHE${Date.now()}${Math.floor(Math.random() * 1000)}`;

    return {
      orderId,
      _user: user ? new Types.ObjectId(user._id as string) : null,
      customerEmail: orderDto.email,
      customerPhone: orderDto.customerPhone || '',
      status: OrderStatus.PENDING,
      notes: orderDto.notes || '',
      items: orderItems,
      shippingAddress: orderDto.shippingAddress,
      shippingMethodId,
      shippingMethodSnapshot,
      shippingFee,
      paymentMethodId,
      paymentMethodSnapshot,
      paymentStatus: type === 'STRIPE' ? PaymentStatus.PENDING : PaymentStatus.PENDING,
      paymentFee,
      subtotal,
      discountAmount: 0,
      taxAmount: 0,
      couponCode: orderDto.couponCode || '',
      couponDiscount: 0,
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

      let unitPrice = product.salePrice || product.regularPrice || 0;
      const snapshot: any = {
        title: product.title || '',
        sku: product.sku || '',
        image: product.mainImage?.url || '',
      };

      if (variantId) {
        const variant = await this.variantModel.findById(variantId).lean() as any;
        if (variant) {
          availableQty = variant.stock !== undefined ? variant.stock : 0;
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

      orderItems.push({
        productId: new Types.ObjectId(productId.toString()),
        variantId: variantId ? new Types.ObjectId(variantId.toString()) : null,
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
        await this.variantModel.findByIdAndUpdate(item.variantId, {
          $inc: { stock: -item.quantity },
        });
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
}
