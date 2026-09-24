import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export enum PaymentType {
  CASH = 'CASH',
  E_WALLET = 'E_WALLET',
  PAYMENT_GATEWAY = 'PAYMENT_GATEWAY',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum TransactionFeeType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

export enum PaymentMethodStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

const PaymentMethodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, index: true },
    paymentType: {
      type: String,
      required: true,
      enum: Object.values(PaymentType),
      default: PaymentType.CASH,
    },
    description: { type: String, default: '' },
    transactionFee: {
      enabled: { type: Boolean, default: false },
      type: {
        type: String,
        enum: Object.values(TransactionFeeType),
        default: TransactionFeeType.FIXED,
      },
      value: { type: Number, min: 0, default: 0 },
    },
    logo: { type: String, default: '' },
    status: {
      type: String,
      required: true,
      enum: Object.values(PaymentMethodStatus),
      default: PaymentMethodStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    collection: 'payment_methods',
  },
);

export default PaymentMethodSchema;
