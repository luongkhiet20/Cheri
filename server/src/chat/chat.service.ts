import { Injectable } from '@nestjs/common';
import { ChatbotService } from './services/chatbot.service';
import { ChatbotMessageDto, ChatMessageDto } from './dto/chatbot-message.dto';
import { ChatbotResponse, ChatResponseDto } from './interfaces/chatbot-response.interface';

/**
 * Backward compatibility facade for ChatService
 * Delegates directly to modular ChatbotService
 */
@Injectable()
export class ChatService {
  constructor(private readonly chatbotService: ChatbotService) {}

  async processMessage(
    dto: ChatbotMessageDto | ChatMessageDto,
    user?: any,
  ): Promise<ChatbotResponse | ChatResponseDto> {
    return this.chatbotService.processMessage(dto, user);
  }
}
