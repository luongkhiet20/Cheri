import * as mongoose from 'mongoose';
const { Schema } = mongoose;

const CartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    quantity: { type: Number, default: 1 },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    googleId: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    salt: { type: String, required: true },
    fullName: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    gender: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    address: { type: String, default: '' },
    avatar: { type: String, default: '' },
    images: [{ type: String }],
    description: { type: String, default: '' },
    roles: {
      type: [String],
      required: true,
      default: ['user'],
    },
    status: {
      type: Boolean,
      required: true,
      default: true,
    },
    cart: {
      type: new Schema(
        {
          items: {
            type: [CartItemSchema],
            default: [],
          },
        },
        { _id: false, strict: false },
      ),
      default: () => ({ items: [] }),
    },
    dateAdded: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default UserSchema;
