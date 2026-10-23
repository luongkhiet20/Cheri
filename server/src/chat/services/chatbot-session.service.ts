import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { ChatbotSessionDocument, ChatbotConversationContext } from '../schemas/chatbot-session.schema';
import { ChatProductCard } from '../interfaces/chatbot-response.interface';

@Injectable()
export class ChatbotSessionService {
  private readonly logger = new Logger(ChatbotSessionService.name);

  constructor(
    @InjectModel('ChatbotSession') private sessionModel: Model<ChatbotSessionDocument>,
  ) {}

  /**
   * Generate unpredictable, secure session ID
   */
  generateSessionId(): string {
    return `cheri_sess_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  /**
   * Get or create a session with strict ownership verification
   */
  async getOrCreateSession(
    requestedSessionId?: string,
    verifiedUser?: any,
    guestId?: string,
  ): Promise<any> {
    const verifiedUserId = verifiedUser?._id ? verifiedUser._id.toString() : null;

    if (requestedSessionId) {
      try {
        const existingSession = await this.sessionModel.findOne({ sessionId: requestedSessionId });
        if (existingSession) {
          // Ownership verification:
          // If session belongs to a registered user, ensure the requesting user is the SAME user
          if (existingSession.userId) {
            const sessionOwnerId = existingSession.userId.toString();
            if (!verifiedUserId || verifiedUserId !== sessionOwnerId) {
              this.logger.warn(
                `Unauthorized session access attempt: requested ${requestedSessionId} by user ${verifiedUserId}, owned by ${sessionOwnerId}`,
              );
              // Do NOT reveal other user's session! Generate a clean, isolated session instead
              return this.createNewSession(verifiedUserId, guestId);
            }
          } else if (verifiedUserId) {
            // Guest logged in during the conversation -> bind session to the verified user
            if (Types.ObjectId.isValid(verifiedUserId) && verifiedUserId.length === 24) {
              existingSession.userId = new Types.ObjectId(verifiedUserId);
              await existingSession.save?.();
            }
          }

          return existingSession;
        }
      } catch (err) {
        this.logger.warn(`Error finding session ${requestedSessionId}: ${err.message}`);
      }
    }

    // No existing session or session not found -> create fresh session
    return this.createNewSession(verifiedUserId, guestId);
  }

  /**
   * Create a new secure session
   */
  private async createNewSession(verifiedUserId?: string | null, guestId?: string): Promise<any> {
    const newSessionId = this.generateSessionId();
    const isOid = verifiedUserId && Types.ObjectId.isValid(verifiedUserId) && verifiedUserId.length === 24;
    const userOid = isOid ? new Types.ObjectId(verifiedUserId) : undefined;

    try {
      const doc = await this.sessionModel.create({
        sessionId: newSessionId,
        userId: userOid,
        guestId,
        messages: [],
        context: {
          lastProducts: [],
          criteria: {},
        },
        isActive: true,
      });
      return doc;
    } catch (err) {
      this.logger.warn(`Fallback session to memory: ${err.message}`);
      return {
        sessionId: newSessionId,
        userId: userOid || (verifiedUserId ? { toString: () => verifiedUserId } : undefined),
        messages: [],
        context: { lastProducts: [], criteria: {} },
      };
    }
  }

  /**
   * Append message and update session conversation facts
   */
  async appendMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    intent?: string,
    contextUpdates?: Partial<ChatbotConversationContext>,
  ): Promise<void> {
    try {
      const updateOp: any = {
        $push: {
          messages: {
            $each: [
              {
                role,
                content,
                intent,
                timestamp: new Date(),
              },
            ],
            $slice: -20, // retain last 20 messages to control document size
          },
        },
      };

      if (contextUpdates) {
        updateOp.$set = {};
        if (contextUpdates.lastProducts !== undefined) {
          updateOp.$set['context.lastProducts'] = contextUpdates.lastProducts.slice(0, 6);
        }
        if (contextUpdates.lastMentionedProductId !== undefined) {
          updateOp.$set['context.lastMentionedProductId'] = contextUpdates.lastMentionedProductId;
        }
        if (contextUpdates.criteria !== undefined) {
          updateOp.$set['context.criteria'] = contextUpdates.criteria;
        }
        if (contextUpdates.sizingProfile !== undefined) {
          updateOp.$set['context.sizingProfile'] = contextUpdates.sizingProfile;
        }
        if (contextUpdates.lastIntent !== undefined) {
          updateOp.$set['context.lastIntent'] = contextUpdates.lastIntent;
        }
      }

      await this.sessionModel.updateOne({ sessionId }, updateOp);
    } catch (err) {
      this.logger.debug(`Could not update session ${sessionId}: ${err.message}`);
    }
  }

  /**
   * Resolve an antecedent reference ("mẫu thứ 2", "cái màu đỏ", "mẫu trước") against session history
   */
  resolveFollowUpProduct(
    message: string,
    context?: ChatbotConversationContext,
  ): ChatProductCard | null {
    if (!context || !context.lastProducts || context.lastProducts.length === 0) {
      return null;
    }

    const lower = (message || '').toLowerCase();
    const products = context.lastProducts;

    // Numerical references: "mẫu thứ 2", "cái 2", "mẫu 2"
    if (/(mẫu thứ 2|cái thứ 2|mẫu 2|cái 2|chiếc thứ 2|mẫu thứ hai)/i.test(lower) && products[1]) {
      return products[1];
    }
    if (/(mẫu thứ 1|cái thứ 1|mẫu 1|cái 1|mẫu đầu|mẫu trước)/i.test(lower) && products[0]) {
      return products[0];
    }
    if (/(mẫu thứ 3|cái thứ 3|mẫu 3|cái 3|chiếc thứ 3|mẫu thứ ba)/i.test(lower) && products[2]) {
      return products[2];
    }
    if (/(mẫu thứ 4|cái thứ 4|mẫu 4|cái 4|chiếc thứ 4)/i.test(lower) && products[3]) {
      return products[3];
    }

    // Color references: "cái màu đỏ", "mẫu đen", "chiếc màu trắng"
    const colorMatch = lower.match(/(?:màu|mẫu|cái)\s+(đen|trắng|đỏ|hồng|be|vàng|xanh)/i);
    if (colorMatch) {
      const colorTarget = colorMatch[1].toLowerCase();
      const found = products.find((p) => {
        const titleMatch = (p.title || '').toLowerCase().includes(colorTarget);
        const colorMatch = (p.colors || []).some((c: string) => c.toLowerCase().includes(colorTarget));
        return titleMatch || colorMatch;
      });
      if (found) return found;
    }

    // Default fallback to first product if user asks general follow up ("mẫu này", "đầm này", "còn size", etc.)
    if (/(mẫu này|đầm này|váy này|cái này|chiếc này|sản phẩm này|nó còn|còn size|có size|mẫu đó)/i.test(lower)) {
      return products[0];
    }

    return null;
  }
}
