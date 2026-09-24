import { Document, Types } from 'mongoose';

export interface ProductVariantDocument extends Document {
  _id: Types.ObjectId | string;
  productId: Types.ObjectId | string;
  sku: string;
  color?: string;
  size?: string;
  classification?: string;
  price: number;
  discountPrice?: number;
  stock: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
