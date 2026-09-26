import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, input, computed } from '@angular/core';

import { Product, Category } from '../../models';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { RouterLink } from '@angular/router';
import { PriceFormatPipe } from '../../../../pipes/price.pipe';

import { MatChipsModule } from '@angular/material/chips';
import { CartShowComponent } from '../cart-show/cart-show.component';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-product-content',
  templateUrl: './product-content.component.html',
  styleUrls: ['./product-content.component.css'],
  imports: [CommonModule, TranslatePipe, RouterLink, PriceFormatPipe, MatChipsModule, CartShowComponent, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductContentComponent {
  categoriesInput = input<Category[]>();
  categoriesToShow = computed(() => (this.categoriesInput() || []).reduce((prev, cat) => ({ ...prev, [cat.titleUrl]: cat.title }), {}));
  @Input() product: Product;
  @Input() cartIds: { [productId: string]: number };
  @Input() currency: string;
  @Input() lang: string;
  @Input() withLink = false;

  @Output() addProduct = new EventEmitter<string>();
  @Output() removeProduct = new EventEmitter<string>();


  constructor() { }

  isOutOfStock(): boolean {
    if (!this.product) return false;
    const q = this.product.quantity;
    if (q !== undefined && q !== null && Number(q) <= 0) return true;
    const s = this.product.stock;
    return s === '0' || s === 'out' || s === 'outOfStock' || s === 'unavailable';
  }

  onAddProduct(id: string): void {
    if (this.isOutOfStock()) return;
    this.addProduct.emit(id);
  }

  onRemoveProduct(id: string): void {
    this.removeProduct.emit(id);
  }

  trackById(_index: number, item: Product) {
    return item._id;
  }
}
