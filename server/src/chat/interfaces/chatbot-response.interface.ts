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

export interface ChatbotResponse {
  reply: string;
  intent: ChatbotIntent;
  products?: ChatProductCard[];
  orderInfo?: any;
  requiresAuth?: boolean;
  sessionId?: string;
  quickReplies?: string[];
}

export type ChatResponseDto = ChatbotResponse;
