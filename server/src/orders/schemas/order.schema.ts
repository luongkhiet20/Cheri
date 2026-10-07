import * as mongoose from 'mongoose';
const { Schema } = mongoose;

// ─── Enum ────────────────────────────────────────────────────────────────────

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPING = 'SHIPPING',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
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
    variantId: { type: Schema.Types.Mixed, ref: 'ProductVariant', default: null },
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
    provinceCode: { type: String, default: '' },
    provinceName: { type: String, default: '' },
    districtCode: { type: String, default: '' },
    districtName: { type: String, default: '' },
    wardCode: { type: String, default: '' },
    wardName: { type: String, default: '' },
    addressDetail: { type: String, default: '' },
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

// ─── Shipping Log Schema (tracking timeline từ carrier) ───────────────────────
// Phân biệt với statusHistory: statusHistory theo dõi trạng thái xử lý đơn của
// hệ thống Chéri (PENDING → PROCESSING → SHIPPING → DELIVERED), còn shippingLogs
// theo dõi hành trình vật lý của kiện hàng từ carrier (PICKED_UP → IN_TRANSIT → DELIVERED).

const ShippingLogSchema = new Schema(
  {
    status: { type: String, required: true },
    location: { type: String, default: '' },
    description: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

// ─── Main Order Schema ────────────────────────────────────────────────────────

const OrderSchema = new Schema(
  {
    // Thông tin cơ bản
    orderId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    _user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customer: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
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

    // Vận chuyển (chuẩn hóa & snapshot)
    shipping: {
      method: { type: String, default: 'STANDARD' },
      provider: { type: String, default: '' },
      trackingNumber: { type: String, default: '' },
      estimatedDeliveryDate: { type: Date, default: null },
      shippedAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
    },
    shippingMethodId: { type: Schema.Types.ObjectId, ref: 'ShippingMethod', index: true, default: null },
    shippingMethodSnapshot: { type: ShippingMethodSnapshotSchema, default: null },
    shippingFee: { type: Number, default: 0, min: 0 },
    shippingProvider: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
    estimatedDeliveryDate: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },

    // Thanh toán (chuẩn hóa & snapshot)
    payment: {
      method: { type: String, default: 'COD' },
      status: { type: String, default: 'PENDING' },
      provider: { type: String, default: null },
      transactionId: { type: String, default: null },
      paidAt: { type: Date, default: null },
      refundedAmount: { type: Number, default: 0, min: 0 },
      refundedAt: { type: Date, default: null },
    },
    paymentMethodId: { type: Schema.Types.ObjectId, ref: 'PaymentMethod', index: true, default: null },
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

    // Legacy fields bảo toàn tương thích ngược
    amount: { type: Number, default: null },
    cart: { type: Schema.Types.Mixed, default: null },
    addresses: { type: [Schema.Types.Mixed], default: [] },
    outcome: { type: Schema.Types.Mixed, default: null },
    dateAdded: { type: Date, default: null },

    // Lịch sử trạng thái đơn hàng (PENDING → PROCESSING → SHIPPING → DELIVERED)
    statusHistory: { type: [StatusHistorySchema], default: [] },

    // Lịch sử vận trình của carrier (PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED)
    shippingLogs: { type: [ShippingLogSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'orders',
  },
);

export default OrderSchema;
