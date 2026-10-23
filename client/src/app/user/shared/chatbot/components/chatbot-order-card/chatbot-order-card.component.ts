import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ChatOrderCard } from '../../models/chatbot.model';

@Component({
  selector: 'app-chatbot-order-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './chatbot-order-card.component.html',
  styleUrls: ['./chatbot-order-card.component.css'],
})
export class ChatbotOrderCardComponent {
  private router = inject(Router);

  @Input() orders: ChatOrderCard[] = [];
  @Input() order?: ChatOrderCard;
  @Output() orderClick = new EventEmitter<ChatOrderCard>();

  isExpanded = false;

  get allOrders(): ChatOrderCard[] {
    if (this.orders && this.orders.length > 0) {
      return this.orders;
    }
    return this.order ? [this.order] : [];
  }

  get displayedOrders(): ChatOrderCard[] {
    return this.isExpanded ? this.allOrders : this.allOrders.slice(0, 3);
  }

  get remainingCount(): number {
    return Math.max(0, this.allOrders.length - 3);
  }

  toggleExpand(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isExpanded = !this.isExpanded;
  }

  getStatusClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'DELIVERED') return 'status-delivered';
    if (s === 'SHIPPING') return 'status-shipping';
    if (s === 'PROCESSING' || s === 'CONFIRMED') return 'status-processing';
    if (s === 'CANCELLED' || s === 'DELIVERY_FAILED' || s === 'RETURNED') return 'status-cancelled';
    return 'status-pending';
  }

  onOrderClick(order: ChatOrderCard, event?: MouseEvent | Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.orderClick.emit(order);

    const match = (this.router.url || '').match(/^\/([a-z]{2})\b/);
    const lang = match && ['vi', 'en', 'fr'].includes(match[1]) ? match[1] : 'vi';
    this.router.navigate(['/' + lang + '/tracking'], {
      queryParams: { orderId: order.orderId },
    });
  }
}
