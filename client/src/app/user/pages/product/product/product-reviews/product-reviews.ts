import {
  Component,
  Input,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectorRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../../../services/api.service';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductReviewsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() productId: string = '';
  @Input() lang: string = 'vi';

  // ─── Product Reviews State ──────────────────────────────────────────────────
  reviewStats: any = null;
  reviewsList: any[] = [];
  reviewsTotal: number = 0;
  reviewsPage: number = 1;
  reviewsLimit: number = 5;
  reviewsTotalPages: number = 1;
  selectedStarFilter: number | null = null;
  selectedSortBy: 'newest' | 'highest' | 'lowest' | 'oldest' = 'newest';

  // ─── Loading & Error State ──────────────────────────────────────────────────
  isLoadingStats: boolean = false;
  isLoadingReviews: boolean = false;
  hasError: boolean = false;
  errorMessage: string = '';

  private statsSub: Subscription | null = null;
  private reviewsSub: Subscription | null = null;
  private currentLoadedPid: string | null = null;
  private statsRequestId: number = 0;
  private reviewsRequestId: number = 0;
  private reviewCreatedSub: Subscription | null = null;

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.productId) {
      this.currentLoadedPid = this.productId;
      this.loadProductReviews(this.productId);
    }

    if (this.apiService?.reviewCreated$) {
      this.reviewCreatedSub = this.apiService.reviewCreated$.subscribe((event) => {
        const currentPid = this.productId || this.currentLoadedPid;
        if (currentPid) {
          // Tự động tải lại và cập nhật thống kê ngay khi có review mới được tạo thành công
          this.loadProductReviews(currentPid);
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId']) {
      const prev = changes['productId'].previousValue;
      const curr = changes['productId'].currentValue;
      if (curr && curr !== prev) {
        if (!changes['productId'].isFirstChange()) {
          this.resetStateForNewProduct();
        }
        this.currentLoadedPid = curr;
        this.loadProductReviews(curr);
      }
    } else if (changes['lang'] && !changes['lang'].isFirstChange()) {
      const pid = this.productId || this.currentLoadedPid;
      if (pid) {
        this.loadProductReviews(pid);
      }
    }
  }

  ngOnDestroy(): void {
    this.cancelPendingRequests();
    if (this.reviewCreatedSub) {
      this.reviewCreatedSub.unsubscribe();
      this.reviewCreatedSub = null;
    }
  }

  // ─── Reset & Cancel ─────────────────────────────────────────────────────────
  private cancelPendingRequests(): void {
    if (this.statsSub) {
      this.statsSub.unsubscribe();
      this.statsSub = null;
    }
    if (this.reviewsSub) {
      this.reviewsSub.unsubscribe();
      this.reviewsSub = null;
    }
  }

  private resetStateForNewProduct(): void {
    this.cancelPendingRequests();
    this.statsRequestId++;
    this.reviewsRequestId++;
    this.reviewStats = null;
    this.reviewsList = [];
    this.reviewsTotal = 0;
    this.reviewsPage = 1;
    this.reviewsTotalPages = 1;
    this.selectedStarFilter = null;
    this.selectedSortBy = 'newest';
    this.hasError = false;
    this.errorMessage = '';
    this.isLoadingStats = false;
    this.isLoadingReviews = false;
  }

  // ─── Data Loading ───────────────────────────────────────────────────────────
  loadProductReviews(productId: string): void {
    if (!productId) return;
    this.hasError = false;
    this.errorMessage = '';
    this.fetchReviewStats(productId);
    this.fetchReviewsOnly(productId);
  }

  fetchReviewStats(productId: string): void {
    if (this.statsSub) {
      this.statsSub.unsubscribe();
      this.statsSub = null;
    }
    this.isLoadingStats = true;
    this.cdr.markForCheck();

    const reqId = ++this.statsRequestId;
    this.statsSub = this.apiService.getProductReviewStats(productId).subscribe({
      next: (stats) => {
        if (reqId !== this.statsRequestId) return;
        this.reviewStats = stats;
        this.isLoadingStats = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (reqId !== this.statsRequestId) return;
        this.isLoadingStats = false;
        // Nếu stats lỗi nhưng đã tải được danh sách reviews, đồng bộ fallback từ reviewsList
        if (!this.reviewStats && this.selectedStarFilter === null && this.reviewsTotal > 0) {
          this.syncFallbackStatsFromList();
        }
        this.cdr.markForCheck();
      },
    });
  }

  fetchReviewsOnly(productId: string): void {
    if (this.reviewsSub) {
      this.reviewsSub.unsubscribe();
      this.reviewsSub = null;
    }
    this.isLoadingReviews = true;
    this.hasError = false;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const reqId = ++this.reviewsRequestId;

    this.reviewsSub = this.apiService
      .getProductReviews(productId, {
        page: this.reviewsPage,
        limit: this.reviewsLimit,
        rating: this.selectedStarFilter ?? undefined,
        sortBy: this.selectedSortBy,
      })
      .subscribe({
        next: (res) => {
          if (reqId !== this.reviewsRequestId) return;
          this.reviewsList = res?.reviews || [];
          this.reviewsTotal = res?.pagination?.total ?? this.reviewsList.length;
          this.reviewsTotalPages = res?.pagination?.totalPages || 1;
          this.isLoadingReviews = false;
          this.hasError = false;

          // Nếu reviewStats chưa có hoặc chưa tải xong trong khi danh sách có đánh giá, tính fallback tạm thời
          if (!this.reviewStats && this.selectedStarFilter === null && this.reviewsTotal > 0) {
            this.syncFallbackStatsFromList();
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          if (reqId !== this.reviewsRequestId) return;
          this.reviewsList = [];
          this.isLoadingReviews = false;
          this.hasError = true;
          this.errorMessage = 'Không thể tải nhận xét do lỗi kết nối. Vui lòng thử lại sau.';
          this.cdr.markForCheck();
        },
      });
  }

  private syncFallbackStatsFromList(): void {
    if (!this.reviewStats && Array.isArray(this.reviewsList) && this.reviewsList.length > 0) {
      const distribution: { [star: number]: { count: number; percentage: number } } = {
        1: { count: 0, percentage: 0 },
        2: { count: 0, percentage: 0 },
        3: { count: 0, percentage: 0 },
        4: { count: 0, percentage: 0 },
        5: { count: 0, percentage: 0 },
      };
      let totalScore = 0;
      for (const rev of this.reviewsList) {
        const star = Math.round(Number(rev.rating));
        if (star >= 1 && star <= 5) {
          distribution[star].count++;
          totalScore += star;
        }
      }
      const count = this.reviewsTotal || this.reviewsList.length;
      for (let s = 1; s <= 5; s++) {
        distribution[s].percentage = Math.round((distribution[s].count / (count || 1)) * 100);
      }
      const avg = count > 0 ? Math.round((totalScore / this.reviewsList.length) * 10) / 10 : 5.0;
      this.reviewStats = {
        averageRating: avg,
        reviewCount: count,
        distribution,
      };
    }
  }

  // ─── Actions ────────────────────────────────────────────────────────────────
  retry(): void {
    const pid = this.productId || this.currentLoadedPid;
    if (pid) {
      this.hasError = false;
      this.errorMessage = '';
      this.loadProductReviews(pid);
    }
  }

  clearFilter(): void {
    this.selectedStarFilter = null;
    this.reviewsPage = 1;
    const pid = this.productId || this.currentLoadedPid;
    if (pid) {
      this.fetchReviewsOnly(pid);
    }
  }

  onFilterStar(star: number | null): void {
    if (this.selectedStarFilter === star) return;
    this.selectedStarFilter = star;
    this.reviewsPage = 1;
    const pid = this.productId || this.currentLoadedPid;
    if (pid) {
      this.fetchReviewsOnly(pid);
    }
  }

  onSortChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target) {
      this.selectedSortBy = target.value as any;
      this.reviewsPage = 1;
      const pid = this.productId || this.currentLoadedPid;
      if (pid) {
        this.fetchReviewsOnly(pid);
      }
    }
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.reviewsTotalPages && page !== this.reviewsPage) {
      this.reviewsPage = page;
      const pid = this.productId || this.currentLoadedPid;
      if (pid) {
        this.fetchReviewsOnly(pid);
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  get totalReviewCount(): number {
    if (this.reviewStats && typeof this.reviewStats.reviewCount === 'number' && this.reviewStats.reviewCount > 0) {
      return this.reviewStats.reviewCount;
    }
    if (this.selectedStarFilter === null && this.reviewsTotal > 0) {
      return this.reviewsTotal;
    }
    return this.reviewStats?.reviewCount || 0;
  }

  getStarCount(star: number): number {
    if (this.reviewStats?.distribution) {
      const dist = this.reviewStats.distribution[star] || this.reviewStats.distribution[String(star)];
      if (dist && typeof dist.count === 'number') {
        return dist.count;
      }
    }
    if (!this.reviewStats && this.selectedStarFilter === null && Array.isArray(this.reviewsList) && this.reviewsList.length > 0) {
      return this.reviewsList.filter((r) => Math.round(Number(r.rating)) === star).length;
    }
    return 0;
  }

  getStarPercentage(star: number): number {
    if (this.reviewStats?.distribution) {
      const dist = this.reviewStats.distribution[star] || this.reviewStats.distribution[String(star)];
      if (dist && typeof dist.percentage === 'number') {
        return dist.percentage;
      }
    }
    return 0;
  }

  getStarArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  }
}

export { ProductReviewsComponent as ProductReviews };
