
import { Schema } from 'mongoose';

const PasswordResetSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    resetTokenHash: {
      type: String,
      default: null,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// MongoDB tự xóa bản ghi hết hạn; backend vẫn phải tự kiểm tra expiresAt.
PasswordResetSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export default PasswordResetSchema;
