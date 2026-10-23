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

export interface ChatMessage {
  id: number;
  sender: 'store' | 'user';
  text: string;
  timestamp?: Date;
  products?: ChatProductCard[];
  orders?: ChatOrderCard[];
  requiresAuth?: boolean;
  isError?: boolean;
  failedText?: string;
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
