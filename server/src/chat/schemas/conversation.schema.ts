import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

export type ConversationStatus = 'WAITING_ADMIN' | 'IN_PROGRESS' | 'REPLIED' | 'CLOSED';
export type ConversationSource = 'SUPPORT_BUTTON';

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true, default: null })
  userId?: Types.ObjectId;

  @Prop({ type: String, required: false, index: true, default: null })
  guestId?: string;

  @Prop({ type: String, default: 'WEB_CHAT' })
  channel: string;

  /**
   * MUST be SUPPORT_BUTTON.
   * Only conversations created from customer pressing "Liên hệ nhân viên hỗ trợ" are set to this.
   */
  @Prop({ type: String, default: 'SUPPORT_BUTTON', index: true })
  source: string;

  @Prop({
    type: String,
    enum: ['WAITING_ADMIN', 'IN_PROGRESS', 'REPLIED', 'CLOSED'],
    default: 'WAITING_ADMIN',
    index: true,
  })
  status: ConversationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  assignedAdminId?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  requestedAt: Date;

  @Prop({ type: Date, required: false, default: null })
  acceptedAt?: Date;

  @Prop({ type: Types.ObjectId, required: false, default: null })
  lastMessageId?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now, index: true })
  lastMessageAt: Date;

  @Prop({ type: String, default: 'Khách hàng yêu cầu hỗ trợ từ nhân viên' })
  lastMessagePreview: string;

  @Prop({ type: Number, default: 0 })
  unreadAdminCount: number;

  @Prop({ type: Number, default: 0 })
  unreadCustomerCount: number;

  @Prop({ type: Date, required: false, default: null })
  adminLastReadAt?: Date;

  @Prop({ type: Date, required: false, default: null })
  customerLastReadAt?: Date;

  @Prop({ type: String, default: '' })
  internalNote: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  internalNoteUpdatedBy?: Types.ObjectId;

  @Prop({ type: Date, required: false, default: null })
  internalNoteUpdatedAt?: Date;

  @Prop({ type: Date, required: false, default: null })
  closedAt?: Date;

  @Prop({
    type: {
      requestedAt: { type: Date },
      expiresAt: { type: Date },
      status: { type: String, enum: ['PENDING', 'UNDONE', 'COMPLETED'] },
    },
    required: false,
    default: null,
  })
  cancelRequest?: {
    requestedAt?: Date;
    expiresAt?: Date;
    status?: 'PENDING' | 'UNDONE' | 'COMPLETED';
  };
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Compound indexes for fast admin querying & concurrency prevention
ConversationSchema.index({ status: 1, lastMessageAt: -1 });
ConversationSchema.index({ source: 1, status: 1 });
ConversationSchema.index({ userId: 1, status: 1 });
ConversationSchema.index({ guestId: 1, status: 1 });
