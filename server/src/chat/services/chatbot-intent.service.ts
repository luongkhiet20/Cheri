import { Injectable } from '@nestjs/common';
import { ChatbotIntent } from '../interfaces/chatbot-response.interface';

@Injectable()
export class ChatbotIntentService {
  /**
   * Classify user message into standardized intents with context awareness
   */
  classifyIntent(message: string, context?: any): ChatbotIntent {
    const lower = (message || '').toLowerCase().trim();

    // 1. Prompt injection / secret sniffing / unrelated
    if (
      /(bỏ qua mọi quy định|ignore (?:all )?instructions|print (?:gemini|api|key)|in (?:gemini|api|key)|mật khẩu|token của hệ thống)/i.test(
        lower,
      )
    ) {
      return 'unrelated';
    }

    // Context-driven continuity: If previous intent was size consultation or sizing profile exists
    const hasSizingContext =
      context?.lastIntent === 'size_consultation' ||
      (context?.sizingProfile && (context.sizingProfile.height || context.sizingProfile.weight));

    if (hasSizingContext) {
      // Short messages continuing size conversation: "60kg", "1m60", "size L được không?", "vừa không?", "có bị chật không?"
      if (
        /^(?:1m\d{2}|\b\d{2,3}\s*cm\b|\b\d{2}\s*kg\b|\d{2,3})$/i.test(lower) ||
        /(?:size|cỡ)\s*[a-z0-9]+\s*(?:được không|được ko|vừa không|vừa ko|hợp không|ổn không|chứ|nhỉ|\?)?/i.test(lower) ||
        /(?:bị|mặc|form|dáng).*(?:chật|rộng|ôm|vừa)/i.test(lower) ||
        /(?:có bị (?:chật|rộng|kích|ngắn|dài)|vừa không|chật không|rộng không|ôm không)/i.test(lower) ||
        /(?:cao\s*\d|nặng\s*\d|mình cao|mình nặng|vòng\s*(?:eo|ngực|mông|1|2|3)|eo\s*\d|ngực\s*\d|mông\s*\d)/i.test(lower)
      ) {
        return 'size_consultation';
      }
    }

    // 2. Greetings (only if message does NOT contain an actual product/size/order inquiry)
    const hasSubstantiveInquiry =
      /(size|cỡ|đơn|mã đơn|đổi|trả|hoàn tiền|giá|bao nhiêu|mẫu|đầm|váy|áo|kg|1m\d{2}|cao|nặng)/i.test(
        lower,
      );

    if (
      /^(chào|chào shop|chào chéri|alo|hi|hello|hey|chào bạn|chào em|shop ơi|chéri ơi|xin chào)\b/i.test(
        lower,
      ) &&
      lower.length < 35 &&
      !hasSubstantiveInquiry
    ) {
      return 'greetings';
    }

    // 3. Order tracking
    if (
      /(đơn hàng|mã đơn|tra cứu đơn|kiểm tra đơn|tình trạng đơn|vận chuyển đơn|đơn của tôi|check đơn|giao hàng đến đâu|mã vận đơn)/i.test(
        lower,
      ) ||
      /(?:đơn|order)\s+[a-z0-9_-]+/i.test(lower) ||
      /đơn.*(?:của tôi|tới đâu|đâu rồi|khi nào)/i.test(lower)
    ) {
      return 'order_tracking';
    }

    // 4. Return/Refund/Exchange Policy specific check (e.g. đổi size, đổi hàng, hoàn tiền)
    if (/(đổi trả|đổi hàng|đổi size|hoàn tiền|trả hàng|đổi mẫu)/i.test(lower)) {
      return 'policy_faq';
    }

    // 5. Direct Follow-up / Specific Product Detail inquiry ("mẫu đầu tiên", "mẫu thứ 1", "mẫu thứ 2", "cái thứ 2")
    if (
      /(mẫu thứ (?:1|2|3|4|hai|ba)|cái thứ (?:1|2|3|4)|mẫu đầu tiên|mẫu 1|mẫu 2|mẫu 3|mẫu này|cái này|chất liệu gì|làm bằng vải gì)/i.test(
        lower,
      )
    ) {
      return 'product_detail';
    }

    // 6. Size Consultation & Measurement Guidance
    if (
      /(hướng dẫn.*(?:chọn size|cỡ|bảng size)|cách chọn size|tư vấn.*(?:size|cỡ)|chọn size|bảng size|size chuẩn|chuẩn size|mặc size gì|size nào|vừa size nào|vừa size gì|mặc vừa không)/i.test(
        lower,
      ) ||
      /(?:cao\s*\d|nặng\s*\d|1m\d{2}|\b\d{2}\s*kg\b|\b\d{2,3}\s*cm\b|vòng\s*(?:eo|ngực|mông|1|2|3)|số đo|thích mặc\s*(?:ôm|rộng|vừa|thoải mái)|mặc hơi (?:rộng|ôm|vừa)|size\s*[a-z0-9]+\s*(?:và|với|hay)\s*size\s*[a-z0-9]+|khác nhau thế nào.*size|size.*khác nhau)/i.test(
        lower,
      ) ||
      /(?:đầm này|váy này|mẫu này).*(?:có|còn)\s+size/i.test(
        lower,
      ) ||
      /(?:có|còn)\s+size\s+[a-z0-9]+\s*(?:không|ko|hết|chứ|\?)/i.test(
        lower,
      ) ||
      /(?:size|cỡ)\s+[a-z0-9]+\s+(?:được không|được ko|vừa không|vừa ko|hợp không|ổn không|nhỉ)/i.test(
        lower,
      ) ||
      /(?:bị|mặc|form|dáng).*(?:chật|rộng|ôm|vừa).*(?:không|ko|chứ)/i.test(
        lower,
      ) ||
      /(?:có\s+bị\s+(?:chật|rộng|kích|ngắn|dài))/i.test(
        lower,
      )
    ) {
      return 'size_consultation';
    }

    // 7. Explicit comparison between 2+ items ("so sánh mẫu A và B", "khác nhau thế nào giữa A và B")
    if (
      /(so sánh.*(với|và)|khác nhau (?:thế nào|gì|ở điểm nào)|phân vân giữa)/i.test(
        lower,
      )
    ) {
      return 'product_compare';
    }

    // 8. Store policies & brand FAQ
    if (
      /(chính sách|bảo hành|hoàn tiền|phí ship|giao hàng|thời gian giao|thanh toán|chéri là gì|giới thiệu shop|địa chỉ|cửa hàng|bao lâu nhận được)/i.test(
        lower,
      )
    ) {
      return 'policy_faq';
    }

    // 9. Customer complaint / handoff
    if (
      /(khiếu nại|phàn nàn|thất vọng|chất lượng kém|giao hàng chậm trễ|hỏng chỉ|bị rách|gặp nhân viên|gặp tư vấn viên|chuyển máy)/i.test(
        lower,
      )
    ) {
      return 'complaint';
    }

    // 10. Product Search (Garments, categories, price filters, colors, contextual follow-ups)
    // Priority: Specific product requests with category, filters or context ALWAYS take precedence over broad recommendation
    if (
      /(đầm|váy|áo|quần|set đồ|chân váy|bộ|top|corset|blazer|jean|trousers)/i.test(lower) ||
      /(rẻ nhất|thấp nhất|đắt nhất|cao nhất|rẻ hơn|dưới\s*\d|tối đa\s*\d|không quá\s*\d|từ\s*\d|trên\s*\d|\bk\b|triệu|\btr\b)/i.test(lower) ||
      /(màu\s*(?:đỏ|đen|trắng|hồng|be|vàng|xanh|nâu|tím|cam|chấm bi)|size\s*[sml]|mới nhất|mới về|hàng mới)/i.test(lower) ||
      /(mẫu nào rẻ|sản phẩm nào rẻ|mẫu nào đắt|có màu.*không|mẫu nào có màu|còn size.*không|thế còn|có mẫu nào dưới|có bán.*không)/i.test(lower)
    ) {
      return 'product_search';
    }

    // 11. Broad Recommendation (broad occasions without specific garment category or price filters)
    if (
      /(gợi ý|đề xuất|tư vấn.*(cho mình|cho em)|hợp với|phù hợp|mặc đi|hot nhất|bán chạy|dự tiệc|đi cưới|công sở|dạo phố|dạ hội|nổi bật)/i.test(
        lower,
      )
    ) {
      return 'recommendation';
    }

    // Fallback general conversation
    return 'greetings';
  }
}
