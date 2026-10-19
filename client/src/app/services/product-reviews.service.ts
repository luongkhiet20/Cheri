import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ReviewDraft, ReviewEligibility, ReviewPage, ReviewSaveResult } from '../user/shared/reviews/review.models';
import { ReviewApiPort } from '../user/shared/reviews/review-controller';

@Injectable({ providedIn: 'root' })
export class ProductReviewsApi implements ReviewApiPort {
  constructor(private readonly http: HttpClient, private readonly storefront: ApiService) {}
  getPage(productId: string, page = 1, pageSize = 10): Observable<ReviewPage> {
    return this.http.get<ReviewPage>(`${this.url(productId)}?page=${page}&pageSize=${pageSize}`, this.storefront.getRequestOptions());
  }
  getMine(productId: string): Observable<ReviewEligibility> {
    return this.http.get<ReviewEligibility>(`${this.url(productId)}/me`, this.storefront.getRequestOptions());
  }
  saveMine(productId: string, draft: ReviewDraft): Observable<ReviewSaveResult> {
    return this.http.put<ReviewSaveResult>(`${this.url(productId)}/me`, {
      rating: draft.rating, comment: draft.comment,
    }, this.storefront.getRequestOptions());
  }
  private url(productId: string): string {
    return `${this.storefront.apiUrl}/api/products/${encodeURIComponent(productId)}/reviews`;
  }
}
