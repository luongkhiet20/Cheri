import { Controller, Post, Req, Res } from '@nestjs/common';
import { ChatService } from './chat.service';
const { resolveClientKey } = require('../../shared/chat/chat-limit.cjs');
import { Request, Response } from 'express';

@Controller('/api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async send(@Req() request: Request, @Res() response: Response): Promise<Response> {
    const result = await this.chatService.handle(
      request.body,
      resolveClientKey(request, process.env.VERCEL === '1'),
    );
    for (const [name, value] of Object.entries(result.headers ?? {})) {
      response.setHeader(name, String(value));
    }
    return response.status(result.status).json(result.body);
  }
}
