import { Document, Types } from 'mongoose';

// ─── Enum (re-export từ schema để dùng ở service) ────────────────────────────
export { OrderStatus, PaymentStatus } from '../schemas/order.schema';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ProductSnapshot {
  title: string;
  sku: string;
  image?: string;
  variant?: {
    color?: string;
    size?: string;
    classification?: string;
  };
}

export interface OrderItem {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  productSnapshot: ProductSnapshot;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  ward?: string;
  district?: string;
  province?: string;
}

export interface ShippingMethodSnapshot {
  name: string;
  code: string;
  fee: number;
  estimatedDeliveryTime?: string;
}

export interface PaymentMethodSnapshot {
  name: string;
  code: string;
  paymentType: string;
  paymentFee: number;
}

export interface StatusHistoryEntry {
  status: string;
  updatedAt: Date;
  updatedBy?: Types.ObjectId;
  note?: string;
}

export interface Order extends Document {
  // Cơ bản
  orderId: string;
  _user?: Types.ObjectId;
  customerEmail: string;
  customerPhone?: string;
  status: string;
  notes?: string;

  // Sản phẩm
  items: OrderItem[];

  // Địa chỉ
  shippingAddress: ShippingAddress;

  // Vận chuyển
  shippingMethodId?: Types.ObjectId;
  shippingMethodSnapshot?: ShippingMethodSnapshot;
  shippingFee: number;
  shippingProvider?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;

  // Thanh toán
  paymentMethodId?: Types.ObjectId;
  paymentMethodSnapshot?: PaymentMethodSnapshot;
  paymentStatus: string;
  transactionId?: string;
  paymentProvider?: string;
  paymentFee: number;
  paidAt?: Date;
  refundedAmount: number;
  refundedAt?: Date;

  // Tổng tiền
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  couponCode?: string;
  couponDiscount: number;
  totalAmount: number;
  currency: string;

  // Lịch sử
  statusHistory: StatusHistoryEntry[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
