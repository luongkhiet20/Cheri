const assert = require('node:assert/strict');
const test = require('node:test');
const { BehaviorSubject, of } = require('rxjs');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const profilePath = 'client/src/app/user/pages/profile/';
const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const line = (productId, title = 'Sản phẩm A') => ({ productId, variantId: 'cccccccccccccccccccccccc',
  productSnapshot: { title, sku: 'FIXTURE' }, quantity: 1, unitPrice: 10, subtotal: 10 });
const order = (extra = {}) => ({ orderId: 'SYNTHETIC', status: 'PENDING', paymentStatus: 'PAID', items: [line(A)], ...extra });
const helpers = () => loadTypeScript(profilePath + 'order-review-links.ts');

test('review choices deduplicate variants by canonical product ID and retain all products', () => {
  const { getOrderReviewProducts } = helpers();
  assert.deepEqual(getOrderReviewProducts(order({ items: [line(A), line(A.toUpperCase(), 'Variant A'), line(B, 'Sản phẩm B')] })),
    [{ productId: A, title: 'Sản phẩm A' }, { productId: B, title: 'Sản phẩm B' }]);
});

test('review choices use only modern productId or the audited legacy item._id path', () => {
  const { getOrderReviewProducts } = helpers();
  assert.deepEqual(getOrderReviewProducts(order({ items: [{ variantId: A, productSnapshot: { sku: B, title: 'Không có ID' } }],
    description: A, cart: { items: [{ item: { _id: B, title: 'Legacy' } }] } })), []);
  assert.deepEqual(getOrderReviewProducts(order({ items: [], cart: { items: [
    { item: { _id: A, title: 'Legacy' } }, { item: { _id: A } }, { id: B }, { productId: B }, { item: { _id: 'bad' } },
  ] } })), [{ productId: A, title: 'Legacy' }]);
  assert.deepEqual(getOrderReviewProducts(order({ items: [line('bad'), line(''), line(null), line(B, '')] })),
    [{ productId: B, title: 'Sản phẩm Cheri' }]);
  assert.deepEqual(getOrderReviewProducts(null), []);
});

test('owned-order action is a PAID or delivered hint with refund and cancellation exclusions', () => {
  const { canShowOrderReviewAction } = helpers();
  for (const [extra, expected] of [
    [{}, true], [{ paymentStatus: 'UNPAID' }, false], [{ paymentStatus: 'UNPAID', status: 'DELIVERED' }, true],
    [{ paymentStatus: 'UNPAID', status: ' completed ' }, true], [{ status: 'CANCELLED' }, false],
    [{ status: ' canceled ' }, false], [{ status: 'RETURNED' }, false],
    [{ status: 'DELIVERED', paymentStatus: 'REFUNDED' }, false],
    [{ paymentStatus: 'PARTIALLY_REFUNDED' }, false], [{ paymentStatus: 'PARTIALLY_REFUNDED', status: 'DELIVERED' }, true],
    [{ paymentStatus: undefined, payment: { status: ' paid ' } }, true],
    [{ paymentStatus: 'REFUNDED', payment: { status: 'PAID' } }, false],
    [{ paymentStatus: '', payment: { status: 'PAID' } }, false],
    [{ createdAt: '2000-01-01' }, true],
  ]) assert.equal(canShowOrderReviewAction(order(extra)), expected, JSON.stringify(extra));
  assert.equal(canShowOrderReviewAction(null), false);
});

async function angular() { await import('@angular/compiler'); return import('@angular/core'); }
async function profileHarness(orders, language = 'vi') {
  const core = await angular();
  const { Profile } = loadTypeScript(profilePath + 'profile.ts', {
    '@angular/core': { ...core, effect: () => {} }, '@angular/common': { CommonModule: class {}, isPlatformBrowser: value => value === 'browser' },
    '@angular/forms': { FormsModule: class {} }, '@angular/router': { Router: class {}, RouterLink: class {} },
    '../../../services/translate.service': { TranslateService: class {} }, '../../../services/api.service': { ApiService: class {} },
    '../../../store/signal.store': { SignalStore: class {} }, '../../../store/signal.store.selectors': { SignalStoreSelectors: class {} },
  });
  const navigations = [];
  const component = new Profile('browser', {}, { user: () => null, userOrders: () => orders },
    { lang: language, getLang$: () => of(language) }, {}, {}, { navigate: (...args) => navigations.push(args) }, { markForCheck() {} });
  return { component, navigations };
}

test('single-product action navigates by canonical ID and emits only the review query', async () => {
  const owned = order({ items: [line(A), line(A)] });
  const { component, navigations } = await profileHarness([owned], 'en');
  component.onReviewOrder(owned);
  assert.deepEqual(navigations, [[['/en/product', A], { queryParams: { review: 1 } }]]);
  assert.equal(component.isReviewChooserOpen(owned), false);
});

test('multi-product action waits for an explicit choice and closes its inline chooser on selection', async () => {
  const owned = order({ items: [line(A), line(B, 'Sản phẩm B'), line(A)] });
  const { component, navigations } = await profileHarness([owned]);
  component.onReviewOrder(owned);
  assert.equal(component.isReviewChooserOpen(owned), true);
  assert.deepEqual(component.getOrderReviewProducts(owned).map(product => product.productId), [A, B]);
  assert.deepEqual(navigations, []);
  component.openProductReview(B);
  assert.deepEqual(navigations, [[['/vi/product', B], { queryParams: { review: 1 } }]]);
  assert.equal(component.isReviewChooserOpen(owned), false);
});

test('missing IDs, excluded status, or an order absent from the owned listing cannot fabricate a review link', async () => {
  const missing = order({ items: [{ variantId: A }] });
  const returned = order({ status: 'RETURNED' });
  const { component, navigations } = await profileHarness([missing, returned]);
  component.onReviewOrder(missing); component.onReviewOrder(returned); component.onReviewOrder(order());
  component.openProductReview('invalid');
  assert.deepEqual(navigations, []);
  assert.deepEqual(component.getOrderReviewProducts(missing), []);
  assert.equal(component.isReviewChooserOpen(missing), false);
});

async function productHarness(platform = 'browser', review = 1, routeId = A) {
  const core = await angular();
  const product = new BehaviorSubject(null);
  const params = new BehaviorSubject({ id: routeId });
  const queryParams = new BehaviorSubject({ review });
  let loading = true;
  const categories = () => [{}]; const currency = () => 'VND'; const cart = () => ({ items: [] });
  const selectors = { product: () => product.value, productLoading: () => loading, categories, currency, cart };
  const { ProductComponent } = loadTypeScript('client/src/app/user/pages/product/product/product.component.ts', {
    '@angular/core': core, '@angular/core/rxjs-interop': { toObservable: signal => signal === selectors.product ? product : of(signal()) },
    '@angular/common': { Location: class {}, isPlatformBrowser: value => value === 'browser' },
    '@angular/router': { ActivatedRoute: class {}, Router: class {} }, '@angular/platform-browser': { Meta: class {}, Title: class {} },
    '@angular/material/dialog': { MatDialog: class {} }, '@angular/material/snack-bar': { MatSnackBar: class {} },
    '../../../../services/jsonLD.service': { JsonLDService: class {} }, '../../../../services/api.service': { ApiService: class {} },
    '../../../../services/translate.service': { TranslateService: class {} },
    '../../../../services/cart-toast.service': { CartToastService: class {} }, '../../../../store/signal.store': { SignalStore: class {} },
    '../../../../store/signal.store.selectors': { SignalStoreSelectors: class {} },
    '../../../shared/images-dialog/images-dialog.component': { ImagesDialogComponent: class {} },
  });
  const component = new ProductComponent({ params, queryParams }, { getProduct() {}, getCategories() {} }, selectors, {},
    { updateTag() {} }, { setTitle() {} }, {}, {}, {}, { getLang$: () => of('vi') }, { insertSchema() {} }, platform,
    { recordInteraction: () => of(null) });
  const focuses = [];
  const mount = (id = A) => { component.reviewSection = { productId: id, focusReviews: () => focuses.push(id) }; };
  const load = (id = A, extra = {}) => { loading = false; product.next({ _id: id, titleUrl: 'fixture-slug', title: 'Fixture', tags: [], variants: [], ...extra }); };
  return { component, params, queryParams, focuses, mount, load, product };
}

test('review query waits for loaded product and mounted child, then focuses once despite summary/view updates', async t => {
  const h = await productHarness(); t.after(() => h.component.ngOnDestroy());
  h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, []);
  h.load(); h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, []);
  h.mount(); h.component.ngAfterViewChecked(); assert.deepEqual(h.focuses, [A]);
  h.component.ngAfterViewChecked(); h.queryParams.next({ review: 1, other: 'ignored' });
  h.product.next({ ...h.product.value, reviewSummary: { average: 5, count: 1 } });
  h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, [A]);
});

test('route changes cannot focus an old product or child and permit a new one-shot focus', async t => {
  const h = await productHarness(); t.after(() => h.component.ngOnDestroy());
  h.load(); h.mount(); h.component.focusReviewsFromQuery();
  h.params.next({ id: B }); h.component.focusReviewsFromQuery();
  h.load(B); h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, [A]);
  h.mount(B); h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, [A, B]);
  h.component.ngOnDestroy(); h.params.next({ id: A });
  h.load(); h.mount(); h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, [A, B]);
});

test('server rendering, hidden products, and absent/non-review queries never focus', async t => {
  for (const [platform, review, extra] of [['server', 1, {}], ['browser', null, {}], ['browser', '0', {}],
    ['browser', 1, { visibility: false }], ['browser', 1, { vi: { visibility: false } }]]) {
    const h = await productHarness(platform, review); t.after(() => h.component.ngOnDestroy());
    h.load(A, extra); h.mount(); h.component.focusReviewsFromQuery();
    assert.deepEqual(h.focuses, [], `${platform}/${review}/${JSON.stringify(extra)}`);
  }
});

test('a refreshed slug deep link can focus the resolved canonical product, and query removal cancels pending focus', async t => {
  const h = await productHarness('browser', '1', 'fixture-slug'); t.after(() => h.component.ngOnDestroy());
  h.load(); h.mount(); h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, [A]);
  h.queryParams.next({}); h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, [A]);
  h.queryParams.next({ review: 1 }); h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, [A, A]);
  h.params.next({ id: B }); h.queryParams.next({}); h.load(B); h.mount(B);
  h.component.focusReviewsFromQuery(); assert.deepEqual(h.focuses, [A, A]);
});
