import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatbotSessionDocument = ChatbotSession & Document;

export interface ChatbotMessageRecord {
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChatbotConversationContext {
  lastProducts?: any[];
  lastMentionedProductId?: string;
  criteria?: {
    budget?: number;
    color?: string;
    size?: string;
    occasion?: string;
    category?: string;
  };
  lastIntent?: string;
}

@Schema({ timestamps: true, collection: 'chatbot_sessions' })
export class ChatbotSession {
  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String, required: false, index: true })
  guestId?: string;

  @Prop({
    type: [
      {
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        intent: { type: String, required: false },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: Object, required: false },
      },
    ],
    default: [],
  })
  messages: ChatbotMessageRecord[];

  @Prop({ type: Object, default: {} })
  context?: ChatbotConversationContext;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days TTL
    index: { expires: '0s' },
  })
  expiresAt: Date;
}

export const ChatbotSessionSchema = SchemaFactory.createForClass(ChatbotSession);
