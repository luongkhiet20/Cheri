import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHERI_BRAND_PERSONA } from '../prompts/chatbot-system.prompt';

@Injectable()
export class ChatbotAiService {
  private readonly logger = new Logger(ChatbotAiService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Call Google Gemini API with timeout, sandboxing, conversation history and error fallback
   */
  async generateResponse(
    userQuery: string,
    verifiedContext: string,
    systemInstruction = CHERI_BRAND_PERSONA,
    conversationHistory?: any[],
  ): Promise<string> {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    const model =
      this.configService.get<string>('GEMINI_MODEL') ||
      process.env.GEMINI_MODEL ||
      'gemini-3.5-flash-lite';

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not configured in environment. Using deterministic fallback.');
      return '';
    }

    // Format recent conversation history (up to last 6 turns)
    let historyContext = '';
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      const recent = conversationHistory.slice(-6);
      historyContext = recent
        .map((m) => {
          const roleName = m.role === 'user' || m.sender === 'user' ? 'Khách' : 'Chéri';
          const content = (m.content || m.text || '').trim();
          return `${roleName}: ${content}`;
        })
        .join('\n');
    }

    // Sandboxed prompt structure
    const sandboxedPrompt = `
[THÔNG TIN DỮ LIỆU XÁC MINH TỪ HỆ THỐNG - CHỈ ĐỌC, TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÊM THÔNG SỐ]:
${verifiedContext || 'Không có dữ liệu bổ sung'}

${historyContext ? `[LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ - CẦN DUY TRÌ NGỮ CẢNH LIÊN TỤC]:\n${historyContext}\n` : ''}
[CÂU HỎI HIỆN TẠI CỦA KHÁCH HÀNG - CẦN TRẢ LỜI NGAY]:
${userQuery}

[HƯỚNG DẪN TRẢ LỜI QUAN TRỌNG]:
- Trả lời trực tiếp vào trọng tâm câu hỏi hiện tại, ưu tiên câu ngắn gọn (1-3 câu), tự nhiên như nhân viên tư vấn thời trang.
- Không tự động thêm lời chào vào mỗi tin nhắn.
- TUYỆT ĐỐI KHÔNG DÙNG KÝ TỰ ĐỊNH DẠNG MARKDOWN: Không dùng **, ***, #, ### để in đậm hay đặt tiêu đề; không dùng * để tạo danh sách. Trả lời bằng văn bản thuần (plain text). Khi cần liệt kê, dùng ký tự "•" và xuống dòng.
- Chỉ sử dụng emoji khi phù hợp, tối đa 1 emoji cho toàn bộ câu trả lời.
- Không lặp lại những thông tin đã giải thích ở các tin nhắn trước.
- Không dùng từ ngữ sáo rỗng: "chiếc đầm hoàn hảo nhất", "tôn dáng nhất", "mông nở nang nhất", "thước dây chỉ nên chạm sát da", "đo nhẹ nhàng qua đỉnh ngực".
- Nếu khách gửi tin nhắn ngắn liên quan đến size (như "60kg", "1m60", "size L được không?"), hiểu ngay là câu hỏi tiếp nối ngữ cảnh trước đó.
- KHÔNG BAO GIỜ bịa đặt giá cả, số lượng tồn kho, ngày giao hàng, hoặc mã giảm giá.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: sandboxedPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 350,
      },
    };

    // Timeout protection with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000); // 9 seconds timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`Gemini API HTTP Error (${response.status}): ${errorText.slice(0, 150)}`);
        return '';
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return this.sanitizeAiOutput(rawText.trim());
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        this.logger.warn('Gemini API call timed out after 9000ms. Returning fallback.');
      } else {
        this.logger.warn(`Failed to invoke Gemini API: ${err.message}. Returning fallback.`);
      }
      return '';
    }
  }

  /**
   * Sanitize AI output to prevent secret leaks, invalid links, raw markdown formatting, or excess emojis
   */
  public sanitizeAiOutput(text: string): string {
    if (!text) return '';

    let cleaned = text
      // Strip any accidental API key or token pattern
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED]')
      .replace(/AQ\.[0-9A-Za-z-_]{40,}/g, '[REDACTED]')
      // Strip raw HTML tags
      .replace(/<[^>]*>?/gm, '');

    // Strip Markdown bold and italics (**text**, ***text***, *text*) while preserving plain text
    cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
    cleaned = cleaned.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');

    // Strip Markdown headings (#, ##, ###) at start of lines
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // Convert asterisk or dash list markers to bullet dot "• "
    cleaned = cleaned.replace(/^\s*[\*\-]\s+/gm, '• ');

    // Enforce at most 1 emoji across the reply
    cleaned = this.limitEmojisToOne(cleaned);

    return cleaned.trim();
  }

  /**
   * Limit emojis in text to at most 1 emoji (retains the last or first emoji)
   */
  private limitEmojisToOne(text: string): string {
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    const matches = Array.from(text.matchAll(emojiRegex));
    if (matches.length <= 1) {
      return text;
    }

    // Keep the last emoji, remove all preceding emojis
    const lastMatch = matches[matches.length - 1];
    let result = '';
    let lastIndex = 0;

    for (let i = 0; i < matches.length - 1; i++) {
      const m = matches[i];
      const matchIndex = m.index ?? 0;
      result += text.substring(lastIndex, matchIndex);
      lastIndex = matchIndex + m[0].length;
    }

    result += text.substring(lastIndex);
    // Clean any double spaces left behind by stripped emojis
    return result.replace(/  +/g, ' ');
  }
}
