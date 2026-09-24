import { Document, Types } from 'mongoose';

export interface UserCartItem {
  productId?: Types.ObjectId | string;
  variantId?: Types.ObjectId | string;
  quantity?: number;
  [key: string]: any;
}

export interface UserCart {
  items: UserCartItem[];
  [key: string]: any;
}

export interface User extends Document {
  _id: string;
  email: string;
  password?: string;
  name: string;
  fullName?: string;
  phoneNumber?: string;
  address?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  avatar?: string;
  salt?: string;
  cart?: UserCart | any;
  images?: string[];
  roles: string[];
  googleId?: string;
  status: boolean;
  description?: string;
  dateAdded?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}
