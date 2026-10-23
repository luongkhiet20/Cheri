import { Injectable } from '@nestjs/common';
import { ChatbotIntent } from '../interfaces/chatbot-response.interface';

@Injectable()
export class ChatbotIntentService {
  /**
   * Classify user message into standardized intents
   */
  classifyIntent(message: string): ChatbotIntent {
    const lower = (message || '').toLowerCase().trim();

    // 1. Prompt injection / secret sniffing / unrelated
    if (
      /(bỏ qua mọi quy định|ignore (?:all )?instructions|print (?:gemini|api|key)|in (?:gemini|api|key)|mật khẩu|token của hệ thống)/i.test(
        lower,
      )
    ) {
      return 'unrelated';
    }

    // 2. Greetings
    if (
      /^(chào|chào shop|chào chéri|alo|hi|hello|hey|chào bạn|chào em|shop ơi|chéri ơi|xin chào)\b/i.test(
        lower,
      ) &&
      lower.length < 35
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

    // 5. Size Consultation & Measurement Guidance
    if (
      /(hướng dẫn.*(?:chọn size|cỡ|bảng size)|cách chọn size|tư vấn.*(?:size|cỡ)|chọn size|bảng size|size chuẩn|chuẩn size|mặc size gì|size nào|vừa size nào|vừa size gì|mặc vừa không)/i.test(
        lower,
      ) ||
      /(?:cao\s*\d|nặng\s*\d|1m\d{2}|\b\d{2}\s*kg\b|vòng\s*(?:eo|ngực|mông|1|2|3)|số đo|thích mặc\s*(?:ôm|rộng|vừa|thoải mái)|mặc hơi (?:rộng|ôm|vừa)|size\s*[a-z0-9]+\s*(?:và|với|hay)\s*size\s*[a-z0-9]+|khác nhau thế nào.*size|size.*khác nhau)/i.test(
        lower,
      ) ||
      /(?:mẫu này|đầm này|váy này|cái này).*(?:có|còn)\s+size/i.test(
        lower,
      ) ||
      /(?:có|còn)\s+size\s+[a-z0-9]+\s+(?:không|ko|hết|chứ)/i.test(
        lower,
      )
    ) {
      return 'size_consultation';
    }

    // 6. Comparison
    if (
      /(so sánh|khác nhau (?:thế nào|gì|ở điểm nào)|nên chọn.*hay|mẫu nào (?:rẻ|đẹp|tốt) hơn|giữa .* và |phân vân giữa)/i.test(
        lower,
      )
    ) {
      return 'product_compare';
    }

    // 7. Follow-up / Product Detail inquiry
    if (
      /(mẫu thứ (?:1|2|3|4|hai|ba)|cái thứ (?:1|2|3|4)|mẫu này|cái này|chất liệu gì|làm bằng vải gì|còn màu khác không|có màu khác không)/i.test(
        lower,
      )
    ) {
      return 'product_detail';
    }

    // 8. Store policies & brand FAQ
    if (
      /(chính sách|bảo hành|hoàn tiền|phí ship|giao hàng|thời gian giao|thanh toán|chéri là gì|giới thiệu shop|địa chỉ|cửa hàng|bao lâu nhận được)/i.test(
        lower,
      )
    ) {
      return 'policy_faq';
    }

    // 7. Customer complaint / handoff
    if (
      /(khiếu nại|phàn nàn|thất vọng|chất lượng kém|giao hàng chậm trễ|hỏng chỉ|bị rách|gặp nhân viên|gặp tư vấn viên|chuyển máy)/i.test(
        lower,
      )
    ) {
      return 'complaint';
    }

    // 8. Recommendation (broad occasions, advice)
    if (
      /(gợi ý|đề xuất|tư vấn.*(cho mình|cho em)|hợp với|phù hợp|mặc đi|mới nhất|hot nhất|bán chạy|dự tiệc|đi cưới|công sở|dạo phố|dạ hội|nổi bật)/i.test(
        lower,
      )
    ) {
      return 'recommendation';
    }

    // 9. Specific Product Search (with price, color, size, garment type)
    if (
      /(đầm|váy|áo|quần|set đồ|chân váy|màu|giá|bao nhiêu|còn hàng|size|sản phẩm|tìm|xem mẫu|mẫu)/i.test(
        lower,
      )
    ) {
      return 'product_search';
    }

    // Fallback general conversation
    return 'greetings';
  }
}
