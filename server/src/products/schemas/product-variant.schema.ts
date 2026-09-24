import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export const ProductVariantSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    color: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: '',
    },
    classification: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'product_variants',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export default ProductVariantSchema;
