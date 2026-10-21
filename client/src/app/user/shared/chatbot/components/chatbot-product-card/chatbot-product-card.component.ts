import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ChatProductCard } from '../../models/chatbot.model';

@Component({
  selector: 'app-chatbot-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './chatbot-product-card.component.html',
  styleUrls: ['./chatbot-product-card.component.css'],
})
export class ChatbotProductCardComponent {
  private router = inject(Router);

  @Input() products: ChatProductCard[] = [];
  @Input() product?: ChatProductCard;
  @Output() cardClick = new EventEmitter<ChatProductCard>();

  isExpanded = false;

  get allProducts(): ChatProductCard[] {
    if (this.products && this.products.length > 0) {
      return this.products;
    }
    return this.product ? [this.product] : [];
  }

  get displayedProducts(): ChatProductCard[] {
    return this.isExpanded ? this.allProducts : this.allProducts.slice(0, 3);
  }

  get remainingCount(): number {
    return Math.max(0, this.allProducts.length - 3);
  }

  toggleExpand(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isExpanded = !this.isExpanded;
  }

  onCardClick(p: ChatProductCard, event?: MouseEvent | Event): void {
    if (event) {
      event.stopPropagation();
    }

    this.cardClick.emit(p);

    if (!p?.titleUrl) {
      console.error('Product titleUrl is missing:', p);
      return;
    }

    this.router.navigate(['/product', p.titleUrl]);
  }
}


