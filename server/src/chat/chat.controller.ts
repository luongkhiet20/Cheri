import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/roles.guard';
import { GetUser } from '../auth/utils/get-user.decorator';
import { User } from '../auth/models/user.model';
import { ChatbotService } from './services/chatbot.service';
import { ChatbotMessageDto } from './dto/chatbot-message.dto';
import { ChatbotResponse } from './interfaces/chatbot-response.interface';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('message')
  async sendMessage(
    @Body() dto: ChatbotMessageDto,
    @GetUser() user: User | null,
    @Req() req: any,
  ): Promise<ChatbotResponse> {
    const clientIp =
      req?.headers?.['x-forwarded-for'] ||
      req?.connection?.remoteAddress ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      '';
    return this.chatbotService.processMessage(dto, user, clientIp);
  }
}
