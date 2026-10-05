import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export enum DeliveryScope {
  NATIONWIDE = 'NATIONWIDE',
  SPECIFIC_AREAS = 'SPECIFIC_AREAS',
}

export enum ShippingMethodStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

const ShippingMethodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, index: true },
    baseFee: { type: Number, min: 0, default: 0 },
    baseCost: { type: Number, min: 0, default: 0 },
    estimatedDeliveryTime: { type: String, default: '' },
    estimatedDays: { type: String, default: '' },
    deliveryScope: {
      type: String,
      enum: Object.values(DeliveryScope),
      default: DeliveryScope.NATIONWIDE,
    },
    coverageArea: { type: String, default: 'national' },
    deliveryAreas: { type: [String], default: [] },
    freeShippingThreshold: { type: Number, default: 0 },
    freeShippingCondition: {
      enabled: { type: Boolean, default: false },
      minimumOrderValue: { type: Number, min: 0, default: 0 },
      description: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: Object.values(ShippingMethodStatus),
      default: ShippingMethodStatus.ACTIVE,
    },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'shippingmethods',
  },
);

export default ShippingMethodSchema;
