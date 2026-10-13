const assert = require('node:assert/strict');
const test = require('node:test');
const { Observable, Subject, of } = require('rxjs');
const { distinctUntilChanged } = require('rxjs/operators');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const reviewsPath = 'client/src/app/user/shared/reviews/';

const productA = () => ({ _id: 'product-a', title: 'Sản phẩm A', titleUrl: 'product-a',
  description: '', descriptionFull: [], tags: [], regularPrice: 200, salePrice: 180,
  onSale: true, visibility: true, stock: 'onStock', quantity: 12,
  mainImage: { url: 'main.png', name: 'main' }, images: ['second.png'],
  reviewSummary: { average: 3, count: 1 }, hasSizes: true, sizes: ['S', 'M'],
  variants: [
    { _id: 'variant-s', sku: 'SKU-S', size: 'S', price: 200, discountPrice: 180, stock: 12 },
    { _id: 'variant-m', sku: 'SKU-M', size: 'M', price: 300, discountPrice: 250, stock: 8 },
  ],
});

async function storeHarness() {
  await import('@angular/compiler');
  const core = await import('@angular/core');
  const { SignalStoreSelectors } = loadTypeScript('client/src/app/store/signal.store.selectors.ts', { '@angular/core': core });
  const { SignalStore } = loadTypeScript('client/src/app/store/signal.store.ts', {
    '@angular/core': core, './signal.store.selectors': { SignalStoreSelectors },
    '../services/api.service': { ApiService: class {} },
  });
  const selectors = new SignalStoreSelectors();
  const calls = [];
  const api = Object.fromEntries(['getProduct', 'getProducts', 'getCategories', 'addToCart'].map(method => [method, (...args) => {
    const response = new Subject(); calls.push({ method, args, response }); return response.asObservable();
  }]));
  const store = new SignalStore(api, selectors);
  const original = productA();
  const other = { ...productA(), _id: 'product-b', titleUrl: 'product-b', reviewSummary: { average: 2, count: 4 } };
  selectors.productState.update(state => ({ ...state, product: original, products: [original, other], categories: [{}], cart: { items: [] } }));
  return { core, store, selectors, original, other, calls };
}

// A test-only synchronous bridge for real Angular signals: it observes selector values
// after state writes and preserves toObservable's reference equality behavior.
function observableBridge(selectors) {
  const changes = new Subject();
  for (const state of [selectors.productState, selectors.userState]) {
    const update = state.update.bind(state);
    state.update = value => { update(value); changes.next(); };
  }
  return signal => new Observable(subscriber => {
    subscriber.next(signal());
    const subscription = changes.subscribe(() => subscriber.next(signal()));
    return () => subscription.unsubscribe();
  }).pipe(distinctUntilChanged());
}

function loadProduct(core, toObservable) {
  return loadTypeScript('client/src/app/user/pages/product/product/product.component.ts', {
    '@angular/core': core, '@angular/core/rxjs-interop': { toObservable },
    '@angular/common': { Location: class {} },
    '@angular/router': { ActivatedRoute: class {}, Router: class {} },
    '@angular/platform-browser': { Meta: class {}, Title: class {} },
    '@angular/material/dialog': { MatDialog: class {} },
    '@angular/material/snack-bar': { MatSnackBar: class {} },
    '../../../../services/jsonLD.service': { JsonLDService: class {} },
    '../../../../services/translate.service': { TranslateService: class {} },
    '../../../../services/cart-toast.service': { CartToastService: class {} },
    '../../../../store/signal.store': { SignalStore: class {} },
    '../../../../store/signal.store.selectors': { SignalStoreSelectors: class {} },
    '../../../shared/images-dialog/images-dialog.component': { ImagesDialogComponent: class {} },
    '../../../shared/reviews/product-reviews.component': { ProductReviewsComponent: class {} },
  }).ProductComponent;
}

test('formatter reports real count with Vietnamese rounding and never fabricates an empty rating', () => {
  const { formatReviewSummary } = loadTypeScript(reviewsPath + 'rating-view.ts');
  assert.equal(formatReviewSummary({ average: 4.75, count: 12 }), '4,8/5 · 12 đánh giá');
  assert.equal(formatReviewSummary({ average: 4, count: 1 }), '4,0/5 · 1 đánh giá');
  assert.equal(formatReviewSummary({ average: null, count: 0 }), 'Chưa có đánh giá');
  assert.equal(formatReviewSummary({ average: 5, count: 0 }), 'Chưa có đánh giá');
});

test('star fills show partial values and clamp to the five star range', () => {
  const { getStarFill } = loadTypeScript(reviewsPath + 'rating-view.ts');
  assert.deepEqual([0, 1, 2, 3, 4].map(index => getStarFill(4.5, index)), [100, 100, 100, 100, 50]);
  assert.equal(getStarFill(null, 0), 0);
  assert.equal(getStarFill(-1, 0), 0);
  assert.equal(getStarFill(6, 4), 100);
});

test('summary overrides are reactive, public-only, isolated by product and preserve product references', async () => {
  const h = await storeHarness();
  assert.equal(typeof h.store.updateProductReviewSummary, 'function');
  assert.equal(typeof h.store.resolveProductReviewSummary, 'function');
  const productsBefore = h.selectors.products();
  const stateBefore = h.selectors.productState();
  const displayed = h.core.computed(() => h.store.resolveProductReviewSummary(h.original));
  assert.deepEqual(displayed(), { average: 3, count: 1 });
  assert.deepEqual(h.store.resolveProductReviewSummary({ _id: 'empty', rating: 5 }), { average: null, count: 0 });
  const summary = { average: 4.75, count: 12, authorName: 'Must not be cached', userId: 'synthetic-user' };
  h.store.updateProductReviewSummary('product-a', summary);
  summary.count = 99;
  assert.deepEqual(displayed(), { average: 4.75, count: 12 });
  assert.deepEqual(h.selectors.reviewSummaries(), { 'product-a': { average: 4.75, count: 12 } });
  assert.equal(h.selectors.productState(), stateBefore);
  assert.equal(h.selectors.product(), h.original);
  assert.equal(h.selectors.products(), productsBefore);
  assert.deepEqual(h.store.resolveProductReviewSummary(h.other), { average: 2, count: 4 });
  assert.equal(h.calls.length, 0);
});

test('persisted PUT updates detail and card summaries without reinitializing a selected variant', async t => {
  const h = await storeHarness();
  const ProductComponent = loadProduct(h.core, observableBridge(h.selectors));
  const component = new ProductComponent({ params: of({ id: 'product-a' }) }, h.store, h.selectors, {},
    { updateTag() {} }, { setTitle() {} }, {}, { open() {} }, { show() {} }, {},
    { getLang$: () => of('vi') }, { insertSchema() {} });
  t.after(() => component.ngOnDestroy());
  let initCalls = 0;
  const init = component.initProductState.bind(component);
  component.initProductState = product => { initCalls++; init(product); };
  component.onSelectSize('M'); component.quantity = 3; component.selectImage('second.png');
  const gallery = component.galleryImages;
  const variant = component.selectedVariant;
  const { ReviewController } = loadTypeScript(reviewsPath + 'review-controller.ts');
  const pendingPage = new Subject(); const put = new Subject();
  const controller = new ReviewController({ getPage: () => pendingPage.asObservable(),
    getMine: () => of({ productId: 'product-a', eligible: true, reason: 'ELIGIBLE', myReview: null }),
    saveMine: () => put.asObservable() });
  t.after(() => controller.destroy());
  controller.summaryChanged$.subscribe(event => component.onReviewSummaryChanged(event));
  let page;
  controller.state$.subscribe(state => page = state.page);
  controller.setContext('product-a', 'synthetic-user');
  controller.setDraft({ rating: 5, comment: 'Tốt' }); controller.submit();
  assert.deepEqual(h.original.reviewSummary, { average: 3, count: 1 });
  assert.deepEqual(component.resolveProductReviewSummary(h.original), { average: 3, count: 1 });
  assert.equal(initCalls, 0);
  const myReview = { id: 'review-a', authorName: 'Khách hàng', rating: 5, comment: 'Tốt',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
  put.next({ productId: 'product-a', summary: { average: 4.5, count: 2 }, reviews: [myReview],
    page: 1, pageSize: 10, total: 2, myReview });
  assert.deepEqual(component.resolveProductReviewSummary(h.original), { average: 4.5, count: 2 });
  assert.deepEqual(h.store.resolveProductReviewSummary(h.selectors.products()[0]), { average: 4.5, count: 2 });
  assert.equal(h.selectors.product(), h.original);
  assert.equal(initCalls, 0);
  assert.equal(component.selectedVariant, variant);
  assert.equal(component.quantity, 3);
  assert.equal(component.displaySalePrice, 250);
  assert.equal(component.displayRegularPrice, 300);
  assert.equal(component.maxStock, 8);
  assert.equal(component.displaySku, 'SKU-M');
  assert.equal(component.galleryImages, gallery);
  assert.equal(component.selectedImage, 'second.png');
  assert.deepEqual(h.calls.map(call => call.method), ['getProduct']);
  pendingPage.next({ productId: 'product-a', summary: { average: null, count: 0 }, reviews: [], page: 1, pageSize: 10, total: 0 });
  assert.deepEqual(page.summary, { average: 4.5, count: 2 });
  // A late canonical detail response may contain an old summary; the session map wins.
  h.calls[0].response.next({ ...h.original, reviewSummary: { average: 1, count: 1 } });
  assert.deepEqual(component.resolveProductReviewSummary(h.selectors.product()), { average: 4.5, count: 2 });
});

test('homepage section and fallback products retain overrides after an older list response', async () => {
  const h = await storeHarness();
  const { HomeComponent } = loadTypeScript('client/src/app/user/pages/cheri/home/home.component.ts', {
    '@angular/core': h.core, '@angular/common': { CommonModule: class {}, SlicePipe: class {} },
    '@angular/core/rxjs-interop': { toSignal: () => {}, toObservable: () => of() },
    '@angular/router': { Router: class {}, ActivatedRoute: class {}, RouterLink: class {} },
    '@angular/platform-browser': { Meta: class {}, Title: class {} },
    '@angular/material/snack-bar': { MatSnackBar: class {}, MatSnackBarRef: class {} },
    '@angular/material/sidenav': { MatSidenavModule: class {} },
    '@angular/material/progress-bar': { MatProgressBarModule: class {} },
    '@angular/material/progress-spinner': { MatProgressSpinnerModule: class {} },
    '../../../shared/sidebar/sidebar.component': { SidebarComponent: class {} },
    '../../../shared/wishlist-button/wishlist-button.component': { WishlistButtonComponent: class {} },
    '../../../shared/reviews/rating-summary.component': { RatingSummaryComponent: class {} },
    '../../../../services/translate.service': { TranslateService: class {} },
    '../../../../services/api.service': { ApiService: class {} },
    '../../../../services/theme.service': { ThemeService: class {} },
    '../../../../services/cart-toast.service': { CartToastService: class {} },
    '../../../../pipes/translate.pipe': { TranslatePipe: class {} },
    '../../../../store/signal.store': { SignalStore: class {} },
    '../../../../store/signal.store.selectors': { SignalStoreSelectors: class {} },
    '../../../../admin/pages/pages/home-about/cms-core/cms.constants': {},
  });
  const home = Object.assign(Object.create(HomeComponent.prototype), { store: h.store, products: h.selectors.products });
  assert.equal(typeof home.resolveProductReviewSummary, 'function');
  h.store.getProducts({ lang: 'vi' });
  h.store.updateProductReviewSummary('product-a', { average: 4.8, count: 12 });
  h.calls[0].response.next({ products: [{ ...h.original, reviewSummary: { average: 1, count: 1 } }, h.other], pagination: { page: 1, pages: 1, total: 2 }, maxPrice: 300, minPrice: 100 });
  for (const section of [{ settings: { source: 'featured' } }, { settings: { source: 'manual', manualProductIds: ['product-a'] } }]) {
    assert.deepEqual(home.resolveProductReviewSummary(home.getFilteredProducts(section)[0]), { average: 4.8, count: 12 });
  }
  assert.deepEqual(home.resolveProductReviewSummary(home.products()[0]), { average: 4.8, count: 12 });
  assert.deepEqual(home.resolveProductReviewSummary(home.products()[1]), { average: 2, count: 4 });
  assert.deepEqual(h.calls.map(call => call.method), ['getProducts']);
});

test('rating activation stops popup/card propagation and empty summaries have no filled stars', async () => {
  await import('@angular/compiler'); const core = await import('@angular/core');
  const { RatingSummaryComponent } = loadTypeScript(reviewsPath + 'rating-summary.component.ts', { '@angular/core': core });
  const component = new RatingSummaryComponent();
  let activations = 0; let stopped = 0;
  component.activate.subscribe(() => activations++);
  component.interactive = true; component.summary = { average: 5, count: 0 };
  // Native buttons dispatch a click for pointer, Enter, and Space activation.
  for (const detail of [1, 0]) component.onActivate({ detail, stopPropagation() { stopped++; } });
  assert.equal(activations, 2); assert.equal(stopped, 2);
  assert.deepEqual(component.stars.map(index => component.starFill(index)), [0, 0, 0, 0, 0]);
  component.summary = { average: 4.5, count: 2 };
  assert.equal(component.starFill(4), 50);
  component.interactive = false;
  component.onActivate({ stopPropagation() { stopped++; } });
  assert.equal(activations, 2);
});
