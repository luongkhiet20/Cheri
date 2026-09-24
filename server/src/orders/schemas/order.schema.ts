import * as mongoose from 'mongoose';
const { Schema } = mongoose;

// ─── Enum ────────────────────────────────────────────────────────────────────

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPING = 'SHIPPING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const ProductSnapshotSchema = new Schema(
  {
    title: { type: String, required: true },
    sku: { type: String, required: true },
    image: { type: String, default: '' },
    variant: {
      color: { type: String, default: '' },
      size: { type: String, default: '' },
      classification: { type: String, default: '' },
    },
  },
  { _id: false },
);

const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', default: null },
    productSnapshot: { type: ProductSnapshotSchema, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ShippingAddressSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    ward: { type: String, default: '' },
    district: { type: String, default: '' },
    province: { type: String, default: '' },
  },
  { _id: false },
);

const ShippingMethodSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    fee: { type: Number, required: true, min: 0 },
    estimatedDeliveryTime: { type: String, default: '' },
  },
  { _id: false },
);

const PaymentMethodSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    paymentType: { type: String, required: true },
    paymentFee: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const StatusHistorySchema = new Schema(
  {
    status: { type: String, required: true, enum: Object.values(OrderStatus) },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
  },
  { _id: false },
);

// ─── Main Order Schema ────────────────────────────────────────────────────────

const OrderSchema = new Schema(
  {
    // Thông tin cơ bản
    orderId: { type: String, required: true, unique: true, index: true },
    _user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    status: {
      type: String,
      required: true,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    notes: { type: String, default: '' },

    // Sản phẩm
    items: { type: [OrderItemSchema], required: true, default: [] },

    // Địa chỉ giao hàng (snapshot)
    shippingAddress: { type: ShippingAddressSchema, required: true },

    // Vận chuyển
    shippingMethodId: { type: Schema.Types.ObjectId, ref: 'ShippingMethod', default: null },
    shippingMethodSnapshot: { type: ShippingMethodSnapshotSchema, default: null },
    shippingFee: { type: Number, default: 0, min: 0 },
    shippingProvider: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    estimatedDeliveryDate: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },

    // Thanh toán
    paymentMethodId: { type: Schema.Types.ObjectId, ref: 'PaymentMethod', default: null },
    paymentMethodSnapshot: { type: PaymentMethodSnapshotSchema, default: null },
    paymentStatus: {
      type: String,
      required: true,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    transactionId: { type: String, default: '' },
    paymentProvider: { type: String, default: '' },
    paymentFee: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date, default: null },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refundedAt: { type: Date, default: null },

    // Tổng tiền
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: '' },
    couponDiscount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: 'VND' },

    // Lịch sử trạng thái
    statusHistory: { type: [StatusHistorySchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'orders',
  },
);

export default OrderSchema;
