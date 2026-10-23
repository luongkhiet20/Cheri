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
import { ChatbotResponse, ChatProductCard, ChatOrderCard, ChatbotIntent } from '../interfaces/chatbot-response.interface';
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
    const activeSessionId = session.sessionId || dto.sessionId || 'anonymous';

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

    // 6. Intent Classification & Deterministic Action Routing
    let intent: ChatbotIntent;
    const isExplicitCheckMyOrders =
      dto.action === 'CHECK_MY_ORDERS' ||
      /^(?:kiểm tra tình trạng đơn hàng(?: của mình)?|tra cứu đơn hàng(?: của mình)?|xem đơn hàng(?: của mình)?)$/i.test(
        rawMessage.trim(),
      );

    if (isExplicitCheckMyOrders) {
      intent = 'order_tracking';
    } else {
      intent = this.intentService.classifyIntent(rawMessage, session.context);
    }

    let response: ChatbotResponse;

    try {
      switch (intent) {
        case 'order_tracking':
        case 'order':
          response = await this.handleOrderTracking(rawMessage, user, isExplicitCheckMyOrders);
          break;

        case 'product_compare':
        case 'compare':
          response = await this.handleCompare(rawMessage, session.context);
          break;

        case 'product_detail':
          response = await this.handleProductDetail(rawMessage, session.context);
          break;

        case 'size_consultation':
          response = await this.handleSizeConsultation(rawMessage, session.context, session.messages || []);
          break;

        case 'policy_faq':
          case 'policy':
          response = await this.handlePolicy(rawMessage);
          break;

        case 'complaint':
          response = await this.handleComplaint(rawMessage);
          break;

        case 'recommendation':
          response = await this.handleRecommendation(rawMessage, session.context, user, dto.guestCartId);
          break;

        case 'product_search':
        case 'search':
          response = await this.handleSearch(rawMessage, session.context);
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

    // Clean reply to guarantee plain text, no raw markdown **, and at most 1 emoji
    response.reply = this.formatCleanResponse(response.reply);
    response.sessionId = activeSessionId;

    // Update session context with newly returned products and criteria
    const contextUpdates: any = {};
    if (response.products && response.products.length > 0) {
      contextUpdates.lastProducts = response.products;
      contextUpdates.lastMentionedProductId = response.products[0].id;
    }
    if (response.sizingProfile) {
      contextUpdates.sizingProfile = response.sizingProfile;
    }
    if (response.currentCategory) {
      contextUpdates.currentCategory = response.currentCategory;
    }
    if (response.criteria) {
      contextUpdates.criteria = response.criteria;
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
  private async handleOrderTracking(
    message: string,
    user?: any,
    isExplicitCheckMyOrders = false,
  ): Promise<ChatbotResponse> {
    if (!user || !user._id) {
      return {
        reply: '✨Bạn vui lòng đăng nhập để xem và theo dõi đơn hàng của mình nhé!✨',
        intent: 'order_tracking',
        requiresAuth: true,
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

    const toOrderCard = (o: any): ChatOrderCard => {
      const oId = String(o.orderId || o.orderNumber || (o._id ? o._id.toString() : ''));
      const oTotal = Number(o.totalAmount ?? o.total ?? o.amount ?? 0);
      const statusText = statusMap[o.status] || o.status || 'Đang xử lý';

      let thumb = '';
      let firstItemName = '';
      let totalQty = 0;
      if (o.items && Array.isArray(o.items) && o.items.length > 0) {
        const first = o.items[0];
        firstItemName = first?.name || first?.productSnapshot?.name || first?.title || '';
        const rawImg = first.image || first.productSnapshot?.image;
        if (typeof rawImg === 'string' && rawImg) {
          thumb = rawImg;
        } else if (Array.isArray(rawImg) && rawImg.length > 0) {
          thumb = typeof rawImg[0] === 'string' ? rawImg[0] : (rawImg[0]?.url || '');
        } else if (rawImg && typeof rawImg === 'object' && rawImg.url) {
          thumb = rawImg.url;
        }
        totalQty = o.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
      }

      return {
        orderId: oId,
        orderNumber: o.orderNumber || oId,
        createdAt: o.createdAt || o.dateAdded || new Date(),
        status: o.status || 'PENDING',
        statusText,
        totalAmount: oTotal,
        totalFormatted: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(oTotal),
        thumbnailUrl: thumb,
        firstItemName,
        itemsCount: Array.isArray(o.items) ? o.items.length : 1,
        totalQuantity: totalQty || (Array.isArray(o.items) ? o.items.length : 1),
        trackingNumber: o.trackingNumber || '',
      };
    };

    // Query orders belonging strictly to this user with ObjectId support
    let userOrders: any[] = [];
    const userConditions: any[] = [{ _user: user._id }, { userId: user._id }];
    if (user._id && Types.ObjectId.isValid(user._id)) {
      const objId = new Types.ObjectId(user._id);
      userConditions.push({ _user: objId }, { userId: objId });
    }
    if (user.email) {
      userConditions.push({ customerEmail: user.email.toLowerCase() }, { customerEmail: user.email });
    }
    const userFilter = { $or: userConditions };

    try {
      if (typeof this.orderModel.find === 'function') {
        const query = this.orderModel.find(userFilter);
        userOrders =
          query && typeof query.sort === 'function'
            ? await query.sort({ createdAt: -1, dateAdded: -1 }).limit(10).lean()
            : await this.orderModel.find(userFilter).lean();
      } else if (typeof this.orderModel.findOne === 'function') {
        // Fallback for mock environments
        const single = await this.orderModel.findOne(userFilter).lean();
        userOrders = single ? [single] : [];
      }
    } catch (err: any) {
      this.logger.debug(`Could not retrieve user orders: ${err?.message}`);
    }

    if (!Array.isArray(userOrders)) {
      userOrders = [];
    }

    // Check if the user specified a specific order code in their message
    let potentialCodes: string[] = [];
    if (!isExplicitCheckMyOrders) {
      const words = message.match(/[A-Za-z0-9_-]{4,30}/g) || [];
      const ignoredWords = new Set([
        'KIEM', 'TRA', 'TINH', 'TRANG', 'DON', 'HANG', 'CUA', 'MINH', 'CHO',
        'XEM', 'TRACKING', 'ORDER', 'ORDERS', 'MY', 'STATUS', 'NHAT', 'THEO', 'DOI',
        'GIUP', 'BAN', 'CAC', 'MOI', 'DAT', 'CHUA', 'DANG', 'O', 'DAU', 'NAO',
        'TOI', 'KHI', 'LAM', 'SAO', 'DUOC', 'SHOP', 'CHERI', 'XIN', 'CHAO'
      ]);
      potentialCodes = words.filter((w: string) => {
        const up = w.toUpperCase();
        if (ignoredWords.has(up)) return false;
        const isPrefixed = /^(?:CHERI|ORD|DH|TEST)[A-Za-z0-9_-]*/i.test(w);
        const hasDigits = /\d/.test(w) && w.length >= 4;
        const isMongoId = /^[a-fA-F0-9]{24}$/.test(w);
        return isPrefixed || hasDigits || isMongoId;
      });
    }

    if (potentialCodes.length > 0) {
      // Find if any code matches one of this user's orders
      const matched = userOrders.find((o) => {
        const oId = String(o.orderId || '').toUpperCase();
        const oNum = String(o.orderNumber || '').toUpperCase();
        const tNum = String(o.trackingNumber || '').toUpperCase();
        const idStr = String(o._id || '').toUpperCase();
        return potentialCodes.some((code) => {
          const cu = code.toUpperCase();
          return oId === cu || oNum === cu || tNum === cu || idStr === cu;
        });
      });

      if (matched) {
        const card = toOrderCard(matched);
        return {
          reply: `Đơn hàng #${card.orderNumber || card.orderId} của nàng đang ở trạng thái: ${card.statusText}. Tổng tiền: ${card.totalFormatted}. Nàng có thể chọn đơn hàng bên dưới để xem chi tiết hành trình vận chuyển nhé!`,
          intent: 'order_tracking',
          orders: [card],
          orderInfo: {
            orderId: card.orderId,
            orderNumber: card.orderNumber,
            status: card.statusText,
            total: card.totalAmount,
          },
        };
      }

      // Code was requested but not found in user's orders -> Neutral safety response
      return {
        reply: 'Chéri không tìm thấy đơn hàng nào có mã này thuộc tài khoản của bạn. Nàng kiểm tra lại mã đơn hoặc truy cập mục Đơn hàng của tôi nhé!',
        intent: 'order_tracking',
      };
    }

    // General order status check
    if (userOrders.length === 0) {
      return {
        reply: '✨Bạn chưa có đơn hàng nào tại Chéri. Cùng khám phá những sản phẩm xinh xắn nhé!✨',
        intent: 'order_tracking',
        orders: [],
      };
    }

    const orderCards = userOrders.map(toOrderCard);
    return {
      reply: '✨Đây là danh sách đơn hàng của bạn tại Chéri. Hãy chọn một đơn hàng để xem chi tiết và theo dõi tình trạng nhé!✨',
      intent: 'order_tracking',
      orders: orderCards,
      orderInfo: {
        orderId: orderCards[0].orderId,
        orderNumber: orderCards[0].orderNumber,
        status: orderCards[0].statusText,
        total: orderCards[0].totalAmount,
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

  private async handlePolicy(message: string): Promise<ChatbotResponse> {
    // If customer asks about return, refund, size exchange, or return conditions
    if (/(đổi trả|đổi hàng|hoàn tiền|trả hàng|đổi size|đổi mẫu|return)/i.test(message)) {
      return {
        reply:
          'Dạ, nàng xem chính sách đổi trả của Chéri tại đây nhé: [Xem chính sách đổi trả](/vi/cheri/return-policy)',
        intent: 'policy_faq',
      };
    }

    const policy = await this.knowledgeService.findRelevantPolicy(message);

    if (!policy || !policy.isAvailable) {
      return {
        reply:
          'Dạ, hiện mình chưa có đủ thông tin xác nhận về nội dung này của Chéri nên chưa muốn tư vấn sai cho nàng. Nàng vui lòng liên hệ kênh chăm sóc khách hàng chính thức của Chéri để được hỗ trợ kiểm tra và hướng dẫn cụ thể nhé!',
        intent: 'policy_faq',
      };
    }

    const verifiedFacts = `Chính sách: ${policy.title}\nĐường dẫn tương đối: ${policy.routeLink}`;
    const aiReply = await this.aiService.generateResponse(message, verifiedFacts, CHERI_SYSTEM_PROMPTS.policy);

    const fallbackReply = `Dạ, nàng xem ${policy.title.toLowerCase()} của Chéri tại đây nhé: [Xem ${policy.title.toLowerCase()}](${policy.routeLink})`;

    return {
      reply: aiReply || fallbackReply,
      intent: 'policy_faq',
    };
  }

  /**
   * Dedicated Size Consultation Handler
  /**
   * Dedicated Size Consultation Handler
   * Distinguishes general guidance vs specific height/weight/product inquiries,
   * maintains multi-turn context across turns without repeating measurements,
   * and provides natural fashion consultant replies in plain text (no markdown **).
   */
  private async handleSizeConsultation(
    message: string,
    context?: any,
    history: any[] = [],
  ): Promise<ChatbotResponse> {
    const lower = (message || '').toLowerCase();

    // 1. Context parsing & multi-turn profile maintenance
    const currentProfile: any = { ...(context?.sizingProfile || {}) };

    // Height parsing: "1m60", "1m58", "cao 1m65", "160cm", "cao 160", "mình cao 1m60", or "160"
    const heightMatch =
      lower.match(/(?:cao|chiều cao)[^0-9]{0,15}(\d{1,2}[m\.,]\d{1,2}|\d{3})\s*(?:cm)?/i) ||
      lower.match(/\b(1[m\.,]\d{2})\b/i) ||
      lower.match(/\b(\d{3})\s*cm\b/i);

    if (heightMatch) {
      const rawH = heightMatch[1].replace(',', '.');
      if (rawH.includes('m')) {
        const parts = rawH.split('m');
        const meters = parseInt(parts[0], 10) || 1;
        const centimeters = parseInt(parts[1], 10) || 0;
        currentProfile.height = meters * 100 + (centimeters < 10 ? centimeters * 10 : centimeters);
      } else {
        const val = parseFloat(rawH);
        currentProfile.height = val < 3 ? Math.round(val * 100) : Math.round(val);
      }
    } else {
      // Standalone 3-digit height: e.g. "160" or "cao 160"
      const standaloneH = lower.match(/\b(1[4-9]\d)\b/);
      if (standaloneH) {
        currentProfile.height = parseInt(standaloneH[1], 10);
      }
    }

    // Weight parsing: "50kg", "50 ký", "nặng 50kg", "50 kg", "mình nặng 50kg", "60kg"
    const weightMatch =
      lower.match(/(?:nặng|cân nặng)[^0-9]{0,15}(\d{2}(?:\.\d+)?)\s*(?:kg|ký)?/i) ||
      lower.match(/\b(\d{2}(?:\.\d+)?)\s*(?:kg|ký)\b/i);

    if (weightMatch) {
      currentProfile.weight = parseFloat(weightMatch[1]);
    } else if (!heightMatch && /^\s*(\d{2})\s*$/.test(lower)) {
      // Standalone 2-digit number (e.g. user replies "60" after being asked for weight)
      const num = parseInt(lower.trim(), 10);
      if (num >= 35 && num <= 95) {
        currentProfile.weight = num;
      }
    }

    // Waist (Vòng eo) parsing: "vòng eo 68cm", "vòng eo mình 68cm", "eo 68", "v2 68"
    const waistMatch =
      lower.match(/(?:vòng\s*(?:2|eo)|(?:v2|eo))[^0-9]{0,15}(\d{2,3})\s*(?:cm)?/i);
    if (waistMatch) {
      currentProfile.waist = parseInt(waistMatch[1], 10);
    }

    // Bust (Vòng ngực) parsing: "vòng ngực 86", "vòng ngực mình 86", "ngực 86", "v1 86"
    const bustMatch =
      lower.match(/(?:vòng\s*(?:1|ngực)|(?:v1|ngực))[^0-9]{0,15}(\d{2,3})\s*(?:cm)?/i);
    if (bustMatch) {
      currentProfile.bust = parseInt(bustMatch[1], 10);
    }

    // Hips (Vòng mông) parsing: "vòng mông 92", "vòng mông mình 92", "mông 92", "v3 92"
    const hipsMatch =
      lower.match(/(?:vòng\s*(?:3|mông)|(?:v3|mông))[^0-9]{0,15}(\d{2,3})\s*(?:cm)?/i);
    if (hipsMatch) {
      currentProfile.hips = parseInt(hipsMatch[1], 10);
    }

    // 3-loop shorthand format: "84-66-90", "84 66 90"
    const threeLoopsMatch = lower.match(/\b(\d{2})\s*[-/,\s]\s*(\d{2})\s*[-/,\s]\s*(\d{2,3})\b/);
    if (threeLoopsMatch && !bustMatch && !waistMatch) {
      currentProfile.bust = parseInt(threeLoopsMatch[1], 10);
      currentProfile.waist = parseInt(threeLoopsMatch[2], 10);
      currentProfile.hips = parseInt(threeLoopsMatch[3], 10);
    }

    // Fit preference:
    if (/(ôm sát|bó sát|ôm dáng|body|ôm body)/i.test(lower)) {
      currentProfile.fitPreference = 'ôm sát';
    } else if (/(rộng rãi|thoải mái|hơi rộng|dáng suông|rộng)/i.test(lower)) {
      currentProfile.fitPreference = 'rộng thoải mái';
    } else if (/(vừa vặn|chuẩn form|vừa người)/i.test(lower)) {
      currentProfile.fitPreference = 'vừa vặn';
    }

    // 2. Check if inquiring about a specific product
    let targetProductCard: ChatProductCard | null = null;
    let targetProductDoc: any = null;

    const resolvedCard = this.sessionService.resolveFollowUpProduct(message, context);
    if (resolvedCard) {
      targetProductCard = resolvedCard;
      targetProductDoc = await this.productService.getProductById(resolvedCard.id);
    } else if (
      context?.lastProducts &&
      context.lastProducts.length > 0 &&
      /(mẫu này|đầm này|váy này|cái này|sản phẩm này|có size|size m|size l|size s)/i.test(lower)
    ) {
      targetProductCard = context.lastProducts[0];
      targetProductDoc = await this.productService.getProductById(targetProductCard.id);
    }

    // Check inquiry about a specific size: S, M, L, XL, XXL
    const sizeInquiredMatch =
      lower.match(/\b(?:size|cỡ)\s*([sml]|xl|xxl)\b/i) || lower.match(/\b([sml]|xl|xxl)\b/i);
    const inquiredSize = sizeInquiredMatch ? sizeInquiredMatch[1].toUpperCase() : null;

    // Helper format height string "1m60"
    const formatH = (h: number): string => {
      if (!h) return '';
      if (h >= 100 && h < 250) {
        const m = Math.floor(h / 100);
        const cm = h % 100;
        return `${m}m${cm < 10 ? '0' + cm : cm}`;
      }
      return `${h}cm`;
    };

    // Query classification
    const isGeneralGuide =
      /(hướng dẫn.*(?:chọn size|cách chọn|bảng size)|cách chọn size|size chuẩn|chuẩn size|cách đo)/i.test(lower) &&
      !heightMatch &&
      !weightMatch &&
      !waistMatch;
    const isSizeComparison =
      /(khác nhau.*size|size.*khác nhau)/i.test(lower) ||
      (lower.includes('size m') && lower.includes('size l'));
    const isFitInquiry =
      /(mặc ôm.*(?:chật|không)|có bị (?:chật|rộng|kích)|bị chật không|chật không|rộng không)/i.test(lower);
    const isSpecificSizeCheck =
      inquiredSize && /(được không|được ko|vừa không|vừa ko|hợp không|ổn không|nhỉ)/i.test(lower);
    const isStockAvailability =
      inquiredSize && /(có size|còn size|còn hàng|hết hàng)/i.test(lower);

    // 3. Assemble verified facts
    const factsList: string[] = [];
    factsList.push('HƯỚNG DẪN SIZE CHUẨN CỦA CHÉRI (Văn bản thuần, không dùng markdown **):');
    factsList.push('- Bảng size tham khảo Chéri:');
    factsList.push('  • Size S: Chiều cao 1m50 - 1m60 | Cân nặng 40 - 47kg | Eo 62 - 66cm | Ngực 80 - 85cm');
    factsList.push('  • Size M: Chiều cao 1m55 - 1m65 | Cân nặng 48 - 53kg | Eo 66 - 70cm | Ngực 86 - 90cm');
    factsList.push('  • Size L: Chiều cao 1m58 - 1m68 | Cân nặng 54 - 58kg | Eo 70 - 75cm | Ngực 90 - 95cm');
    factsList.push('  • Size XL: Chiều cao 1m60 - 1m70 | Cân nặng 59 - 65kg | Eo 75 - 80cm | Ngực 95 - 100cm');

    if (
      currentProfile.height ||
      currentProfile.weight ||
      currentProfile.waist ||
      currentProfile.bust ||
      currentProfile.hips ||
      currentProfile.fitPreference
    ) {
      factsList.push('\nTHÔNG TIN KHÁCH ĐÃ CUNG CẤP TRONG HỘI THOẠI:');
      if (currentProfile.height) factsList.push(`• Chiều cao: ${formatH(currentProfile.height)}`);
      if (currentProfile.weight) factsList.push(`• Cân nặng: ${currentProfile.weight}kg`);
      if (currentProfile.waist) factsList.push(`• Vòng eo: ${currentProfile.waist}cm`);
      if (currentProfile.bust) factsList.push(`• Vòng ngực: ${currentProfile.bust}cm`);
      if (currentProfile.hips) factsList.push(`• Vòng mông: ${currentProfile.hips}cm`);
      if (currentProfile.fitPreference) factsList.push(`• Sở thích mặc: ${currentProfile.fitPreference}`);
    }

    if (targetProductCard && targetProductDoc) {
      const stockInfo = await this.productService.checkProductStock(
        targetProductCard.id,
        undefined,
        inquiredSize || undefined,
      );
      factsList.push(`\nSẢN PHẨM KHÁCH QUAN TÂM: "${targetProductCard.title}"`);
      factsList.push(`• Các size thực tế hiện có trong kho: ${(stockInfo.availableSizes || []).join(', ') || 'Đang cập nhật'}`);
      if (inquiredSize) {
        factsList.push(
          `• Size ${inquiredSize}: ${stockInfo.inStock ? `Đang CÒN HÀNG (còn ${stockInfo.availableStock} sản phẩm)` : 'ĐÃ TẠM HẾT HÀNG'}`,
        );
      }
    }

    // 4. Call Gemini AI with verified context and conversation history
    let aiReply = '';
    try {
      aiReply = await this.aiService.generateResponse(
        message,
        factsList.join('\n'),
        CHERI_SYSTEM_PROMPTS.sizeConsultation,
        history,
      );
    } catch (err) {
      this.logger.warn(`Gemini error in handleSizeConsultation: ${err.message}`);
    }

    // 5. Deterministic Fallback if Gemini fails or returns empty
    let fallbackReply = '';

    // Case 1: General sizing guide (e.g. "Hướng dẫn mình cách chọn size đầm chuẩn")
    if (isGeneralGuide) {
      fallbackReply = `Để chọn size đầm phù hợp, nàng nên dựa vào 3 số đo chính:\n\n• Vòng ngực: Đo tại vị trí lớn nhất.\n• Vòng eo: Đo tại vị trí nhỏ nhất.\n• Vòng mông: Đo tại vị trí lớn nhất.\n\nNàng có thể gửi chiều cao, cân nặng hoặc số đo 3 vòng để Chéri tư vấn size phù hợp nhé! ❤️`;
    }
    // Case 2: Specific product stock inquiry (e.g. "Đầm này có size L không?")
    else if (targetProductCard && (isStockAvailability || (inquiredSize && !isSpecificSizeCheck))) {
      const stockInfo = await this.productService.checkProductStock(targetProductCard.id, undefined, inquiredSize);
      if (stockInfo.inStock) {
        fallbackReply = `Mẫu "${targetProductCard.title}" hiện đang còn size ${inquiredSize} (còn ${stockInfo.availableStock} sản phẩm). Nàng có thể nhấn vào thẻ sản phẩm bên dưới để xem chi tiết và đặt hàng nhé! ❤️`;
      } else {
        const otherSizes = (stockInfo.availableSizes || []).filter((s) => s.toUpperCase() !== inquiredSize);
        fallbackReply = `Mẫu "${targetProductCard.title}" hiện size ${inquiredSize} đã tạm hết hàng. Mẫu này hiện còn các size: ${otherSizes.join(', ') || 'liên hệ Chéri'}. Nàng có thể tham khảo các size còn lại nhé! ❤️`;
      }
    }
    // Case 3: Size comparison inquiry (e.g. "Size M và L khác nhau sao?")
    else if (isSizeComparison) {
      fallbackReply = `Tại Chéri, sự khác biệt giữa hai size như sau:\n\n• Size M: Phù hợp chiều cao 1m55 - 1m65, cân nặng 48 - 53kg, vòng eo 66 - 70cm, vòng ngực 86 - 90cm.\n• Size L: Phù hợp chiều cao 1m58 - 1m68, cân nặng 54 - 58kg, vòng eo 70 - 75cm, vòng ngực 90 - 95cm.\n\nHai size chênh lệch khoảng 4 - 5cm ở vòng ngực và vòng eo. Nàng có thể gửi số đo vòng eo hoặc cân nặng để Chéri tư vấn size phù hợp nhé! ❤️`;
    }
    // Case 4: Specific size check given height & weight (e.g. "Size L được không?")
    else if (isSpecificSizeCheck && currentProfile.height && currentProfile.weight) {
      const targetSize = inquiredSize || 'L';
      const isL = targetSize === 'L';
      if (isL && currentProfile.weight >= 59) {
        fallbackReply = `Với chiều cao ${formatH(currentProfile.height)} và cân nặng ${currentProfile.weight}kg, nàng mặc size L có thể hơi ôm vừa người. Nếu nàng thích mặc thoải mái hoặc mẫu đầm ít co giãn thì size XL sẽ dễ chịu hơn nhé. Nàng cho Chéri biết mẫu đầm đang chọn để mình kiểm tra chất liệu và độ co giãn cụ thể nhé! ❤️`;
      } else if (isL && currentProfile.weight <= 53) {
        fallbackReply = `Với chiều cao ${formatH(currentProfile.height)} và cân nặng ${currentProfile.weight}kg, nàng mặc size M sẽ vừa vặn hơn size L nhé. Nàng cho Chéri biết mẫu đầm đang chọn để mình tư vấn chính xác phom dáng nhé! ❤️`;
      } else {
        fallbackReply = `Với chiều cao ${formatH(currentProfile.height)} và cân nặng ${currentProfile.weight}kg, nàng mặc size ${targetSize} của Chéri là vừa vặn nhé. Nàng có thể cho Chéri biết mẫu đầm đang chọn để mình kiểm tra độ co giãn và bảng size chi tiết nhé! ❤️`;
      }
    }
    // Case 5: Customer provided only weight (e.g. "60kg mặc size gì?")
    else if (currentProfile.weight && !currentProfile.height && !currentProfile.waist) {
      fallbackReply = `Nàng ${currentProfile.weight}kg thì cho Chéri biết thêm chiều cao nhé! Vì cùng cân nặng nhưng chiều cao và dáng người khác nhau sẽ phù hợp với size khác nhau ạ. ❤️`;
    }
    // Case 6: Customer provided only height (and no weight)
    else if (currentProfile.height && !currentProfile.weight && !currentProfile.waist) {
      fallbackReply = `Nàng cao ${formatH(currentProfile.height)} thì cho Chéri biết thêm cân nặng để tư vấn size phù hợp nhé! ❤️`;
    }
    // Case 7: Customer provided both height and weight (e.g. "Mình cao 1m60" when 60kg already known, or "1m60 50kg thì mặc size gì")
    else if (currentProfile.height && currentProfile.weight && !currentProfile.waist) {
      let suggestedSize = 'M';
      if (currentProfile.weight < 48) suggestedSize = 'S';
      else if (currentProfile.weight >= 59) suggestedSize = 'XL';
      else if (currentProfile.weight >= 54) suggestedSize = 'L';

      const altSize =
        currentProfile.fitPreference === 'ôm sát' && suggestedSize === 'M'
          ? 'S'
          : currentProfile.fitPreference === 'rộng thoải mái' && suggestedSize === 'M'
          ? 'L'
          : null;

      if (targetProductCard) {
        fallbackReply = `Với chiều cao ${formatH(currentProfile.height)} và cân nặng ${currentProfile.weight}kg, mẫu "${targetProductCard.title}" nàng mặc size ${suggestedSize} sẽ vừa vặn nhé! Nàng có thể nhấn vào thẻ sản phẩm bên dưới để xem chi tiết và đặt hàng nhé. ❤️`;
      } else if (/(mặc size gì|size nào|vừa size nào|thì mặc size)/i.test(lower)) {
        fallbackReply = `Với chiều cao ${formatH(currentProfile.height)} và cân nặng ${currentProfile.weight}kg, nàng mặc size ${suggestedSize} của Chéri sẽ vừa vặn nhé!${altSize ? ` Nếu nàng thích mặc ${currentProfile.fitPreference}, nàng có thể cân nhắc chọn size ${altSize} ạ.` : ''} Nàng đang quan tâm mẫu đầm nào để Chéri kiểm tra bảng size chi tiết của sản phẩm nhé? ❤️`;
      } else {
        fallbackReply = `Với chiều cao ${formatH(currentProfile.height)} và cân nặng ${currentProfile.weight}kg, Chéri cần biết thêm mẫu đầm nàng đang quan tâm để tư vấn size chính xác theo bảng size của sản phẩm nhé! ❤️`;
      }
    }
    // Case 8: Customer provided waist (e.g. "Vòng eo mình 68cm")
    else if (currentProfile.waist) {
      let sizeByWaist = 'M';
      if (currentProfile.waist <= 66) sizeByWaist = 'S';
      else if (currentProfile.waist <= 70) sizeByWaist = 'M';
      else if (currentProfile.waist <= 75) sizeByWaist = 'L';
      else sizeByWaist = 'XL';

      const infoSummary: string[] = [];
      if (currentProfile.height) infoSummary.push(`chiều cao ${formatH(currentProfile.height)}`);
      if (currentProfile.weight) infoSummary.push(`cân nặng ${currentProfile.weight}kg`);
      infoSummary.push(`vòng eo ${currentProfile.waist}cm`);

      fallbackReply = `Với ${infoSummary.join(', ')}, nàng mặc size ${sizeByWaist} của Chéri sẽ vừa vặn nhé! Nàng thích mặc ôm hay vừa vặn thoải mái, hoặc đang quan tâm mẫu đầm nào để Chéri tư vấn chi tiết hơn ạ? ❤️`;
    }
    // Case 9: Fit or tightness question ("Mặc ôm có bị chật không?")
    else if (isFitInquiry) {
      fallbackReply = `Để biết đầm mặc ôm có bị chật không, Chéri cần biết thêm mẫu đầm nàng đang quan tâm hoặc số đo vòng eo của nàng nhé, vì mỗi thiết kế và chất liệu vải sẽ có độ co giãn khác nhau ạ. ❤️`;
    }
    // Case 10: Fit preference
    else if (currentProfile.fitPreference) {
      fallbackReply = `Chéri đã ghi nhận sở thích mặc ${currentProfile.fitPreference} của nàng rồi ạ! Nếu thích thoải mái, nàng có thể chọn tăng lên 1 size hoặc chọn các mẫu đầm dáng xòe hay suông nhẹ nhé. Nàng đang quan tâm mẫu đầm nào của Chéri để mình tư vấn cụ thể ạ? ❤️`;
    }
    // Case 11: General fallback
    else {
      fallbackReply = `Để chọn size đầm phù hợp, nàng nên dựa vào 3 số đo chính:\n\n• Vòng ngực: Đo tại vị trí lớn nhất.\n• Vòng eo: Đo tại vị trí nhỏ nhất.\n• Vòng mông: Đo tại vị trí lớn nhất.\n\nNàng có thể gửi chiều cao, cân nặng hoặc số đo 3 vòng để Chéri tư vấn size phù hợp nhé! ❤️`;
    }

    return {
      reply: aiReply || fallbackReply,
      intent: 'size_consultation',
      products: targetProductCard ? [targetProductCard] : undefined,
      sizingProfile: currentProfile,
    };
  }

  /**
   * Recommendations: Exclude isSynthetic: true. No fake best-seller claims.
   */
  /**
   * Recommendations: Exclude isSynthetic: true. No fake best-seller claims.
   * If user query specifies criteria or category, delegates immediately to handleSearch.
   */
  private async handleRecommendation(
    message?: string,
    context?: any,
    user?: any,
    guestCartId?: string,
  ): Promise<ChatbotResponse> {
    const lower = (message || '').toLowerCase();
    // If user message contains category, price, color, or filters, route to search
    if (
      message &&
      /(?:đầm|váy|áo|quần|chân váy|set|bộ|size|màu|giá|rẻ|mới|dưới|trên|k\b|triệu|tr\b)/i.test(lower)
    ) {
      return this.handleSearch(message, context);
    }

    const products = await this.productService.getRecommendations(user, guestCartId, 4);

    if (products.length === 0) {
      return {
        reply: 'Chào nàng, Chéri đang cập nhật các bộ sưu tập mới nhất. Nàng vui lòng quay lại sau ít phút hoặc xem tại trang chủ nhé! ❤️',
        intent: 'recommendation',
      };
    }

    const titles = products.map((p) => `"${p.title}"`).join(', ');
    const verifiedFacts = `Các mẫu thiết kế phù hợp đang có sẵn: ${titles}`;
    let aiReply = '';
    try {
      aiReply = await this.aiService.generateResponse(
        'Gợi ý sản phẩm cho khách',
        verifiedFacts,
        CHERI_SYSTEM_PROMPTS.productSearch,
      );
    } catch {
      // safe fallback
    }

    return {
      reply:
        aiReply ||
        'Dạ Chéri xin gợi ý một số mẫu thiết kế phù hợp và thanh lịch dành riêng cho nàng. Nàng nhấn vào từng mẫu bên dưới để xem chi tiết nhé! ❤️',
      intent: 'recommendation',
      products,
      currentCategory: 'đầm',
    };
  }

  /**
   * Multi-criteria Search & Context-Aware Follow-ups:
   * Handles:
   * 1. Contextual comparisons ("mẫu nào rẻ nhất", "sản phẩm nào rẻ nhất", "mẫu nào đắt nhất")
   * 2. Contextual attribute checks ("có màu đen không", "còn size M không")
   * 3. Contextual relative price checks ("có mẫu nào rẻ hơn không")
   * 4. Multi-turn category retention & switching ("thế còn quần")
   * 5. Multi-criteria AND filtering (Category + Color + Size + Price + In-stock)
   */
  private async handleSearch(message: string, context?: any): Promise<ChatbotResponse> {
    const lower = (message || '').toLowerCase().trim();

    // 1. Contextual Follow-Up: "Mẫu nào rẻ nhất?" or "Sản phẩm nào rẻ nhất?"
    if (
      /(?:mẫu nào|sản phẩm nào|cái nào).*(?:rẻ nhất|thấp nhất|giá rẻ nhất)/i.test(lower) ||
      /^(?:mẫu|sản phẩm)?\s*rẻ nhất(?:\s*ạ|\s*nhỉ|\?)?$/i.test(lower)
    ) {
      if (context?.lastProducts && context.lastProducts.length > 0) {
        const sorted = [...context.lastProducts].sort((a, b) => a.price - b.price);
        const cheapest = sorted[0];
        return {
          reply: `Trong những mẫu vừa gợi ý, ${cheapest.title} có giá thấp nhất là ${cheapest.price.toLocaleString('vi-VN')}đ ạ. ❤️`,
          intent: 'product_search',
          products: [cheapest],
          currentCategory: context?.currentCategory || 'đầm',
          criteria: { ...context?.criteria, sortBy: 'price_asc' },
        };
      }
    }

    // 2. Contextual Follow-Up: "Mẫu nào đắt nhất?" or "Sản phẩm nào đắt nhất?"
    if (
      /(?:mẫu nào|sản phẩm nào|cái nào).*(?:đắt nhất|cao nhất|giá cao nhất)/i.test(lower) ||
      /^(?:mẫu|sản phẩm)?\s*đắt nhất(?:\s*ạ|\s*nhỉ|\?)?$/i.test(lower)
    ) {
      if (context?.lastProducts && context.lastProducts.length > 0) {
        const sorted = [...context.lastProducts].sort((a, b) => b.price - a.price);
        const priciest = sorted[0];
        return {
          reply: `Trong những mẫu vừa gợi ý, ${priciest.title} có giá cao nhất là ${priciest.price.toLocaleString('vi-VN')}đ ạ. ❤️`,
          intent: 'product_search',
          products: [priciest],
          currentCategory: context?.currentCategory || 'đầm',
          criteria: { ...context?.criteria, sortBy: 'price_desc' },
        };
      }
    }

    // 3. Contextual Follow-Up: "Có màu [màu] không?"
    const parsedForColor = this.productService.parseCriteriaFromText(message, context);
    const hasColorWord = /(?:có|mẫu nào có)\s+màu\s+/i.test(lower) || (parsedForColor.color && !parsedForColor.category);

    if (hasColorWord && context?.lastProducts && context.lastProducts.length > 0 && parsedForColor.color) {
      const colorAliases = this.productService.getColorAliases(parsedForColor.color);
      const colorRegex = new RegExp(colorAliases.join('|'), 'i');

      const matchedInCurrent = context.lastProducts.filter((p: any) => {
        const colors = [...(p.colors || []), ...(p.availableColors || [])];
        return colors.some((c: string) => colorRegex.test(c)) || colorRegex.test(p.title);
      });

      if (matchedInCurrent.length > 0) {
        const names = matchedInCurrent.map((p: any) => `"${p.title}"`).join(', ');
        return {
          reply: `Trong các mẫu nàng vừa xem, mẫu ${names} có phiên bản màu ${parsedForColor.color} nhé! ❤️`,
          intent: 'product_search',
          products: matchedInCurrent,
          currentCategory: context?.currentCategory || 'đầm',
          criteria: { ...context?.criteria, color: parsedForColor.color },
        };
      }

      // If not in current, check store for this color in currentCategory
      const cat = context?.currentCategory || 'đầm';
      const storeItems = await this.productService.searchProductsWithCriteria(
        { category: cat, color: parsedForColor.color, onlyInStock: true },
        4,
      );
      if (storeItems.length > 0) {
        return {
          reply: `Các mẫu vừa rồi chưa có màu ${parsedForColor.color}, nhưng Chéri tìm thấy các mẫu ${cat} màu ${parsedForColor.color} khác của shop cho nàng đây nhé! ❤️`,
          intent: 'product_search',
          products: storeItems,
          currentCategory: cat,
          criteria: { category: cat, color: parsedForColor.color },
        };
      } else {
        return {
          reply: `Hiện Chéri chưa tìm thấy mẫu ${cat} màu ${parsedForColor.color} nào còn hàng ạ. Nàng có muốn tham khảo các gam màu khác như trắng, be hay đỏ không? ❤️`,
          intent: 'product_search',
          products: [],
          currentCategory: cat,
        };
      }
    }

    // 4. Contextual Follow-Up: "Có mẫu nào rẻ hơn không?"
    if (/(?:có mẫu nào|có cái nào)?\s*rẻ hơn\s*(?:không|ko|\?)?/i.test(lower)) {
      if (context?.lastProducts && context.lastProducts.length > 0) {
        const minPriceSeen = Math.min(...context.lastProducts.map((p: any) => p.price));
        const category = context?.currentCategory || 'đầm';
        const cheaperProducts = await this.productService.searchProductsWithCriteria(
          { category, maxPrice: minPriceSeen - 1, sortBy: 'price_asc', onlyInStock: true },
          4,
        );
        if (cheaperProducts.length > 0) {
          return {
            reply: `Chéri tìm thấy các mẫu ${category} có mức giá tiết kiệm hơn cho nàng đây nhé! ❤️`,
            intent: 'product_search',
            products: cheaperProducts,
            currentCategory: category,
            criteria: { category, maxPrice: minPriceSeen - 1, sortBy: 'price_asc' },
          };
        } else {
          return {
            reply: `Dạ trong danh mục ${category}, các mẫu vừa gợi ý đã là mức giá tốt nhất tại Chéri rồi ạ. Nàng có thể tham khảo thêm các thiết kế xinh xắn này nhé! ❤️`,
            intent: 'product_search',
            products: context.lastProducts,
            currentCategory: category,
          };
        }
      }
    }

    // 5. Contextual Follow-Up: "Mẫu đầu tiên còn size L không?" / "Mẫu thứ 2 còn hàng không?"
    if (/(?:mẫu đầu tiên|mẫu thứ|mẫu số|mẫu 1|mẫu 2|mẫu 3).*(?:size|còn|hết)/i.test(lower)) {
      const targetProduct = this.sessionService.resolveFollowUpProduct(message, context);
      if (targetProduct) {
        const stockInfo = await this.productService.checkProductStock(
          targetProduct.id,
          parsedForColor.color,
          parsedForColor.size,
        );
        let reply = '';
        if (parsedForColor.size) {
          reply = stockInfo.inStock
            ? `Mẫu "${targetProduct.title}" hiện ĐANG CÒN HÀNG size ${parsedForColor.size} (còn ${stockInfo.availableStock} sản phẩm). Nàng nhấn vào thẻ để xem chi tiết nhé! ❤️`
            : `Mẫu "${targetProduct.title}" hiện size ${parsedForColor.size} đã tạm hết hàng. Mẫu này hiện còn các size: ${stockInfo.availableSizes.join(', ') || 'liên hệ shop'} ạ. ❤️`;
        } else {
          reply = stockInfo.inStock
            ? `Mẫu "${targetProduct.title}" hiện đang sẵn hàng phục vụ nàng nhé! ❤️`
            : `Mẫu "${targetProduct.title}" hiện đã tạm hết hàng ạ. ❤️`;
        }
        return {
          reply,
          intent: 'product_detail',
          products: [targetProduct],
          currentCategory: context?.currentCategory,
        };
      }
    }

    // 6. Category switching ("Thế còn quần?" -> switches category to quần and clears old filters)
    const isCategorySwitch = /(?:thế còn|còn|sang|chuyển sang)\s+(quần|áo|đầm|váy|chân váy|set)/i.test(lower);
    const effectiveContext = isCategorySwitch ? {} : context;
    const criteria = this.productService.parseCriteriaFromText(message, effectiveContext);

    // Default to 'đầm' if asking for recommendations or designs without explicit category
    if (!criteria.category && /(?:gợi ý|mới nhất|giá rẻ|dưới\s*\d|bán chạy|xem mẫu)/i.test(lower)) {
      criteria.category = context?.currentCategory || 'đầm';
    }

    const products = await this.productService.searchProductsWithCriteria(criteria, 4);

    // If no products match all strict criteria, inform the customer clearly (no fake fallback)
    if (products.length === 0) {
      let noMatchMsg = `Hiện Chéri chưa tìm thấy mẫu ${criteria.category || 'sản phẩm'}`;
      if (criteria.color) noMatchMsg += ` màu ${criteria.color}`;
      if (criteria.size) noMatchMsg += ` size ${criteria.size}`;
      if (criteria.maxPrice) noMatchMsg += ` dưới ${criteria.maxPrice.toLocaleString('vi-VN')}đ`;
      if (criteria.minPrice && !criteria.maxPrice) {
        noMatchMsg += ` từ ${criteria.minPrice.toLocaleString('vi-VN')}đ trở lên`;
      }
      noMatchMsg += ' phù hợp trong kho. Nàng muốn xem thử mức giá khác hoặc điều chỉnh tiêu chí không ạ? ❤️';

      return {
        reply: noMatchMsg,
        intent: 'product_search',
        products: [],
        currentCategory: criteria.category || context?.currentCategory,
        criteria,
      };
    }

    // Products found -> Build verified reply
    const catName = criteria.category || 'thiết kế';
    let defaultReply = '';
    if (criteria.sortBy === 'newest') {
      defaultReply = `Chéri gửi nàng những mẫu ${catName} mới được cập nhật tại shop nhé! ❤️`;
    } else if (criteria.sortBy === 'price_asc') {
      defaultReply = `Chéri gửi nàng các mẫu ${catName} có giá tốt nhất của shop nhé! ❤️`;
    } else if (criteria.color && criteria.maxPrice) {
      defaultReply = `Chéri tìm được các mẫu ${catName} màu ${criteria.color} trong ngân sách ${criteria.maxPrice.toLocaleString('vi-VN')}đ của nàng nhé! ❤️`;
    } else if (criteria.color) {
      defaultReply = `Chéri gửi nàng các mẫu ${catName} màu ${criteria.color} xinh xắn của shop nhé! ❤️`;
    } else if (criteria.maxPrice) {
      defaultReply = `Chéri tìm được các mẫu ${catName} trong ngân sách ${criteria.maxPrice.toLocaleString('vi-VN')}đ của nàng nhé! ❤️`;
    } else if (/(?:có bán quần không|có quần không|shop có quần)/i.test(lower)) {
      defaultReply = `Chéri có các mẫu quần nữ thiết kế thanh lịch và tôn dáng cho nàng nhé! ❤️`;
    } else {
      defaultReply = `Chéri gửi nàng những mẫu ${catName} phù hợp với mong muốn của nàng đây ạ! ❤️`;
    }

    return {
      reply: defaultReply,
      intent: 'product_search',
      products,
      currentCategory: criteria.category || context?.currentCategory,
      criteria,
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

  /**
   * Universal output sanitizer guaranteeing plain text responses,
   * stripping raw markdown asterisks/headings while preserving Markdown links,
   * removing fluffy marketing phrases, and capping emojis to at most 1.
   */
  private formatCleanResponse(reply: string): string {
    if (!reply) return '';

    let cleaned = reply;

    // Strip markdown tables (e.g. | Sản phẩm | Giá | or |--|--|)
    cleaned = cleaned.replace(/^\|.*\|$/gm, '');
    cleaned = cleaned.replace(/(?:^|\n)\|[^\n]+\|(?:\n|$)/g, '\n');
    cleaned = cleaned.replace(/\|/g, '');

    // Strip bold and italic markdown while preserving inner text
    cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
    cleaned = cleaned.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');

    // Strip heading markdown (#, ##, ###)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // Convert asterisk or dash list markers to standard bullet "• "
    cleaned = cleaned.replace(/^\s*[\*\-]\s+/gm, '• ');

    // Strip cliché/fluffy marketing phrases
    cleaned = cleaned.replace(/\b(chiếc đầm hoàn hảo nhất|tôn dáng nhất|mông nở nang nhất|thước dây chỉ nên chạm sát da|thước dây vừa chạm sát da|đo nhẹ nhàng qua đỉnh ngực)\b/gi, '');

    // Strip "Sale " prefix if mistakenly stuck to product names in response text
    cleaned = cleaned.replace(/\bSale\s+([A-ZÀ-Ỹ])/g, '$1');

    // Limit emojis to at most 1 emoji, preserving exact system/auth order messages
    const isOrderExact =
      reply.includes('Bạn vui lòng đăng nhập') ||
      reply.includes('Bạn chưa có đơn hàng') ||
      reply.includes('Đây là danh sách đơn hàng');

    if (!isOrderExact) {
      cleaned = this.limitEmojisToOne(cleaned);
    }

    return cleaned.trim();
  }

  /**
   * Enforces at most 1 emoji per message
   */
  private limitEmojisToOne(text: string): string {
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    const matches = Array.from(text.matchAll(emojiRegex));
    if (matches.length <= 1) {
      return text;
    }

    // Keep the last emoji, remove all preceding emojis
    let result = '';
    let lastIndex = 0;

    for (let i = 0; i < matches.length - 1; i++) {
      const m = matches[i];
      const matchIndex = m.index ?? 0;
      result += text.substring(lastIndex, matchIndex);
      lastIndex = matchIndex + m[0].length;
    }

    result += text.substring(lastIndex);
    return result.replace(/  +/g, ' ');
  }
}
