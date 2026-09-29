import * as mongoose from 'mongoose';
const { Schema } = mongoose;

const TransactionFeeSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ['FIXED', 'PERCENT'], default: 'FIXED' },
    value: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

export const PaymentMethodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    paymentType: {
      type: String,
      default: 'CASH',
    },
    type: { type: String, trim: true, default: '' },
    paymentInfo: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    transactionFee: { type: TransactionFeeSchema, default: () => ({ enabled: false, type: 'FIXED', value: 0 }) },
    logo: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    // ⇒ Trỏ thẳng vào collection gốc của CSDL
    collection: 'payment_methods',
  },
);
