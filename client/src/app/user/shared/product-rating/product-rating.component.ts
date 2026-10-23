import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ProductRatingService } from './product-rating.service';
import { ProductRatingSummary } from './product-rating.models';

@Component({
  selector: 'app-product-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-rating.component.html',
  styleUrls: ['./product-rating.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductRatingComponent implements OnChanges, OnDestroy {
  @Input() productId?: string | null;

  hasRating = false;
  displayScore = '0.0';
  isLoading = false;
  ariaLabel = 'Chưa có đánh giá';

  private fetchSub?: Subscription;

  constructor(
    private readonly ratingService: ProductRatingService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId']) {
      this.loadRating();
    }
  }

  ngOnDestroy(): void {
    this.cancelFetch();
  }

  private loadRating(): void {
    this.cancelFetch();

    const cleanId = this.productId?.trim();
    if (!cleanId) {
      this.hasRating = false;
      this.displayScore = '0.0';
      this.isLoading = false;
      this.ariaLabel = 'Chưa có đánh giá';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    this.fetchSub = this.ratingService.getRatingSummary(cleanId).subscribe({
      next: (summary: ProductRatingSummary) => {
        this.isLoading = false;
        if (
          summary &&
          typeof summary.averageRating === 'number' &&
          !isNaN(summary.averageRating)
        ) {
          this.hasRating = true;
          // Làm tròn 1 chữ số thập phân, ví dụ 4.666 -> 4.7, 5 -> 5.0
          const rounded = Math.round(summary.averageRating * 10) / 10;
          this.displayScore = rounded.toFixed(1);
          this.ariaLabel = summary.reviewCount > 0
            ? `Đánh giá: ${this.displayScore} trên 5 sao (${summary.reviewCount} đánh giá)`
            : `Điểm tiêu chuẩn: ${this.displayScore} trên 5 sao`;
        } else {
          this.hasRating = false;
          this.displayScore = '0.0';
          this.ariaLabel = 'Chưa có thông tin đánh giá';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Trong trường hợp lỗi API, giữ giao diện trung tính, không hiển thị số giả
        this.isLoading = false;
        this.hasRating = false;
        this.displayScore = '0.0';
        this.ariaLabel = 'Chưa có đánh giá';
        this.cdr.markForCheck();
      },
    });
  }

  private cancelFetch(): void {
    if (this.fetchSub) {
      this.fetchSub.unsubscribe();
      this.fetchSub = undefined;
    }
  }
}
