import { Document, Types } from 'mongoose';

// ─── Enum (re-export từ schema để dùng ở service) ────────────────────────────
export {
  OrderStatus,
  PaymentStatus,
  ReturnRequestStatus,
  RefundStatus,
} from '../schemas/order.schema';

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
  variantId?: Types.ObjectId | string | null;
  productSnapshot: ProductSnapshot;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ReturnItem {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId | string | null;
  productSnapshot: ProductSnapshot;
  quantity: number;
  boughtQuantity: number;
  unitPrice: number;
  subtotal: number;
  reason?: string;
  inspectedQuantity?: number;
  eligibleQuantity?: number;
  damagedQuantity?: number;
  isEligible?: boolean | null;
  conditionNotes?: string;
}

export interface ReturnHistoryEntry {
  action: string;
  fromStatus?: string;
  toStatus: string;
  updatedAt: Date;
  updatedBy?: Types.ObjectId | string | null;
  note?: string;
}

export interface ReturnRequest {
  requestId: string;
  requestedAt: Date;
  reason: string;
  description?: string;
  images?: string[];
  refundMethod: string;
  status: string;
  rejectionReason?: string;
  items: ReturnItem[];
  returnShipping?: {
    carrier?: string;
    trackingCode?: string;
    shippedAt?: Date | null;
    receivedAt?: Date | null;
    instructions?: string;
  };
  inspection?: {
    inspectedAt?: Date | null;
    inspectedBy?: Types.ObjectId | string | null;
    conditionNotes?: string;
    isEligible?: boolean | null;
    restocked?: boolean;
  };
  refund?: {
    status: string;
    requestedAmount: number;
    approvedAmount: number;
    refundedAmount: number;
    transactionId?: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    refundedAt?: Date | null;
    failureReason?: string;
    notes?: string;
  };
  history: ReturnHistoryEntry[];
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  ward?: string;
  district?: string;
  province?: string;
  provinceCode?: string;
  provinceName?: string;
  districtCode?: string;
  districtName?: string;
  wardCode?: string;
  wardName?: string;
  addressDetail?: string;
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

export interface ShippingLogEntry {
  status: string;
  location?: string;
  description?: string;
  timestamp: Date;
}

export interface CustomerSnapshot {
  name: string;
  email: string;
  phone: string;
}

export interface OrderPaymentInfo {
  method: string;
  status: string;
  provider?: string | null;
  transactionId?: string | null;
  paidAt?: Date | null;
  refundedAmount?: number;
  refundedAt?: Date | null;
  actualCollectedAmount?: number;
  codCollected?: boolean;
  codCollectedAt?: Date | null;
  codReconciliationStatus?: string;
  codReconciledAt?: Date | null;
}

export interface OrderShippingInfo {
  method: string;
  provider: string;
  trackingNumber?: string | null;
  estimatedDeliveryDate?: Date | null;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
}

export interface Order extends Document {
  // Cơ bản
  orderId: string;
  userId?: Types.ObjectId;
  _user?: Types.ObjectId;
  customer?: CustomerSnapshot;
  customerEmail: string;
  customerPhone?: string;
  status: string;
  notes?: string;

  // Thông tin hủy đơn hàng
  cancelReason?: string;
  cancelReasonDetail?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;

  // Sản phẩm
  items: OrderItem[];

  // Địa chỉ
  shippingAddress: ShippingAddress;

  // Vận chuyển
  shipping?: OrderShippingInfo;
  shippingMethodId?: Types.ObjectId;
  shippingMethodSnapshot?: ShippingMethodSnapshot;
  shippingFee: number;
  shippingProvider?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDeliveryDate?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  shippingLogs?: ShippingLogEntry[];

  // Thanh toán
  payment?: OrderPaymentInfo;
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

  // Yêu cầu đổi trả / hoàn tiền
  returnRequests?: ReturnRequest[];
  returnRequest?: any;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
