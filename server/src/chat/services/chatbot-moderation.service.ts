import { Injectable, Logger } from '@nestjs/common';

export interface ModerationResult {
  isHarmful: boolean;
  isComplaint: boolean;
  warningMessage?: string;
  terminateSession?: boolean;
}

@Injectable()
export class ChatbotModerationService {
  private readonly logger = new Logger(ChatbotModerationService.name);

  // Offensive patterns (profanity, harassment, hate speech)
  private readonly offensivePatterns = [
    /\b(đm|đcm|vcl|vl|đéo|mẹ mày|chó chết|lừa đảo trắng trợn)\b/i,
    /\b(fuck|bitch|asshole|scam|idiot)\b/i,
  ];

  // Customer complaint patterns (should NOT be flagged as abusive)
  private readonly complaintPatterns = [
    /\b(chê|thất vọng|chưa hài lòng|hơi đắt|giao lâu|chậm trễ|không vừa|bị rộng|bị chật|lỗi chỉ)\b/i,
    /\b(khiếu nại|phàn nàn|đổi mẫu khác|hoàn tiền)\b/i,
  ];

  /**
   * Check message content for abusive behavior vs valid complaints
   */
  checkContent(message: string): ModerationResult {
    const trimmed = (message || '').trim();

    // Check if it's a valid complaint first
    const isComplaint = this.complaintPatterns.some((pattern) => pattern.test(trimmed));

    // Check if it contains abusive language
    const isHarmful = this.offensivePatterns.some((pattern) => pattern.test(trimmed));

    if (isHarmful) {
      this.logger.warn(`Moderation flagged potential harmful content: "${trimmed.slice(0, 30)}..."`);
      return {
        isHarmful: true,
        isComplaint,
        warningMessage:
          'Dạ Chéri luôn lắng nghe và sẵn sàng hỗ trợ nàng. Tuy nhiên, Chéri mong nàng cùng giữ ngôn từ văn minh và lịch sự để trải nghiệm tư vấn được trọn vẹn nhất ạ.',
        terminateSession: false,
      };
    }

    return {
      isHarmful: false,
      isComplaint,
    };
  }

  // TODO: Add AI-based semantic toxicity check via Gemini Moderation API when scaling
}
