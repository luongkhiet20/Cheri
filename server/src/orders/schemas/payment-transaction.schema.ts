import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export enum PaymentTransactionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

const PaymentTransactionSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderCode: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    method: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'VND' },
    providerTransactionId: { type: String, default: '', index: true },
    paymentLink: { type: String, default: '' },
    status: {
      type: String,
      required: true,
      enum: Object.values(PaymentTransactionStatus),
      default: PaymentTransactionStatus.PENDING,
    },
    failureReason: { type: String, default: '' },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'payment_transactions' },
);

export default PaymentTransactionSchema;
