import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ChatProductCard, ChatbotIntent, ChatbotResponse } from '../interfaces/chatbot-response.interface';

export interface ChatHistoryItem {
  sender: 'user' | 'store';
  text: string;
}

export class ChatbotMessageDto {
  @IsString()
  @MaxLength(1000, { message: 'Tin nhắn không được vượt quá 1000 ký tự' })
  message: string;

  @IsOptional()
  history?: ChatHistoryItem[];

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsString()
  guestCartId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;
}

// Re-exporting legacy aliases to preserve backward compatibility
export { ChatbotMessageDto as ChatMessageDto };
export type { ChatProductCard, ChatbotResponse as ChatResponseDto };
