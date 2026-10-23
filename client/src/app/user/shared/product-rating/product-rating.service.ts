import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, ReplaySubject, of, Subscription } from 'rxjs';
import { bufferTime, filter, catchError } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { ProductRatingSummary } from './product-rating.models';

interface CacheEntry {
  summary: ProductRatingSummary;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductRatingService implements OnDestroy {
  // Cache điểm đánh giá trong bộ nhớ RAM, TTL 5 phút
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // Quản lý các request đang chờ xử lý theo từng productId để tránh gọi trùng lặp
  private readonly pendingRequests = new Map<string, ReplaySubject<ProductRatingSummary>>();

  // Hàng đợi gom các yêu cầu theo lô (batching) trong micro-window 20ms
  private readonly batchQueue$ = new Subject<string>();
  private readonly subscriptions = new Subscription();

  constructor(private readonly apiService: ApiService) {
    this.initBatchProcessor();
    this.initReviewSyncListener();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.pendingRequests.clear();
    this.cache.clear();
  }

  /**
   * Lấy tóm tắt điểm đánh giá của một sản phẩm.
   * Tự động cache, khử trùng lặp và gom nhóm batch nếu nhiều component cùng yêu cầu.
   */
  getRatingSummary(productId: string): Observable<ProductRatingSummary> {
    if (!productId || typeof productId !== 'string' || !productId.trim()) {
      return of({ productId: '', averageRating: null, reviewCount: 0 });
    }

    const cleanId = productId.trim();

    // 1. Kiểm tra cache còn hạn
    const cached = this.cache.get(cleanId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return of(cached.summary);
    }

    // 2. Nếu đã có một request đang xử lý cho ID này, dùng chung Observable
    if (this.pendingRequests.has(cleanId)) {
      return this.pendingRequests.get(cleanId)!.asObservable();
    }

    // 3. Tạo ReplaySubject chờ kết quả và đưa ID vào hàng đợi gom lô
    const subject = new ReplaySubject<ProductRatingSummary>(1);
    this.pendingRequests.set(cleanId, subject);
    this.batchQueue$.next(cleanId);

    return subject.asObservable();
  }

  /**
   * Xóa cache của một sản phẩm (hoặc toàn bộ) khi có đánh giá mới
   */
  invalidateCache(productId?: string): void {
    if (productId) {
      this.cache.delete(productId.trim());
    } else {
      this.cache.clear();
    }
  }

  /**
   * Bộ gom request (batching processor)
   * Tập hợp tất cả các productId được yêu cầu trong 20ms thành một request duy nhất
   */
  private initBatchProcessor(): void {
    const batchSub = this.batchQueue$
      .pipe(
        bufferTime(20),
        filter((ids) => ids.length > 0)
      )
      .subscribe((ids) => {
        const uniqueIds = Array.from(new Set(ids));
        this.fetchBatch(uniqueIds);
      });

    this.subscriptions.add(batchSub);
  }

  /**
   * Thực hiện gọi API batch tới backend
   */
  private fetchBatch(productIds: string[]): void {
    this.apiService
      .getBatchProductRatingSummary(productIds)
      .pipe(
        catchError(() => {
          // Khi API gặp lỗi, trả về mảng rỗng để fallback về trạng thái không có đánh giá
          return of([]);
        })
      )
      .subscribe({
        next: (responseList: any) => {
          const list: ProductRatingSummary[] = Array.isArray(responseList)
            ? responseList
            : responseList?.data && Array.isArray(responseList.data)
            ? responseList.data
            : [];

          const resultMap = new Map<string, ProductRatingSummary>();
          for (const item of list) {
            if (item && item.productId) {
              resultMap.set(item.productId.toString(), item);
            }
          }

          // Phân phối kết quả cho từng productId trong batch
          for (const id of productIds) {
            const summary: ProductRatingSummary = resultMap.get(id) || {
              productId: id,
              averageRating: null,
              reviewCount: 0,
            };

            // Lưu cache
            this.cache.set(id, {
              summary,
              timestamp: Date.now(),
            });

            // Gửi dữ liệu tới các Subscriber đang chờ
            const pending = this.pendingRequests.get(id);
            if (pending) {
              pending.next(summary);
              pending.complete();
              this.pendingRequests.delete(id);
            }
          }
        },
        error: () => {
          // Xử lý an toàn phòng trường hợp ngoại lệ
          for (const id of productIds) {
            const fallback: ProductRatingSummary = {
              productId: id,
              averageRating: null,
              reviewCount: 0,
            };
            const pending = this.pendingRequests.get(id);
            if (pending) {
              pending.next(fallback);
              pending.complete();
              this.pendingRequests.delete(id);
            }
          }
        },
      });
  }

  /**
   * Lắng nghe sự kiện thêm/sửa review từ ApiService để tự động xóa cache liên quan
   */
  private initReviewSyncListener(): void {
    const syncSub = this.apiService.reviewCreated$.subscribe({
      next: (payload) => {
        if (payload?.productId) {
          this.invalidateCache(payload.productId);
        }
      },
    });
    this.subscriptions.add(syncSub);
  }
}
