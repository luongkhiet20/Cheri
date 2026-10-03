import { Component, ChangeDetectionStrategy, Input, computed, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WishlistService } from '../../../services/wishlist.service';

@Component({
  selector: 'app-wishlist-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wishlist-button.component.html',
  styleUrls: ['./wishlist-button.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WishlistButtonComponent {
  @Input({ required: true }) product: any;
  @Input() lang = 'vi';

  readonly isActive = computed(() => {
    const id = this.product?._id || this.product?.id;
    return !!id && this.wishlistService.isInWishlist(id);
  });

  constructor(
    private wishlistService: WishlistService,
    private cdr: ChangeDetectorRef
  ) {
    // React to changes in wishlistIds signal across any component or window
    effect(() => {
      this.isActive();
      this.cdr.markForCheck();
    });
  }

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.wishlistService.toggleWishlist(this.product, this.lang);
    this.cdr.markForCheck();
  }
}
