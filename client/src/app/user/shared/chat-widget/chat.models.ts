export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export interface ChatProductCard {
  id: string;
  title: string;
  path: string;
  imageUrl?: string;
  price?: number;
}

export interface ChatRequest {
  message: string;
  history: ChatTurn[];
  lang: 'vi' | 'en';
}

export interface ChatResponse {
  reply: string;
  products: ChatProductCard[];
}

export interface ChatMessage {
  id: number;
  sender: 'store' | 'user';
  text: string;
  products?: ChatProductCard[];
}
