import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, EventEmitter, Inject, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, ViewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';
import { defer, Observable, Subscription } from 'rxjs';
import { ProductReviewsApi } from '../../../services/product-reviews.service';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { SignalStore } from '../../../store/signal.store';
import { ReviewController, ReviewUiState } from './review-controller';
import { ReviewSummary } from './review.models';
import { accessTokenKey } from '../constants';

interface ReviewAuthSession {
  user: object | null;
  userId: string | null;
  credential: string | null;
}

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-reviews.component.html',
  styleUrls: ['./product-reviews.component.css'],
})
export class ProductReviewsComponent implements OnChanges, OnDestroy {
  @Input() productId: string = '';
  @Input() lang: string = 'vi';
  @Output() summaryChanged = new EventEmitter<{ productId: string; summary: ReviewSummary }>();
  @ViewChild('reviewsHeading') private heading?: ElementRef<HTMLElement>;
  readonly ratings = [1, 2, 3, 4, 5];
  readonly form = new FormGroup({
    rating: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(5)] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000)] }),
  });
  readonly controller: ReviewController;
  state!: ReviewUiState;
  private readonly subscriptions = new Subscription();
  private rejectedSession: ReviewAuthSession | null = null;
  private signingOut = false;
  private destroyed = false;

  constructor(api: ProductReviewsApi, private readonly selectors: SignalStoreSelectors,
    private readonly router: Router, @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly store: SignalStore) {
    this.controller = new ReviewController({
      getPage: (productId, page, pageSize) => api.getPage(productId, page, pageSize),
      getMine: productId => this.withAuthSession(() => api.getMine(productId)),
      saveMine: (productId, draft) => this.withAuthSession(() => api.saveMine(productId, draft)),
    });
    this.subscriptions.add(this.controller.state$.subscribe(state => {
      if (state.error?.kind !== 'auth') this.rejectedSession = null;
      this.state = state;
      const value = this.form.getRawValue();
      if (value.rating !== state.draft.rating || value.comment !== state.draft.comment) {
        this.form.setValue(state.draft, { emitEvent: false });
      }
      if (state.submitting) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    }));
    this.subscriptions.add(this.form.valueChanges.subscribe(() => this.controller.setDraft(this.form.getRawValue())));
    this.subscriptions.add(this.controller.summaryChanged$.subscribe(event => this.summaryChanged.emit(event)));
    this.subscriptions.add(toObservable(this.selectors.user).pipe(
      map(user => user?._id || user?.id || null), distinctUntilChanged(),
    ).subscribe(userId => this.controller.setContext(this.productId || null, userId)));
  }

  ngOnChanges(): void {
    const user = this.selectors.user();
    this.controller.setContext(this.productId || null, user?._id || user?.id || null);
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.controller.submit();
  }

  signIn(): void {
    if (this.signingOut || this.destroyed) return;
    const currentUrl = this.router.url;
    const language = /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(this.lang) ? this.lang : 'vi';
    const returnUrl = currentUrl.startsWith('/') && !currentUrl.startsWith('//')
      && !/^\/(?:admin|jwtToken)(?:\/|\?|#|$)/.test(currentUrl)
      ? currentUrl : `/${language}/product/${encodeURIComponent(this.productId)}`;
    // app.routes.ts owns /:lang/authorize; AUTH_ROUTER owns its signin child.
    const navigate = () => this.router.navigate(['/', language, 'authorize', 'signin'], { queryParams: { returnUrl } });
    if (this.state.error?.kind === 'auth' && this.isRejectedSessionCurrent()) {
      this.signingOut = true;
      this.store.signOut(() => {
        this.signingOut = false;
        if (!this.destroyed && !this.selectors.user()) navigate();
      });
    } else {
      navigate();
    }
  }

  private withAuthSession<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => {
      // Capture alongside request creation, before its response can arrive under a new login.
      const session = this.currentAuthSession();
      return request().pipe(tap({ error: error => {
        if (error?.status === 401) this.rejectedSession = session;
      } }));
    });
  }

  private currentAuthSession(): ReviewAuthSession {
    const user = this.selectors.user();
    let credential: string | null = null;
    if (isPlatformBrowser(this.platformId)) {
      try {
        const value = localStorage.getItem(accessTokenKey);
        if (value && value !== 'null' && value !== 'undefined' && value.trim()) credential = value;
      } catch {}
    }
    return { user, userId: user?._id || user?.id || null, credential };
  }

  private isRejectedSessionCurrent(): boolean {
    const rejected = this.rejectedSession;
    const current = this.currentAuthSession();
    if (!rejected || !current.user || current.userId !== rejected.userId) return false;
    return rejected.credential !== null ? current.credential === rejected.credential
      : current.credential === null && current.user === rejected.user;
  }

  focusReviews(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.heading?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.heading?.nativeElement.focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.rejectedSession = null;
    this.subscriptions.unsubscribe();
    this.controller.destroy();
  }
}
