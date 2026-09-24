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
    baseFee: { type: Number, required: true, min: 0, default: 0 },
    estimatedDeliveryTime: { type: String, required: true, default: '' },
    deliveryScope: {
      type: String,
      required: true,
      enum: Object.values(DeliveryScope),
      default: DeliveryScope.NATIONWIDE,
    },
    deliveryAreas: { type: [String], default: [] },
    freeShippingCondition: {
      enabled: { type: Boolean, default: false },
      minimumOrderValue: { type: Number, min: 0, default: 0 },
      description: { type: String, default: '' },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ShippingMethodStatus),
      default: ShippingMethodStatus.ACTIVE,
    },
    description: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'shipping_methods',
  },
);

export default ShippingMethodSchema;
