import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { ReviewDraft, ReviewEligibility, ReviewPage, ReviewSaveResult, ReviewSummary } from './review.models';

export interface ReviewApiPort {
  getPage(productId: string, page?: number, pageSize?: number): Observable<ReviewPage>;
  getMine(productId: string): Observable<ReviewEligibility>;
  saveMine(productId: string, draft: ReviewDraft): Observable<ReviewSaveResult>;
}
export interface ReviewUiState {
  productId: string | null;
  userId: string | null;
  revision: number;
  page: ReviewPage | null;
  eligibility: ReviewEligibility | null;
  draft: ReviewDraft;
  loadingPage: boolean;
  loadingEligibility: boolean;
  submitting: boolean;
  error: { kind: 'page' | 'eligibility' | 'validation' | 'auth' | 'forbidden' | 'submit'; message: string } | null;
  success: string | null;
}
const initialState = (revision = 0): ReviewUiState => ({
  productId: null, userId: null, revision, page: null, eligibility: null,
  draft: { rating: 0, comment: '' }, loadingPage: false, loadingEligibility: false,
  submitting: false, error: null, success: null,
});

export class ReviewController {
  private readonly state = new BehaviorSubject<ReviewUiState>(initialState());
  private readonly summaries = new Subject<{ productId: string; summary: ReviewSummary }>();
  readonly state$ = this.state.asObservable();
  readonly summaryChanged$ = this.summaries.asObservable();
  private pageRequest?: Subscription;
  private eligibilityRequest?: Subscription;
  private saveRequest?: Subscription;
  private requestedPage = 1;
  private draftChanged = false;
  private destroyed = false;
  private pageError: ReviewUiState['error'] = null;
  private eligibilityError: ReviewUiState['error'] = null;
  private actionError: ReviewUiState['error'] = null;
  constructor(private readonly api: ReviewApiPort) {}
  setContext(productId: string | null, userId: string | null): void {
    if (this.destroyed) return;
    const previous = this.state.value;
    if (previous.productId === productId && previous.userId === userId) return;
    this.cancelReads();
    this.saveRequest?.unsubscribe();
    this.draftChanged = false;
    this.pageError = this.eligibilityError = this.actionError = null;
    this.requestedPage = 1;
    this.state.next({ ...initialState(previous.revision + 1), productId, userId });
    if (productId) this.loadPage(1);
    if (productId && userId) this.loadEligibility();
  }
  loadPage(page: number): void {
    const { productId, revision, submitting } = this.state.value;
    if (this.destroyed || !productId || submitting || !Number.isInteger(page) || page < 1) return;
    this.pageRequest?.unsubscribe();
    this.requestedPage = page;
    this.pageError = null;
    this.patch({ loadingPage: true });
    this.pageRequest = this.api.getPage(productId, page, 10).pipe(take(1)).subscribe({
      next: result => {
        if (!this.isCurrent(revision) || result.productId !== productId) return;
        this.patch({ page: result, loadingPage: false });
      },
      error: () => {
        if (!this.isCurrent(revision)) return;
        this.pageError = { kind: 'page', message: 'Không tải được đánh giá. Vui lòng thử lại.' };
        this.patch({ loadingPage: false });
      },
    });
  }
  setDraft(draft: ReviewDraft): void {
    if (this.destroyed || this.state.value.submitting) return;
    this.draftChanged = true;
    this.patch({ draft: { ...draft }, success: null,
      error: this.actionError?.kind === 'validation' ? null : this.actionError });
  }
  submit(): void {
    if (this.destroyed || this.state.value.submitting) return;
    const { productId, userId, eligibility, draft, revision } = this.state.value;
    if (!userId || this.state.value.error?.kind === 'auth') {
      this.patch({ error: { kind: 'auth', message: 'Vui lòng đăng nhập để đánh giá.' } });
      return;
    }
    if (!productId || !eligibility?.eligible) {
      this.patch({ error: { kind: 'forbidden', message: 'Bạn cần mua sản phẩm này để gửi đánh giá.' } });
      return;
    }
    const comment = typeof draft.comment === 'string' ? draft.comment.trim() : '';
    if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5 || !comment || comment.length > 1000) {
      this.patch({ error: { kind: 'validation', message: 'Chọn từ 1 đến 5 sao và nhập nội dung từ 1 đến 1000 ký tự.' } });
      return;
    }
    this.patch({ submitting: true, error: null, success: null });
    this.saveRequest = this.api.saveMine(productId, { rating: draft.rating, comment }).pipe(take(1)).subscribe({
      next: result => {
        if (!this.isCurrent(revision) || result.productId !== productId) return;
        this.cancelReads();
        this.requestedPage = 1;
        this.draftChanged = false;
        this.pageError = this.eligibilityError = null;
        const { myReview, ...page } = result;
        this.patch({ revision: revision + 1, page,
          eligibility: { productId, eligible: true, reason: 'ELIGIBLE', myReview },
          draft: { rating: myReview.rating, comment: myReview.comment },
          loadingPage: false, loadingEligibility: false, submitting: false, error: null,
          success: eligibility.myReview ? 'Đã cập nhật đánh giá.' : 'Đã gửi đánh giá.',
        });
        this.summaries.next({ productId, summary: result.summary });
      },
      error: error => {
        if (!this.isCurrent(revision)) return;
        const status = error?.status;
        const kind = status === 401 ? 'auth' : status === 403 ? 'forbidden' : status === 400 ? 'validation' : 'submit';
        this.patch({ submitting: false, success: null,
          eligibility: status === 401 ? null : status === 403
            ? { ...eligibility, eligible: false, reason: 'NOT_PURCHASED' } : this.state.value.eligibility,
          error: { kind, message: status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : status === 403 ? 'Bạn không còn đủ điều kiện đánh giá sản phẩm này.'
            : status === 400 ? 'Nội dung đánh giá không hợp lệ. Vui lòng kiểm tra lại.'
            : 'Chưa gửi được đánh giá. Bản nháp được giữ lại, vui lòng thử lại.' },
        });
      },
    });
  }
  retry(): void {
    if (this.destroyed) return;
    if (this.actionError?.kind === 'submit') { this.submit(); return; }
    const retryPage = this.pageError?.kind === 'page';
    const retryEligibility = this.eligibilityError?.kind === 'eligibility';
    if (retryPage) this.loadPage(this.requestedPage);
    if (retryEligibility) this.loadEligibility();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelReads();
    this.saveRequest?.unsubscribe();
    this.state.complete();
    this.summaries.complete();
  }
  private patch(update: Partial<ReviewUiState>): void {
    if ('error' in update) this.actionError = update.error || null;
    this.state.next({ ...this.state.value, ...update,
      error: this.actionError || this.eligibilityError || this.pageError });
  }
  private isCurrent(revision: number): boolean {
    return !this.destroyed && this.state.value.revision === revision;
  }
  private cancelReads(): void {
    this.pageRequest?.unsubscribe();
    this.eligibilityRequest?.unsubscribe();
  }
  private loadEligibility(): void {
    const { productId, userId, revision } = this.state.value;
    if (this.destroyed || !productId || !userId) return;
    this.eligibilityRequest?.unsubscribe();
    this.eligibilityError = null;
    this.patch({ loadingEligibility: true });
    this.eligibilityRequest = this.api.getMine(productId).pipe(take(1)).subscribe({
      next: result => {
        if (!this.isCurrent(revision) || result.productId !== productId) return;
        this.patch({ eligibility: result, loadingEligibility: false,
          draft: !this.draftChanged && result.myReview
            ? { rating: result.myReview.rating, comment: result.myReview.comment }
            : this.state.value.draft });
      },
      error: error => {
        if (!this.isCurrent(revision)) return;
        this.eligibilityError = {
          kind: error?.status === 401 ? 'auth' : 'eligibility',
          message: error?.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Không kiểm tra được quyền đánh giá. Vui lòng thử lại.',
        };
        this.patch({ loadingEligibility: false });
      },
    });
  }
}
