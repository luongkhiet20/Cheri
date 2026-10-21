import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatbotModerationService } from './chatbot-moderation.service';
import { ChatbotIntentService } from './chatbot-intent.service';
import { ChatbotKnowledgeService } from './chatbot-knowledge.service';
import { ChatbotProductService } from './chatbot-product.service';
import { ChatbotSessionService } from './chatbot-session.service';
import { ChatbotAiService } from './chatbot-ai.service';
import { ChatbotMessageDto } from '../dto/chatbot-message.dto';
import { ChatbotResponse, ChatProductCard } from '../interfaces/chatbot-response.interface';
import { CHERI_SYSTEM_PROMPTS } from '../prompts/chatbot-system.prompt';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  // In-memory sliding window rate limiter: key -> timestamps[]
  private readonly rateLimits = new Map<string, number[]>();
  private readonly MAX_REQUESTS_PER_MINUTE = 25;

  constructor(
    @InjectModel('Order') private orderModel: Model<any>,
    private moderationService: ChatbotModerationService,
    private intentService: ChatbotIntentService,
    private knowledgeService: ChatbotKnowledgeService,
    private productService: ChatbotProductService,
    private sessionService: ChatbotSessionService,
    private aiService: ChatbotAiService,
  ) {}

  /**
   * Main coordinator pipeline for processing incoming chat messages
   */
  async processMessage(
    dto: ChatbotMessageDto,
    user?: any,
    clientIp?: string,
  ): Promise<ChatbotResponse> {
    const startTime = Date.now();
    const rawMessage = (dto.message || '').trim();

    // 1. Length & Empty Validation
    if (!rawMessage) {
      return {
        reply: 'Chào nàng! Chéri có thể hỗ trợ nàng tìm kiếm trang phục, tư vấn chính sách hay kiểm tra đơn hàng?',
        intent: 'greetings',
      };
    }

    if (rawMessage.length > 1000) {
      return {
        reply: 'Tin nhắn của nàng hơi dài rồi ạ. Nàng vui lòng tóm tắt ngắn gọn dưới 1000 ký tự để Chéri hỗ trợ nhanh nhất nhé!',
        intent: 'unrelated',
      };
    }

    // 2. Session Initialization & Strict Ownership Check
    const session = await this.sessionService.getOrCreateSession(dto.sessionId, user, dto.guestCartId);
    const activeSessionId = session.sessionId;

    // 3. Rate Limiting Check (per IP or Session)
    const rateLimitKey = clientIp || activeSessionId;
    if (this.isRateLimited(rateLimitKey)) {
      this.logger.warn(`Rate limit triggered for ${rateLimitKey}`);
      return {
        reply: 'Nàng thao tác hơi nhanh rồi ạ! Chéri xin phép nghỉ 20 giây để xử lý yêu cầu tốt nhất cho nàng nhé.',
        intent: 'unrelated',
        sessionId: activeSessionId,
      };
    }

    // 4. Prompt Injection & Secret Protection Defense
    if (this.isPromptInjection(rawMessage)) {
      this.logger.warn(`Prompt injection attempt detected: "${rawMessage.slice(0, 50)}"`);
      return {
        reply: 'Dạ Chéri là trợ lý thời trang tư vấn trang phục, chính sách và đơn hàng của Chéri. Chéri không thể thực hiện yêu cầu này ạ!',
        intent: 'unrelated',
        sessionId: activeSessionId,
      };
    }

    // 5. Moderation Check (Abuse vs Legitimate Complaint)
    const modResult = this.moderationService.checkContent(rawMessage);
    if (modResult.isHarmful && modResult.warningMessage) {
      const response: ChatbotResponse = {
        reply: modResult.warningMessage,
        intent: 'moderation',
        sessionId: activeSessionId,
      };
      await this.sessionService.appendMessage(activeSessionId, 'assistant', response.reply, 'moderation');
      return response;
    }

    // 6. Intent Classification
    const intent = this.intentService.classifyIntent(rawMessage);

    let response: ChatbotResponse;

    try {
      switch (intent) {
        case 'order_tracking':
        case 'order':
          response = await this.handleOrderTracking(rawMessage, user);
          break;

        case 'product_compare':
        case 'compare':
          response = await this.handleCompare(rawMessage, session.context);
          break;

        case 'product_detail':
          response = await this.handleProductDetail(rawMessage, session.context);
          break;

        case 'policy_faq':
        case 'policy':
          response = await this.handlePolicy(rawMessage);
          break;

        case 'complaint':
          response = await this.handleComplaint(rawMessage);
          break;

        case 'recommendation':
          response = await this.handleRecommendation(user, dto.guestCartId);
          break;

        case 'product_search':
        case 'search':
          response = await this.handleSearch(rawMessage);
          break;

        case 'greetings':
        case 'general':
        case 'unrelated':
        default:
          response = await this.handleGeneral(rawMessage, session.messages || []);
          break;
      }
    } catch (err) {
      this.logger.error(`Error processing message intent ${intent}: ${err.message}`, err.stack);
      response = {
        reply:
          'Dạ Chéri đang gặp chút gián đoạn kết nối. Nàng vui lòng thử lại sau giây lát hoặc nhắn tin hotline để được hỗ trợ nhé!',
        intent: 'general',
      };
    }

    response.sessionId = activeSessionId;

    // Update session context with newly returned products
    const contextUpdates: any = {};
    if (response.products && response.products.length > 0) {
      contextUpdates.lastProducts = response.products;
      contextUpdates.lastMentionedProductId = response.products[0].id;
    }
    contextUpdates.lastIntent = intent;

    await this.sessionService.appendMessage(
      activeSessionId,
      'user',
      rawMessage,
      intent,
    );
    await this.sessionService.appendMessage(
      activeSessionId,
      'assistant',
      response.reply,
      response.intent,
      contextUpdates,
    );

    // Minimal audit logging without PII
    const latencyMs = Date.now() - startTime;
    this.logger.log(
      `[Chatbot] Session=${activeSessionId.slice(0, 14)} Intent=${intent} Products=${response.products?.length || 0} Latency=${latencyMs}ms User=${!!user}`,
    );

    return response;
  }

  // --- Handlers ---

  /**
   * Order Tracking: Strictly bind to authenticated user. Read-only.
   */
  private async handleOrderTracking(message: string, user?: any): Promise<ChatbotResponse> {
    if (!user || !user._id) {
      return {
        reply:
          'Để bảo mật thông tin đơn hàng và quyền riêng tư mua sắm của bạn, Chéri cần bạn đăng nhập tài khoản để tra cứu chi tiết nhé!',
        intent: 'order_tracking',
        requiresAuth: true,
      };
    }

    const words = message.match(/[A-Za-z0-9_-]{5,30}/g) || [];
    let order: any = null;

    // Only search orders owned by this verified user
    for (const code of words) {
      const isOid = Types.ObjectId.isValid(code) && code.length === 24;
      order = await this.orderModel
        .findOne({
          _user: user._id,
          $or: [
            ...(isOid ? [{ _id: new Types.ObjectId(code) }] : []),
            { trackingNumber: code },
            { orderNumber: code },
          ],
        })
        .lean();
      if (order) break;
    }

    if (!order) {
      // Find latest order of this user
      try {
        if (typeof this.orderModel.find === 'function') {
          const list = await this.orderModel.find({ _user: user._id }).sort({ createdAt: -1 }).limit(1).lean();
          order = list && list.length > 0 ? list[0] : null;
        } else if (typeof this.orderModel.findOne === 'function') {
          const query = this.orderModel.findOne({ _user: user._id });
          order = query && typeof query.sort === 'function' ? await query.sort({ createdAt: -1 }).lean() : await query.lean();
        }
      } catch (err) {
        this.logger.debug(`Could not retrieve latest order: ${err.message}`);
      }
    }

    if (!order) {
      return {
        reply:
          'Chéri không tìm thấy đơn hàng nào thuộc tài khoản của nàng. Nàng kiểm tra lại mã đơn hoặc truy cập mục Đơn hàng của tôi nhé!',
        intent: 'order_tracking',
      };
    }

    const statusMap: Record<string, string> = {
      PENDING: 'Chờ thanh toán',
      CONFIRMED: 'Đã xác nhận',
      PROCESSING: 'Đang chuẩn bị hàng',
      SHIPPING: 'Đang giao hàng',
      DELIVERY_FAILED: 'Giao không thành công',
      DELIVERED: 'Giao hàng thành công',
      CANCELLED: 'Đã hủy',
      RETURNED: 'Đã hoàn trả',
    };

    const statusText = statusMap[order.status] || order.status || 'Đang xử lý';
    const totalFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
      order.total || 0,
    );

    return {
      reply: `Đơn hàng #${order.orderNumber || order._id} của nàng đang ở trạng thái: ${statusText}. Tổng tiền: ${totalFormatted}. Nàng có thể nhấn vào mục Quản lý đơn hàng trong tài khoản để xem chi tiết hành trình vận chuyển nhé!`,
      intent: 'order_tracking',
      orderInfo: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: statusText,
        total: order.total,
      },
    };
  }

  /**
   * Follow-up & Product Detail: resolves references to previous products ("mẫu thứ 2", "còn size M không")
   */
  private async handleProductDetail(message: string, context?: any): Promise<ChatbotResponse> {
    const targetProduct = this.sessionService.resolveFollowUpProduct(message, context);

    if (!targetProduct) {
      return {
        reply:
          'Nàng đang quan tâm đến mẫu đầm nào ạ? Nàng có thể nhắn tên sản phẩm hoặc chọn một trong các gợi ý bên dưới để Chéri tư vấn chi tiết nhé!',
        intent: 'product_search',
        products: await this.productService.getRecommendations(undefined, undefined, 3),
      };
    }

    // Extract color or size inquired in this follow-up message
    const parsedCriteria = this.productService.parseCriteriaFromText(message);
    const stockInfo = await this.productService.checkProductStock(
      targetProduct.id,
      parsedCriteria.color,
      parsedCriteria.size,
    );

    let reply = '';
    if (parsedCriteria.size && parsedCriteria.color) {
      reply = stockInfo.inStock
        ? `Dạ mẫu "${targetProduct.title}" màu ${parsedCriteria.color} size ${parsedCriteria.size} hiện ĐANG CÒN HÀNG (còn ${stockInfo.availableStock} sản phẩm). Nàng có thể nhấn vào thẻ sản phẩm bên dưới để đặt ngay nhé!`
        : `Dạ mẫu "${targetProduct.title}" màu ${parsedCriteria.color} size ${parsedCriteria.size} hiện ĐÃ TẠM HẾT HÀNG. Nàng có thể tham khảo các size khác: ${stockInfo.availableSizes.join(', ') || 'đang cập nhật'} ạ.`;
    } else if (parsedCriteria.size) {
      reply = stockInfo.inStock
        ? `Dạ mẫu "${targetProduct.title}" size ${parsedCriteria.size} hiện ĐANG CÒN HÀNG. Nàng nhấn vào thẻ để xem chi tiết nhé!`
        : `Dạ mẫu "${targetProduct.title}" size ${parsedCriteria.size} hiện đã tạm hết. Mẫu này hiện còn các size: ${stockInfo.availableSizes.join(', ') || 'liên hệ shop'} ạ.`;
    } else if (parsedCriteria.color) {
      reply = stockInfo.inStock
        ? `Dạ mẫu "${targetProduct.title}" màu ${parsedCriteria.color} hiện ĐANG CÒN HÀNG. Nàng nhấn vào thẻ để xem chi tiết nhé!`
        : `Dạ mẫu "${targetProduct.title}" màu ${parsedCriteria.color} hiện tạm hết. Mẫu này hiện có các màu: ${stockInfo.availableColors.join(', ')} ạ.`;
    } else {
      reply = `Mẫu "${targetProduct.title}" hiện có giá ${targetProduct.price.toLocaleString('vi-VN')}đ, các màu: ${stockInfo.availableColors.join(', ') || 'tiêu chuẩn'}, các size: ${stockInfo.availableSizes.join(', ') || 'tiêu chuẩn'}. ${stockInfo.inStock ? 'Hiện đang sẵn hàng phục vụ nàng.' : 'Hiện đang tạm hết hàng.'}`;
    }

    return {
      reply,
      intent: 'product_detail',
      products: [targetProduct],
    };
  }

  /**
   * Product Comparison: strictly compare real attributes of 2-3 products
   */
  private async handleCompare(message: string, context?: any): Promise<ChatbotResponse> {
    const candidateIds = (context?.lastProducts || []).map((p: any) => p.id);
    const products = await this.productService.findProductsForComparison(message, candidateIds);

    if (products.length < 2) {
      return {
        reply:
          'Nàng có thể cung cấp tên hoặc mã của 2 mẫu đầm nàng đang phân vân để Chéri so sánh chi tiết giá và chất liệu giúp nàng nhé!',
        intent: 'product_compare',
      };
    }

    const cards: ChatProductCard[] = [];
    for (const p of products.slice(0, 3)) {
      cards.push(await this.productService.buildVerifiedProductCard(p));
    }

    // Build verified factual comparison summary
    const facts = cards
      .map(
        (c) =>
          `- ${c.title}: Giá bán ${c.price.toLocaleString('vi-VN')}đ ${c.onSale ? '(Đang giảm giá)' : ''}, Tồn kho: ${c.stockSummary || 'Sẵn hàng'}, Màu: ${(c.availableColors || []).join('/')}, Size: ${(c.availableSizes || []).join('/')}`,
      )
      .join('\n');

    const prompt = `So sánh khách quan 2-3 mẫu đầm của Chéri:\n${facts}\nHãy viết 2-3 câu ngắn gọn so sánh giá cả và phong cách để nàng dễ lựa chọn.`;
    const aiReply = await this.aiService.generateResponse(message, facts, CHERI_SYSTEM_PROMPTS.productCompare);

    const fallbackReply = `Chéri đã so sánh các mẫu cho nàng: ${cards[0].title} có giá ${cards[0].price.toLocaleString('vi-VN')}đ, trong khi ${cards[1].title} có giá ${cards[1].price.toLocaleString('vi-VN')}đ. Nàng có thể xem chi tiết từng mẫu bên dưới để chọn thiết kế ưng ý nhất nhé!`;

    return {
      reply: aiReply || fallbackReply,
      intent: 'product_compare',
      products: cards,
    };
  }

  /**
   * Policy / FAQ handling: read pages_policies. Do not hallucinate missing rules.
   */
  private async handlePolicy(message: string): Promise<ChatbotResponse> {
    const policy = await this.knowledgeService.findRelevantPolicy(message);

    if (!policy || !policy.isAvailable) {
      const fallbackUrl = policy?.routeLink || '/vi/return-policy';
      return {
        reply: `Dạ hiện tại nội dung chi tiết về vấn đề này chưa được cập nhật đầy đủ trong hệ thống. Nàng có thể xem trang Chính sách chính thức của Chéri tại ${fallbackUrl} hoặc liên hệ hotline để được chuyên viên hỗ trợ ngay nhé!`,
        intent: 'policy_faq',
      };
    }

    const verifiedFacts = `Chính sách: ${policy.title}\nNội dung chính thức: ${policy.content.slice(0, 1200)}\nĐường dẫn: ${policy.routeLink}`;
    const aiReply = await this.aiService.generateResponse(message, verifiedFacts, CHERI_SYSTEM_PROMPTS.policy);

    const fallbackReply = `Dạ về "${policy.title}", Chéri luôn đảm bảo quyền lợi chu đáo cho nàng: nàng có thể xem chi tiết quy định tại trang ${policy.routeLink} nhé!`;

    return {
      reply: aiReply || fallbackReply,
      intent: 'policy_faq',
    };
  }

  /**
   * Recommendations: Exclude isSynthetic: true. No fake best-seller claims.
   */
  private async handleRecommendation(user?: any, guestCartId?: string): Promise<ChatbotResponse> {
    const products = await this.productService.getRecommendations(user, guestCartId, 4);

    if (products.length === 0) {
      return {
        reply: 'Chào nàng, Chéri đang cập nhật các bộ sưu tập mới nhất. Nàng vui lòng quay lại sau ít phút hoặc xem tại trang chủ nhé!',
        intent: 'recommendation',
      };
    }

    const titles = products.map((p) => `"${p.title}"`).join(', ');
    const verifiedFacts = `Các mẫu đầm thiết kế phù hợp đang có sẵn: ${titles}`;
    const aiReply = await this.aiService.generateResponse(
      'Gợi ý đầm cho khách',
      verifiedFacts,
      CHERI_SYSTEM_PROMPTS.productSearch,
    );

    return {
      reply:
        aiReply ||
        'Dạ Chéri xin gợi ý một số mẫu thiết kế phù hợp và thanh lịch dành riêng cho nàng. Nàng nhấn vào từng mẫu bên dưới để xem chi tiết nhé!',
      intent: 'recommendation',
      products,
    };
  }

  /**
   * Multi-criteria Search: Price, color, size, garment type. Filter out hidden/out-of-stock.
   */
  private async handleSearch(message: string): Promise<ChatbotResponse> {
    const criteria = this.productService.parseCriteriaFromText(message);
    const products = await this.productService.searchProductsWithCriteria(criteria, 4);

    if (products.length === 0) {
      // Fallback: offer available in-stock designs
      const recs = await this.productService.getRecommendations(undefined, undefined, 3);
      return {
        reply:
          'Dạ Chéri chưa tìm thấy mẫu đầm nào hoàn toàn trùng khớp với tiêu chí của nàng. Nàng có thể tham khảo một số mẫu thiết kế sẵn có bên dưới hoặc điều chỉnh lại yêu cầu nhé!',
        intent: 'product_search',
        products: recs,
      };
    }

    const verifiedFacts = products
      .map((p) => `"${p.title}" - Giá ${p.price.toLocaleString('vi-VN')}đ (Còn ${p.stockSummary})`)
      .join(', ');

    const aiReply = await this.aiService.generateResponse(
      message,
      `Các mẫu tìm thấy: ${verifiedFacts}`,
      CHERI_SYSTEM_PROMPTS.productSearch,
    );

    return {
      reply:
        aiReply ||
        `Dạ Chéri đã tìm thấy các mẫu đầm phù hợp với mong muốn của nàng đây ạ. Nàng hãy chọn mẫu yêu thích để ngắm chi tiết nhé!`,
      intent: 'product_search',
      products,
    };
  }

  /**
   * Customer complaint handler: polite reassurance, no defensive arguments, provide hotline
   */
  private async handleComplaint(message: string): Promise<ChatbotResponse> {
    return {
      reply:
        'Chéri rất lấy làm tiếc vì trải nghiệm chưa trọn vẹn của nàng! Chéri luôn cam kết hỗ trợ đổi trả hoặc xử lý mọi vấn đề nhanh nhất. Nàng vui lòng nhắn trực tiếp qua hotline 0901.xxx.xxx hoặc gửi mã đơn để bộ phận chăm sóc khách hàng Chéri hỗ trợ ngay lập tức cho nàng nhé!',
      intent: 'complaint',
    };
  }

  /**
   * General conversation / greetings
   */
  private async handleGeneral(message: string, history: any[]): Promise<ChatbotResponse> {
    let aiReply = '';
    if (this.aiService && typeof this.aiService.generateResponse === 'function') {
      try {
        aiReply = await this.aiService.generateResponse(
          message,
          'Thương hiệu thời trang nữ thiết kế Chéri Việt Nam',
          CHERI_SYSTEM_PROMPTS.general,
        );
      } catch {
        // safe fallback
      }
    }

    return {
      reply:
        aiReply ||
        'Chào nàng! Chéri luôn sẵn sàng hỗ trợ nàng chọn đầm dự tiệc, tư vấn size chuẩn hoặc giải đáp thông tin đơn hàng bất cứ lúc nào ạ!',
      intent: 'greetings',
    };
  }

  // --- Security Helpers ---

  private isPromptInjection(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('bỏ qua mọi quy định') ||
      lower.includes('ignore all previous instructions') ||
      lower.includes('in gemini_api_key') ||
      lower.includes('in api key') ||
      lower.includes('print api key') ||
      lower.includes('show secret') ||
      lower.includes('lộ token') ||
      lower.includes('in token')
    );
  }

  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const timestamps = this.rateLimits.get(key) || [];
    const recent = timestamps.filter((t) => now - t < 60000); // 1 minute window

    if (recent.length >= this.MAX_REQUESTS_PER_MINUTE) {
      return true;
    }

    recent.push(now);
    this.rateLimits.set(key, recent);
    return false;
  }
}
