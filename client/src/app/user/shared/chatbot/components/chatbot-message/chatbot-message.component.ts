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
          text: raw.substring(lastIndex, match.index),
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
        text: raw.substring(lastIndex),
      });
    }

    return result;
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

