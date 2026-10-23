const test = require('node:test');
const assert = require('node:assert/strict');
const { of, throwError } = require('rxjs');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
  experimentalDecorators: true,
  target: 'ES2022',
});
require('ts-node/register/transpile-only');
require('@angular/compiler');

const { ProductReviewsComponent } = require('./product-reviews.ts');

function createComponent(mockApi = {}) {
  const defaultApi = {
    getProductReviewStats: (id) => of({
      averageRating: 4.8,
      reviewCount: 12,
      distribution: { 5: { count: 10, percentage: 83 }, 4: { count: 2, percentage: 17 } }
    }),
    getProductReviews: (id, params) => of({
      reviews: [
        { _id: 'rev1', userName: 'Thu Trang', rating: 5, comment: 'Sản phẩm rất đẹp', createdAt: '2026-10-15T10:00:00Z' }
      ],
      pagination: { total: 1, totalPages: 1, page: 1, limit: 5 }
    }),
    ...mockApi
  };

  const cdr = { markForCheck: () => {} };
  const comp = new ProductReviewsComponent(defaultApi, cdr);
  return comp;
}

test('ProductReviewsComponent initializes and loads reviews when productId is set', () => {
  const comp = createComponent();
  comp.productId = 'prod-123';
  comp.ngOnInit();

  assert.equal(comp.isLoadingReviews, false);
  assert.equal(comp.hasError, false);
  assert.equal(comp.reviewStats.averageRating, 4.8);
  assert.equal(comp.reviewStats.reviewCount, 12);
  assert.equal(comp.reviewsList.length, 1);
  assert.equal(comp.reviewsList[0].userName, 'Thu Trang');
});

test('handles API error with hasError flag and error message, not converting to normal empty', () => {
  const comp = createComponent({
    getProductReviews: () => throwError(() => new Error('Network error'))
  });

  comp.productId = 'prod-error';
  comp.ngOnInit();

  assert.equal(comp.isLoadingReviews, false);
  assert.equal(comp.hasError, true);
  assert.equal(comp.reviewsList.length, 0);
  assert.match(comp.errorMessage, /lỗi kết nối/i);
});

test('retry() clears error state and re-fetches reviews', () => {
  let callCount = 0;
  const comp = createComponent({
    getProductReviews: () => {
      callCount++;
      if (callCount === 1) {
        return throwError(() => new Error('First failure'));
      }
      return of({
        reviews: [{ _id: 'r1', userName: 'An', rating: 5, comment: 'Tốt' }],
        pagination: { total: 1, totalPages: 1 }
      });
    }
  });

  comp.productId = 'prod-retry';
  comp.ngOnInit();

  assert.equal(comp.hasError, true);
  assert.equal(comp.reviewsList.length, 0);

  comp.retry();

  assert.equal(comp.hasError, false);
  assert.equal(comp.reviewsList.length, 1);
  assert.equal(comp.reviewsList[0].userName, 'An');
});

test('onFilterStar sets star filter, resets page, and queries with rating', () => {
  let queriedRating = null;
  const comp = createComponent({
    getProductReviews: (id, params) => {
      queriedRating = params.rating;
      return of({ reviews: [], pagination: { total: 0, totalPages: 1 } });
    }
  });

  comp.productId = 'prod-123';
  comp.ngOnInit();

  comp.onFilterStar(5);
  assert.equal(comp.selectedStarFilter, 5);
  assert.equal(comp.reviewsPage, 1);
  assert.equal(queriedRating, 5);

  comp.onFilterStar(null);
  assert.equal(comp.selectedStarFilter, null);
  assert.equal(queriedRating, undefined);
});

test('clearFilter() resets selectedStarFilter to null and re-queries reviews', () => {
  let queriedRating = 'init';
  const comp = createComponent({
    getProductReviews: (id, params) => {
      queriedRating = params.rating;
      return of({ reviews: [], pagination: { total: 0, totalPages: 1 } });
    }
  });

  comp.productId = 'prod-123';
  comp.ngOnInit();
  comp.onFilterStar(3);
  assert.equal(comp.selectedStarFilter, 3);
  assert.equal(queriedRating, 3);

  comp.clearFilter();
  assert.equal(comp.selectedStarFilter, null);
  assert.equal(queriedRating, undefined);
});

test('onSortChange updates sorting and refreshes reviews', () => {
  let queriedSort = null;
  const comp = createComponent({
    getProductReviews: (id, params) => {
      queriedSort = params.sortBy;
      return of({ reviews: [], pagination: { total: 0, totalPages: 1 } });
    }
  });

  comp.productId = 'prod-123';
  comp.ngOnInit();

  comp.onSortChange({ target: { value: 'highest' } });
  assert.equal(comp.selectedSortBy, 'highest');
  assert.equal(queriedSort, 'highest');
});

test('onPageChange changes page when valid', () => {
  let queriedPage = null;
  const comp = createComponent({
    getProductReviews: (id, params) => {
      queriedPage = params.page;
      return of({ reviews: [], pagination: { total: 15, totalPages: 3 } });
    }
  });

  comp.productId = 'prod-123';
  comp.ngOnInit();
  comp.reviewsTotalPages = 3;

  comp.onPageChange(2);
  assert.equal(comp.reviewsPage, 2);
  assert.equal(queriedPage, 2);

  // Should ignore page out of range
  comp.onPageChange(5);
  assert.equal(comp.reviewsPage, 2);
});

test('ngOnChanges resets filter, pagination, error, and reloads data when productId changes', () => {
  let loadedIds = [];
  const comp = createComponent({
    getProductReviewStats: (id) => {
      loadedIds.push(id);
      return of({ averageRating: 5, reviewCount: 1 });
    }
  });

  comp.productId = 'prod-1';
  comp.ngOnInit();
  comp.selectedStarFilter = 4;
  comp.reviewsPage = 3;
  comp.hasError = true;

  comp.productId = 'prod-2';
  comp.ngOnChanges({
    productId: {
      previousValue: 'prod-1',
      currentValue: 'prod-2',
      firstChange: false,
      isFirstChange: () => false
    }
  });

  assert.deepEqual(loadedIds, ['prod-1', 'prod-2']);
  assert.equal(comp.selectedStarFilter, null);
  assert.equal(comp.reviewsPage, 1);
  assert.equal(comp.hasError, false);
});

test('getStarCount and getStarPercentage handle populated and null stats safely', () => {
  const comp = createComponent();
  comp.reviewStats = {
    distribution: {
      5: { count: 10, percentage: 80 },
      4: { count: 2, percentage: 20 }
    }
  };

  assert.equal(comp.getStarCount(5), 10);
  assert.equal(comp.getStarPercentage(5), 80);
  assert.equal(comp.getStarCount(1), 0);
  assert.equal(comp.getStarPercentage(1), 0);

  comp.reviewStats = null;
  assert.equal(comp.getStarCount(5), 0);
  assert.equal(comp.getStarPercentage(5), 0);
});

test('formatDate formats ISO string to DD/MM/YYYY', () => {
  const comp = createComponent();
  assert.equal(comp.formatDate('2026-10-15T08:30:00Z'), '15/10/2026');
  assert.equal(comp.formatDate(''), '');
  assert.equal(comp.formatDate('invalid-date'), '');
});

test('async getProductReviewStats is NOT dropped when fetchReviewsOnly starts concurrently', async () => {
  const { Subject } = require('rxjs');
  const statsSubject = new Subject();
  const reviewsSubject = new Subject();

  const comp = createComponent({
    getProductReviewStats: () => statsSubject.asObservable(),
    getProductReviews: () => reviewsSubject.asObservable(),
  });

  comp.productId = 'async-prod-1';
  comp.ngOnInit();

  // At this point, both calls were dispatched concurrently
  assert.equal(comp.isLoadingStats, true);
  assert.equal(comp.isLoadingReviews, true);

  // Reviews finish first
  reviewsSubject.next({
    reviews: [{ _id: 'r1', rating: 5, comment: 'Đẹp' }],
    pagination: { total: 1, totalPages: 1 }
  });
  reviewsSubject.complete();

  // Then stats finish later
  statsSubject.next({
    averageRating: 5.0,
    reviewCount: 1,
    distribution: {
      '5': { count: 1, percentage: 100 },
      '4': { count: 0, percentage: 0 },
      '3': { count: 0, percentage: 0 },
      '2': { count: 0, percentage: 0 },
      '1': { count: 0, percentage: 0 }
    }
  });
  statsSubject.complete();

  // Stats MUST NOT be dropped!
  assert.notEqual(comp.reviewStats, null);
  assert.equal(comp.totalReviewCount, 1);
  assert.equal(comp.getStarCount(5), 1);
  assert.equal(comp.getStarCount(4), 0);
  assert.equal(comp.getStarPercentage(5), 100);
});

test('reviewCreated$ triggers reload and updates review counts', () => {
  const { Subject } = require('rxjs');
  const reviewCreatedSubject = new Subject();
  let loadCount = 0;

  const comp = createComponent({
    reviewCreated$: reviewCreatedSubject.asObservable(),
    getProductReviewStats: () => {
      loadCount++;
      return of({
        averageRating: 5,
        reviewCount: loadCount,
        distribution: { 5: { count: loadCount, percentage: 100 } }
      });
    }
  });

  comp.productId = 'created-prod';
  comp.ngOnInit();
  assert.equal(comp.totalReviewCount, 1);

  // New review is created
  reviewCreatedSubject.next({ productId: 'created-prod' });
  assert.equal(comp.totalReviewCount, 2);
  assert.equal(comp.getStarCount(5), 2);
});

test('onAvatarError marks avatarLoadFailed to true and triggers change detection', () => {
  let marked = false;
  const comp = createComponent();
  comp.cdr = { markForCheck: () => { marked = true; } };
  const mockReview = { _id: 'r1', userAvatar: 'https://bad-url.com/avatar.jpg', userName: 'Linh' };
  comp.onAvatarError(mockReview);

  assert.equal(mockReview.avatarLoadFailed, true);
  assert.equal(marked, true);
});

