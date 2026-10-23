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
  availableColors?: string[];
  availableSizes?: string[];
  inStock?: boolean;
  stockSummary?: string;
}

export type ChatbotIntent =
  | 'greetings'
  | 'product_search'
  | 'product_detail'
  | 'product_compare'
  | 'recommendation'
  | 'policy_faq'
  | 'size_consultation'
  | 'order_tracking'
  | 'complaint'
  | 'unrelated'
  // Legacy aliases
  | 'policy'
  | 'search'
  | 'compare'
  | 'order'
  | 'general'
  | 'moderation';

export interface ChatOrderCard {
  orderId: string;
  orderNumber?: string;
  createdAt: Date | string;
  status: string;
  statusText: string;
  totalAmount: number;
  totalFormatted: string;
  thumbnailUrl?: string;
  firstItemName?: string;
  itemsCount?: number;
  totalQuantity?: number;
  trackingNumber?: string;
}

export interface ChatbotResponse {
  reply: string;
  intent: ChatbotIntent;
  products?: ChatProductCard[];
  orders?: ChatOrderCard[];
  orderInfo?: any;
  requiresAuth?: boolean;
  sessionId?: string;
  quickReplies?: string[];
  sizingProfile?: any;
}

export type ChatResponseDto = ChatbotResponse;
