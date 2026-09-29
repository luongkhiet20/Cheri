import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export const ShippingMethodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    baseCost: { type: Number, required: true, min: 0 },
    estimatedDays: { type: String, required: true, trim: true },
    coverageArea: { type: String, enum: ['national', 'regional'], default: 'national' },
    freeShippingThreshold: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    description: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    // ⇒ Trỏ thẳng vào collection gốc của CSDL (không để Mongoose tự đặt tên)
    collection: 'shippingmethods',
  },
);
