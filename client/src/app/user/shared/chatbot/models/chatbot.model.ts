export interface ChatProductCard {
  id: string;
  title: string;
  titleUrl: string;
  price: number;
  originalPrice?: number;
  onSale?: boolean;
  imageUrl?: string;
  category?: string;
  colors?: string[];
  sizes?: string[];
}

export interface ChatQuickReply {
  id: string;
  label: string;
  query: string;
  icon?: string;
}

export interface ChatOrderCard {
  orderId: string;
  orderNumber?: string;
  createdAt: Date | string;
  status: string;
  statusText?: string;
  totalAmount: number;
  totalFormatted?: string;
  thumbnailUrl?: string;
  firstItemName?: string;
  itemsCount?: number;
  totalQuantity?: number;
  trackingNumber?: string;
}

export type MessageSender = 'store' | 'user' | 'system';
export type SupportSystemEvent =
  | 'SUPPORT_REQUESTED'
  | 'ADMIN_JOINED'
  | 'ADMIN_LEFT'
  | 'CANCEL_REQUESTED'
  | 'CANCEL_UNDONE'
  | 'CANCEL_COMPLETED';

export interface ChatMessage {
  id: number;
  sender: MessageSender;
  text: string;
  timestamp?: Date;
  products?: ChatProductCard[];
  orders?: ChatOrderCard[];
  requiresAuth?: boolean;
  isError?: boolean;
  failedText?: string;
  senderType?: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  systemEvent?: SupportSystemEvent | string;
  cancelExpiresAt?: Date;
}

export interface ChatbotResponse {
  reply: string;
  intent:
    | 'policy'
    | 'search'
    | 'compare'
    | 'recommendation'
    | 'order'
    | 'general'
    | 'moderation'
    | 'order_tracking'
    | 'policy_faq'
    | 'size_consultation'
    | 'greetings'
    | 'complaint'
    | 'unrelated';
  products?: ChatProductCard[];
  orders?: ChatOrderCard[];
  orderInfo?: any;
  requiresAuth?: boolean;
  sessionId?: string;
}

export type ChatMode = 'AI' | 'HUMAN_SUPPORT';

export interface SupportConversation {
  _id: string;
  source: 'SUPPORT_BUTTON';
  status: 'WAITING_ADMIN' | 'IN_PROGRESS' | 'REPLIED' | 'CLOSED';
  channel: string;
  userId?: any;
  guestId?: string;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  unreadAdminCount?: number;
  unreadCustomerCount?: number;
  cancelRequest?: {
    requestedAt?: Date;
    expiresAt?: Date;
    status?: 'PENDING' | 'UNDONE' | 'COMPLETED';
  };
  createdAt?: Date;
  updatedAt?: Date;
}

