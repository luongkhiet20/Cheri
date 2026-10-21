export interface ChatHistoryItem {
  sender: 'user' | 'store';
  text: string;
}

export class ChatMessageDto {
  message: string;
  history?: ChatHistoryItem[];
  lang?: string;
  guestCartId?: string;
}

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

export interface ChatResponseDto {
  reply: string;
  intent: 'policy' | 'search' | 'compare' | 'recommendation' | 'order' | 'general';
  products?: ChatProductCard[];
  orderInfo?: any;
  requiresAuth?: boolean;
}
