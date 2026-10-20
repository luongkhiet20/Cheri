import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

const { createChatHandler } = require('../../shared/chat/chat-handler.cjs');
const { loadPublicContext } = require('../../shared/chat/chat-context.cjs');
const { createMongoLimiter } = require('../../shared/chat/chat-limit.cjs');
const { createGeminiClient } = require('../../shared/chat/gemini-client.cjs');
const { finalizeAnswer } = require('../../shared/chat/chat-policy.cjs');

@Injectable()
export class ChatService {
  private readonly handler: (body: unknown, clientKey: string) => Promise<any>;

  constructor(@InjectConnection() private readonly connection: Connection) {
    const getDb = async () => {
      await this.connection.asPromise();
      if (!this.connection.db) throw new Error('Chat database unavailable');
      return this.connection.db;
    };
    this.handler = createChatHandler({
      getDb,
      limiter: createMongoLimiter(getDb),
      gemini: createGeminiClient(),
      loadContext: loadPublicContext,
      finalize: finalizeAnswer,
    });
  }

  handle(body: unknown, clientKey: string): Promise<any> {
    return this.handler(body, clientKey);
  }
}
