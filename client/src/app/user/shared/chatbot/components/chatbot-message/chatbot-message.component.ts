import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChatMessage, ChatProductCard, ChatOrderCard } from '../../models/chatbot.model';
import { ChatbotProductCardComponent } from '../chatbot-product-card/chatbot-product-card.component';
import { ChatbotOrderCardComponent } from '../chatbot-order-card/chatbot-order-card.component';

export interface MessageSegment {
  isLink: boolean;
  text: string;
  url?: string;
}

@Component({
  selector: 'app-chatbot-message',
  standalone: true,
  imports: [CommonModule, RouterModule, ChatbotProductCardComponent, ChatbotOrderCardComponent],
  templateUrl: './chatbot-message.component.html',
  styleUrls: ['./chatbot-message.component.css'],
})
export class ChatbotMessageComponent {
  @Input({ required: true }) message!: ChatMessage;
  @Output() retry = new EventEmitter<ChatMessage>();
  @Output() authAction = new EventEmitter<void>();
  @Output() productClick = new EventEmitter<ChatProductCard>();
  @Output() orderClick = new EventEmitter<ChatOrderCard>();

  get isSystemMessage(): boolean {
    return this.message?.sender === 'system' || this.message?.senderType === 'SYSTEM';
  }

  getSystemIconType(): 'clock' | 'headset' | 'exit' {
    const event = this.message?.systemEvent;
    if (event === 'SUPPORT_REQUESTED') return 'clock';
    if (event === 'ADMIN_JOINED') return 'headset';
    if (event === 'ADMIN_LEFT') return 'exit';

    const txt = (this.message?.text || '').toLowerCase();
    if (txt.includes('kết nối') || txt.includes('chờ')) return 'clock';
    if (txt.includes('tham gia') || txt.includes('sẵn sàng')) return 'headset';
    if (txt.includes('rời') || txt.includes('kết thúc')) return 'exit';
    return 'clock';
  }

  get segments(): MessageSegment[] {
    const raw = this.message?.text || '';
    if (!raw) return [];

    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const result: MessageSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mdLinkRegex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          isLink: false,
          text: this.cleanMarkdownText(raw.substring(lastIndex, match.index)),
        });
      }
      result.push({
        isLink: true,
        text: match[1],
        url: match[2],
      });
      lastIndex = mdLinkRegex.lastIndex;
    }

    if (lastIndex < raw.length) {
      result.push({
        isLink: false,
        text: this.cleanMarkdownText(raw.substring(lastIndex)),
      });
    }

    return result;
  }

  /**
   * Sanitizes Markdown formatting characters (**, ***, #, *) from plain text segments
   * while preserving bullet points and newlines.
   */
  private cleanMarkdownText(str: string): string {
    if (!str) return '';
    return str
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[\*\-]\s+/gm, '• ');
  }

  onRetry(): void {
    this.retry.emit(this.message);
  }

  onAuth(): void {
    this.authAction.emit();
  }

  onProductClick(p: ChatProductCard): void {
    this.productClick.emit(p);
  }

  onOrderClick(o: ChatOrderCard): void {
    this.orderClick.emit(o);
  }
}

