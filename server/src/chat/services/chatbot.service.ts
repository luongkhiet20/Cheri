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
      intent = this.intentService.classifyIntent(rawMessage);
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
          response = await this.handleSizeConsultation(rawMessage, session.context);
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
    if (response.sizingProfile) {
      contextUpdates.sizingProfile = response.sizingProfile;
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
      potentialCodes = words.filter(w => {
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
   * Guides 3 body measurements, asks height/weight/fit preferences,
   * inspects MongoDB products/variants for specific garments,
   * and provides natural Gemini AI recommendations with robust deterministic fallback.
   */
  private async handleSizeConsultation(message: string, context?: any): Promise<ChatbotResponse> {
    const lower = (message || '').toLowerCase();

    // 1. Context parsing & multi-turn profile maintenance
    const currentProfile: any = { ...(context?.sizingProfile || {}) };

    // Height parsing: "1m60", "1m58", "cao 1m65", "160cm", "cao 160", "mình cao 1m60"
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
    }

    // Weight parsing: "50kg", "50 ký", "nặng 50kg", "50 kg", "mình nặng 50kg"
    const weightMatch =
      lower.match(/(?:nặng|cân nặng)[^0-9]{0,15}(\d{2}(?:\.\d+)?)\s*(?:kg|ký)?/i) ||
      lower.match(/\b(\d{2}(?:\.\d+)?)\s*(?:kg|ký)\b/i);
    if (weightMatch) {
      currentProfile.weight = parseFloat(weightMatch[1]);
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
    if (/(ôm sát|bó sát|ôm dáng|body|tôn dáng|ôm body)/i.test(lower)) {
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

    // 3. Assemble verified facts
    const factsList: string[] = [];
    factsList.push('HƯỚNG DẪN SIZE CHUẨN CỦA CHÉRI:');
    factsList.push(
      '- Cách đo 3 vòng: Vòng 1 (ngực - đo qua đỉnh ngực), Vòng 2 (eo - điểm nhỏ nhất trên rốn 2-3cm), Vòng 3 (mông - điểm nở nang nhất). Thước dây vừa chạm sát cơ thể, không siết chặt.',
    );
    factsList.push('- Bảng size tham khảo Chéri:');
    factsList.push('  + Size S: Chiều cao 1m50 - 1m60 | Cân nặng 40 - 47kg | Eo 62 - 66cm | Ngực 80 - 85cm');
    factsList.push('  + Size M: Chiều cao 1m55 - 1m65 | Cân nặng 48 - 53kg | Eo 66 - 70cm | Ngực 86 - 90cm');
    factsList.push('  + Size L: Chiều cao 1m58 - 1m68 | Cân nặng 54 - 58kg | Eo 70 - 75cm | Ngực 90 - 95cm');
    factsList.push('  + Size XL: Chiều cao 1m60 - 1m70 | Cân nặng 59 - 65kg | Eo 75 - 80cm | Ngực 95 - 100cm');

    if (
      currentProfile.height ||
      currentProfile.weight ||
      currentProfile.waist ||
      currentProfile.bust ||
      currentProfile.hips ||
      currentProfile.fitPreference
    ) {
      factsList.push('\nTHÔNG TIN KHÁCH ĐÃ CUNG CẤP TRONG CUỘC HỘI THOẠI:');
      if (currentProfile.height) factsList.push(`- Chiều cao: ${currentProfile.height}cm`);
      if (currentProfile.weight) factsList.push(`- Cân nặng: ${currentProfile.weight}kg`);
      if (currentProfile.waist) factsList.push(`- Vòng eo: ${currentProfile.waist}cm`);
      if (currentProfile.bust) factsList.push(`- Vòng ngực: ${currentProfile.bust}cm`);
      if (currentProfile.hips) factsList.push(`- Vòng mông: ${currentProfile.hips}cm`);
      if (currentProfile.fitPreference) factsList.push(`- Sở thích mặc: ${currentProfile.fitPreference}`);
    }

    if (targetProductCard && targetProductDoc) {
      const stockInfo = await this.productService.checkProductStock(
        targetProductCard.id,
        undefined,
        inquiredSize || undefined,
      );
      factsList.push(`\nSẢN PHẨM KHÁCH QUAN TÂM: "${targetProductCard.title}"`);
      factsList.push(`- Các size thực tế hiện có trong kho: ${(stockInfo.availableSizes || []).join(', ') || 'Đang cập nhật'}`);
      if (inquiredSize) {
        factsList.push(
          `- Size ${inquiredSize}: ${stockInfo.inStock ? `Đang CÒN HÀNG (còn ${stockInfo.availableStock} sản phẩm)` : 'ĐÃ TẠM HẾT HÀNG'}`,
        );
      }
      factsList.push('- Lưu ý: Sản phẩm không có bảng thông số chi tiết cm riêng trong cơ sở dữ liệu, tư vấn dựa trên bảng size chuẩn và độ co giãn của phom đầm.');
    }

    // 4. Call Gemini AI with verified context
    let aiReply = '';
    try {
      aiReply = await this.aiService.generateResponse(
        message,
        factsList.join('\n'),
        CHERI_SYSTEM_PROMPTS.sizeConsultation,
      );
    } catch (err) {
      this.logger.warn(`Gemini error in handleSizeConsultation: ${err.message}`);
    }

    // 5. High-quality Deterministic Fallback (if Gemini fails or is empty)
    let fallbackReply = '';

    // Case A: Specific product size inquiry (e.g. "Mẫu đầm này có size M không?")
    if (targetProductCard && inquiredSize) {
      const stockInfo = await this.productService.checkProductStock(targetProductCard.id, undefined, inquiredSize);
      if (stockInfo.inStock) {
        fallbackReply = `Dạ mẫu "${targetProductCard.title}" hiện ĐANG CÒN size ${inquiredSize} (còn ${stockInfo.availableStock} sản phẩm) sẵn sàng gửi đến nàng ạ! ✨\n\nNàng có thể nhấn vào thẻ sản phẩm bên dưới để xem chi tiết và đặt hàng ngay, hoặc chia sẻ thêm chiều cao, cân nặng để Chéri kiểm tra xem size ${inquiredSize} có vừa vặn nhất với nàng không nhé! ❤️`;
      } else {
        const otherSizes = (stockInfo.availableSizes || []).filter((s) => s.toUpperCase() !== inquiredSize);
        fallbackReply = `Dạ mẫu "${targetProductCard.title}" hiện size ${inquiredSize} ĐÃ TẠM HẾT HÀNG rồi ạ. Mẫu này hiện còn các size: ${otherSizes.join(', ') || 'Liên hệ Chéri để đặt may thêm'} ạ. Nàng có thể tham khảo các size còn lại hoặc xem thêm các mẫu đầm xinh khác nhé! ❤️`;
      }
    }
    // Case B: Size comparison inquiry (e.g. "Size M và L khác nhau thế nào?")
    else if (
      /(khác nhau.*size|size.*khác nhau)/i.test(lower) ||
      (lower.includes('size m') && lower.includes('size l'))
    ) {
      fallbackReply = `✨ Tại Chéri, các size đầm được thiết kế chuẩn phom tôn dáng với sự khác biệt chính như sau ạ:\n\n• **Size M:** Thường phù hợp cho nàng cao khoảng 1m55 - 1m65, cân nặng 48 - 53kg, số đo vòng eo khoảng 66 - 70cm.\n• **Size L:** Thường dành cho nàng cao 1m58 - 1m68, cân nặng 54 - 58kg, số đo vòng eo khoảng 70 - 75cm.\n\nSự chênh lệch giữa hai size thường là khoảng 2 - 4cm ở vòng ngực và vòng eo. Nếu nàng đang phân vân giữa hai size, hãy cho Chéri biết số đo vòng eo hoặc cân nặng của nàng, Chéri sẽ tư vấn size chuẩn xác nhất nhé! ❤️`;
    }
    // Case C: Customer provided height and weight (e.g. "Mình cao 1m60, nặng 50kg thì mặc size gì?")
    else if (currentProfile.height && currentProfile.weight && !currentProfile.waist) {
      let suggestedSize = 'M';
      if (currentProfile.weight < 48) suggestedSize = 'S';
      else if (currentProfile.weight > 58) suggestedSize = 'XL';
      else if (currentProfile.weight >= 54) suggestedSize = 'L';

      const altSize =
        currentProfile.fitPreference === 'ôm sát' && suggestedSize === 'M'
          ? 'S'
          : currentProfile.fitPreference === 'rộng thoải mái' && suggestedSize === 'M'
          ? 'L'
          : null;

      fallbackReply = `✨ Với chiều cao ${currentProfile.height}cm và cân nặng ${currentProfile.weight}kg, nàng mặc **size ${suggestedSize}** của Chéri là vừa vặn và tôn dáng nhất nhé!${altSize ? ` Nếu nàng thích mặc ${currentProfile.fitPreference}, nàng có thể cân nhắc chọn size ${altSize} ạ.` : ''}\n\nĐể chiếc đầm chuẩn phom tuyệt đối, nàng có thể đo thêm vòng eo (trên rốn khoảng 2-3cm). Nếu vòng eo từ 66-70cm thì size M là lựa chọn hoàn hảo ạ! Nàng đang ưng ý mẫu đầm nào của Chéri để mình kiểm tra size cho nàng nhé? ❤️`;
    }
    // Case D: Customer provided waist or added waist (e.g. "Vòng eo mình 68cm")
    else if (currentProfile.waist) {
      let sizeByWaist = 'M';
      if (currentProfile.waist <= 66) sizeByWaist = 'S';
      else if (currentProfile.waist <= 70) sizeByWaist = 'M';
      else if (currentProfile.waist <= 75) sizeByWaist = 'L';
      else sizeByWaist = 'XL';

      const infoSummary: string[] = [];
      if (currentProfile.height) infoSummary.push(`chiều cao ${currentProfile.height}cm`);
      if (currentProfile.weight) infoSummary.push(`cân nặng ${currentProfile.weight}kg`);
      infoSummary.push(`vòng eo ${currentProfile.waist}cm`);

      fallbackReply = `✨ Với ${infoSummary.join(', ')}, nàng diện **size ${sizeByWaist}** của Chéri sẽ rất xinh và chuẩn phom nhé! Vòng eo ${currentProfile.waist}cm nằm trọn vẹn trong khoảng chuẩn của size ${sizeByWaist}.\n\nNàng thích mặc ôm sát tôn vòng 2 hay thích phom vừa vặn, hơi rộng một chút để di chuyển thoải mái ạ? Hãy nói cho Chéri biết nhé! ❤️`;
    }
    // Case E: Customer provided fit preference (e.g. "Mình thích mặc hơi rộng")
    else if (currentProfile.fitPreference && (currentProfile.height || currentProfile.weight || currentProfile.waist)) {
      fallbackReply = `✨ Dạ Chéri đã ghi nhận gu mặc **${currentProfile.fitPreference}** của nàng rồi ạ! Nếu thích form rộng rãi thoải mái khi di chuyển hoặc tiệc tùng, nàng có thể chọn tăng lên 1 size (ví dụ từ M lên L) hoặc chọn các thiết kế đầm dáng xòe A hoặc suông nhẹ nhé.\n\nNàng muốn Chéri gợi ý những mẫu đầm thiết kế form suông xòe xinh xắn đang có sẵn không ạ? ❤️`;
    }
    // Case F: General sizing guide (e.g. "Hướng dẫn mình cách chọn size đầm chuẩn")
    else {
      fallbackReply = `✨ Để chọn được chiếc đầm vừa vặn và tôn dáng nhất, nàng nên chú ý đo ba số đo chính bằng thước dây mềm nhé:\n\n• **Vòng 1 (Ngực):** Đo quanh đỉnh ngực lớn nhất, giữ thước dây vừa chạm sát cơ thể.\n• **Vòng 2 (Eo):** Đo tại điểm thắt nhỏ nhất phía trên rốn 2-3cm. Đây là số đo quan trọng nhất khi chọn đầm xòe hoặc đầm ôm Chéri.\n• **Vòng 3 (Mông):** Đo ngang điểm nở nang nhất của vòng 3.\n\nSau khi có số đo, nàng đối chiếu với bảng size của mẫu đầm mình thích nhé! Nếu nàng chưa rõ nên chọn size nào, hãy cho Chéri biết **chiều cao, cân nặng và số đo** (nếu có), Chéri sẽ tư vấn size phù hợp nhất cho nàng ạ! ❤️`;
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
