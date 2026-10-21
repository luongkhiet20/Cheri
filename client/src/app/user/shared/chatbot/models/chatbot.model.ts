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

export interface ChatMessage {
  id: number;
  sender: 'store' | 'user';
  text: string;
  timestamp?: Date;
  products?: ChatProductCard[];
  requiresAuth?: boolean;
  isError?: boolean;
  failedText?: string;
}

export interface ChatbotResponse {
  reply: string;
  intent: 'policy' | 'search' | 'compare' | 'recommendation' | 'order' | 'general' | 'moderation';
  products?: ChatProductCard[];
  orderInfo?: any;
  requiresAuth?: boolean;
  sessionId?: string;
}
