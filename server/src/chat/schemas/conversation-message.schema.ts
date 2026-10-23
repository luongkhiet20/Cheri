import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationMessageDocument = ConversationMessage & Document;

export type MessageSenderType = 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
export type MessageType = 'TEXT' | 'IMAGE' | 'PRODUCT_CARD' | 'SYSTEM';
export type SupportSystemEvent = 'SUPPORT_REQUESTED' | 'ADMIN_JOINED' | 'ADMIN_LEFT';

@Schema({ timestamps: true, collection: 'conversation_messages' })
export class ConversationMessage {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['CUSTOMER', 'ADMIN', 'SYSTEM'],
    required: true,
  })
  senderType: MessageSenderType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  senderId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['TEXT', 'IMAGE', 'PRODUCT_CARD', 'SYSTEM'],
    default: 'TEXT',
  })
  messageType: MessageType;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: [Object], default: [] })
  attachments: any[];

  @Prop({ type: [Object], default: [] })
  productReferences: any[];

  @Prop({ type: Types.ObjectId, ref: 'Order', required: false, default: null })
  orderRefId?: Types.ObjectId;

  @Prop({ type: String, required: false, default: null })
  clientMessageId?: string;

  @Prop({ type: String, required: false, default: null })
  systemEvent?: SupportSystemEvent | string;

  @Prop({ type: Date, required: false, default: null })
  readByAdminAt?: Date;

  @Prop({ type: Date, required: false, default: null })
  readByCustomerAt?: Date;
}

export const ConversationMessageSchema = SchemaFactory.createForClass(ConversationMessage);

ConversationMessageSchema.index({ conversationId: 1, createdAt: 1 });
