const assert = require('node:assert/strict');
const test = require('node:test');
const { Subject, BehaviorSubject, of } = require('rxjs');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const controllerPath = 'client/src/app/user/shared/reviews/review-controller.ts';
const review = { id: 'review-a', authorName: 'Khách hàng', rating: 4, comment: 'Tốt',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const page = (productId = 'product-a', overrides = {}) => ({ productId, summary: { average: null, count: 0 },
  reviews: [], page: 1, pageSize: 10, total: 0, ...overrides });
const mine = (productId = 'product-a', overrides = {}) => ({ productId, eligible: true,
  reason: 'ELIGIBLE', myReview: null, ...overrides });
const saved = (overrides = {}) => page('product-a', { summary: { average: 4.5, count: 2 },
  reviews: [review], total: 2, myReview: review, ...overrides });

function setup(t) {
  const { ReviewController } = loadTypeScript(controllerPath);
  const calls = [];
  const api = Object.fromEntries(['getPage', 'getMine', 'saveMine'].map(method => [method, (...args) => {
    const response = new Subject();
    calls.push({ method, args, response });
    return response.asObservable();
  }]));
  const controller = new ReviewController(api);
  let state;
  const summaries = [];
  controller.state$.subscribe(value => state = value);
  controller.summaryChanged$.subscribe(value => summaries.push(value));
  t.after(() => controller.destroy());
  return { controller, calls, summaries, get state() { return state; },
    last(method) { return calls.filter(call => call.method === method).at(-1); } };
}
function eligible(h, myReview = null) {
  h.controller.setContext('product-a', 'user-a');
  h.last('getPage').response.next(page());
  h.last('getMine').response.next(mine('product-a', { myReview }));
}

test('pending public and private reads are canceled on product/user changes and destroy', t => {
  const h = setup(t);
  h.controller.setContext('product-a', 'user-a');
  const old = [...h.calls];
  assert.equal(h.state.loadingEligibility, true);
  h.controller.setContext('product-b', 'user-b');
  for (const call of old) assert.equal(call.response.observed, false);
  old[0].response.next(page());
  old[1].response.next(mine('product-a', { myReview: review }));
  assert.equal(h.state.productId, 'product-b');
  assert.equal(h.state.userId, 'user-b');
  assert.equal(h.state.page, null);
  assert.equal(h.state.eligibility, null);
  h.controller.destroy();
  for (const call of h.calls) assert.equal(call.response.observed, false);
});

test('guest reads public reviews but never reads or writes a private review', t => {
  const h = setup(t);
  h.controller.setContext('product-a', null);
  assert.deepEqual(h.calls.map(call => call.method), ['getPage']);
  assert.deepEqual(h.state.draft, { rating: 0, comment: '' });
  h.controller.setDraft({ rating: 5, comment: 'Tốt' });
  h.controller.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.state.error.kind, 'auth');
  h.last('getPage').response.next(page());
  assert.equal(h.state.page.total, 0);
});

test('NOT_PURCHASED blocks writes and an existing review fills the edit draft', t => {
  const h = setup(t);
  h.controller.setContext('product-a', 'user-a');
  h.last('getMine').response.next(mine('product-a', { eligible: false, reason: 'NOT_PURCHASED' }));
  h.controller.setDraft({ rating: 4, comment: 'Tốt' });
  h.controller.submit();
  assert.equal(h.state.eligibility.eligible, false);
  assert.equal(h.calls.filter(call => call.method === 'saveMine').length, 0);
  h.controller.setContext('product-a', 'user-b');
  h.last('getMine').response.next(mine('product-a', { myReview: review }));
  assert.deepEqual(h.state.draft, { rating: 4, comment: 'Tốt' });
});

test('invalid ratings and blank or oversized comments cannot reach PUT', t => {
  const h = setup(t);
  eligible(h);
  for (const draft of [
    { rating: 0, comment: 'Tốt' }, { rating: 6, comment: 'Tốt' },
    { rating: 1.5, comment: 'Tốt' }, { rating: '4', comment: 'Tốt' },
    { rating: 4, comment: '  ' }, { rating: 4, comment: 'a'.repeat(1001) },
  ]) {
    h.controller.setDraft(draft);
    h.controller.submit();
    assert.equal(h.state.error.kind, 'validation');
  }
  assert.equal(h.calls.filter(call => call.method === 'saveMine').length, 0);
});

test('one in-flight PUT trims text and applies saved page, summary and edit draft', t => {
  const h = setup(t);
  eligible(h);
  h.controller.setDraft({ rating: 4, comment: '  Tốt  ' });
  h.controller.submit();
  h.controller.submit();
  assert.equal(h.calls.filter(call => call.method === 'saveMine').length, 1);
  assert.deepEqual(h.last('saveMine').args, ['product-a', { rating: 4, comment: 'Tốt' }]);
  assert.equal(h.state.submitting, true);
  assert.equal(h.state.success, null);
  h.last('saveMine').response.next(saved());
  assert.deepEqual(h.state.page.summary, { average: 4.5, count: 2 });
  assert.deepEqual(h.state.eligibility.myReview, review);
  assert.deepEqual(h.state.draft, { rating: 4, comment: 'Tốt' });
  assert.equal(h.state.submitting, false);
  assert.ok(h.state.success);
  assert.deepEqual(h.summaries.at(-1), { productId: 'product-a', summary: { average: 4.5, count: 2 } });
  h.controller.setDraft({ rating: 5, comment: 'Cập nhật' });
  h.controller.submit();
  h.last('saveMine').response.next(saved({ myReview: { ...review, rating: 5, comment: 'Cập nhật' } }));
  assert.equal(h.state.page.summary.count, 2);
});

for (const status of [0, 500]) {
  test(`failure ${status} preserves the draft and retry repeats the write`, t => {
    const h = setup(t);
    eligible(h);
    h.controller.setDraft({ rating: 3, comment: 'Bản nháp chưa gửi được' });
    h.controller.submit();
    h.last('saveMine').response.error({ status });
    assert.equal(h.state.success, null);
    assert.equal(h.state.submitting, false);
    assert.equal(h.state.draft.comment, 'Bản nháp chưa gửi được');
    assert.equal(h.state.error.kind, 'submit');
    h.controller.retry();
    assert.equal(h.calls.filter(call => call.method === 'saveMine').length, 2);
  });
}

for (const [status, kind] of [[400, 'validation'], [401, 'auth'], [403, 'forbidden']]) {
  test(`PUT ${status} exposes ${kind} without clearing the draft or reporting success`, t => {
    const h = setup(t);
    eligible(h);
    h.controller.setDraft({ rating: 3, comment: 'Bản nháp' });
    h.controller.submit();
    h.last('saveMine').response.error({ status });
    assert.equal(h.state.error.kind, kind);
    assert.equal(h.state.draft.comment, 'Bản nháp');
    assert.equal(h.state.success, null);
    if (status === 401) assert.equal(h.state.eligibility, null);
    if (status === 403) assert.equal(h.state.eligibility.eligible, false);
  });
}

test('page failures are errors, not an empty loaded list, and retry targets the failed page', t => {
  const h = setup(t);
  h.controller.setContext('product-a', null);
  h.last('getPage').response.error({ status: 500 });
  assert.equal(h.state.page, null);
  assert.equal(h.state.error.kind, 'page');
  h.controller.retry();
  assert.equal(h.calls.length, 2);
  h.last('getPage').response.next(page());
  h.controller.loadPage(2);
  h.last('getPage').response.error({ status: 0 });
  h.controller.retry();
  assert.equal(h.calls.length, 4);
  assert.deepEqual(h.last('getPage').args, ['product-a', 2, 10]);
});

test('eligibility errors retry without replacing a preserved draft', t => {
  const h = setup(t);
  h.controller.setContext('product-a', 'user-a');
  h.last('getMine').response.error({ status: 500 });
  assert.equal(h.state.error.kind, 'eligibility');
  h.controller.setDraft({ rating: 3, comment: 'Bản nháp' });
  h.controller.retry();
  assert.equal(h.calls.filter(call => call.method === 'getMine').length, 2);
  h.last('getMine').response.next(mine('product-a', { myReview: review }));
  assert.equal(h.state.eligibility.eligible, true);
  assert.equal(h.state.draft.comment, 'Bản nháp');
});

for (const failureOrder of [['getMine', 'getPage'], ['getPage', 'getMine']]) {
  for (const recoveryOrder of [['getMine', 'getPage'], ['getPage', 'getMine']]) {
    test(`independent read failures ${failureOrder.join('/')} recover ${recoveryOrder.join('/')} without losing retry`, t => {
      const h = setup(t);
      h.controller.setContext('product-a', 'user-a');
      for (const method of failureOrder) h.last(method).response.error({ status: 500 });
      assert.ok(h.state.error);
      h.controller.retry();
      assert.equal(h.calls.filter(call => call.method === 'getPage').length, 2);
      assert.equal(h.calls.filter(call => call.method === 'getMine').length, 2);
      for (const method of recoveryOrder) {
        h.last(method).response.next(method === 'getPage' ? page() : mine());
      }
      assert.equal(h.state.error, null);
      assert.equal(h.state.page.productId, 'product-a');
      assert.equal(h.state.eligibility.eligible, true);
      assert.equal(h.state.loadingPage, false);
      assert.equal(h.state.loadingEligibility, false);
      h.controller.setDraft({ rating: 4, comment: 'Tốt' });
      h.controller.submit();
      assert.equal(h.calls.filter(call => call.method === 'saveMine').length, 1);
    });
  }
}

test('successful retry of one read leaves the other failed read recoverable', t => {
  const h = setup(t);
  h.controller.setContext('product-a', 'user-a');
  h.last('getMine').response.error({ status: 500 });
  h.last('getPage').response.error({ status: 500 });
  h.controller.loadPage(1);
  h.last('getPage').response.next(page());
  assert.equal(h.state.error?.kind, 'eligibility');
  h.controller.retry();
  assert.equal(h.calls.filter(call => call.method === 'getMine').length, 2);
  h.last('getMine').response.next(mine());
  assert.equal(h.state.error, null);
  assert.equal(h.state.eligibility.eligible, true);
});

test('a concurrent public read failure cannot hide an expired-session sign-in action', t => {
  const h = setup(t);
  h.controller.setContext('product-a', 'user-a');
  h.last('getMine').response.error({ status: 401 });
  h.last('getPage').response.error({ status: 500 });
  assert.equal(h.state.error.kind, 'auth');
  h.controller.retry();
  h.last('getPage').response.next(page());
  assert.equal(h.state.error.kind, 'auth');
  assert.equal(h.state.eligibility, null);
});

test('a successful save invalidates prior GETs and publishes the server summary once', t => {
  const h = setup(t);
  eligible(h);
  h.controller.loadPage(2);
  const oldPage = h.last('getPage');
  const oldMine = h.last('getMine');
  const oldRevision = h.state.revision;
  h.controller.setDraft({ rating: 4, comment: 'Tốt' });
  h.controller.submit();
  h.last('saveMine').response.next(saved());
  oldPage.response.next(page('product-a', { page: 2 }));
  oldMine.response.next(mine('product-a', { eligible: false, reason: 'NOT_PURCHASED' }));
  assert.equal(h.state.page.page, 1);
  assert.equal(h.state.page.summary.count, 2);
  assert.equal(h.state.eligibility.eligible, true);
  assert.ok(h.state.revision > oldRevision);
  assert.equal(oldPage.response.observed, false);
  assert.equal(oldMine.response.observed, false);
});

test('latest pagination wins and unchanged context does not refetch', t => {
  const h = setup(t);
  h.controller.setContext('product-a', null);
  const oldPage = h.last('getPage');
  h.controller.loadPage(2);
  h.last('getPage').response.next(page('product-a', { page: 2 }));
  oldPage.response.next(page());
  h.controller.setContext('product-a', null);
  assert.equal(h.state.page.page, 2);
  assert.equal(h.calls.length, 2);
});

for (const [productId, userId] of [['product-b', 'user-a'], ['product-a', 'user-b'], ['product-a', null], [null, null]]) {
  test(`context ${productId}/${userId} cancels GET/PUT and removes the previous private draft`, t => {
    const h = setup(t);
    eligible(h, review);
    h.controller.loadPage(2);
    h.controller.submit();
    const oldCalls = [...h.calls];
    h.controller.setContext(productId, userId);
    assert.deepEqual(h.state.draft, { rating: 0, comment: '' });
    assert.equal(h.state.eligibility, null);
    assert.equal(h.state.submitting, false);
    for (const call of oldCalls) assert.equal(call.response.observed, false);
    oldCalls.find(call => call.method === 'saveMine').response.next(saved());
    assert.equal(h.state.success, null);
    assert.deepEqual(h.summaries, []);
  });
}

test('destroy releases all GET/PUT subscriptions and stops state/summary emissions', t => {
  const h = setup(t);
  eligible(h);
  h.controller.loadPage(2);
  h.controller.setDraft({ rating: 4, comment: 'Tốt' });
  h.controller.submit();
  const previous = h.state;
  h.controller.destroy();
  for (const call of h.calls) assert.equal(call.response.observed, false);
  h.last('saveMine').response.next(saved());
  h.controller.setContext('product-b', 'user-b');
  assert.equal(h.state, previous);
  assert.deepEqual(h.summaries, []);
});

test('API uses storefront URLs and only review draft fields, preserving observable HTTP errors', () => {
  const calls = [];
  const http = Object.fromEntries(['get', 'put'].map(method => [method, (...args) => {
    const response = new Subject(); calls.push({ method, args, response }); return response.asObservable();
  }]));
  const { ProductReviewsApi } = loadTypeScript('client/src/app/services/product-reviews.service.ts', {
    '@angular/core': { Injectable: () => value => value },
    '@angular/common/http': { HttpClient: class {} },
    './api.service': { ApiService: class {} },
  });
  const requestOptions = { headers: { lang: 'vi' }, withCredentials: true };
  const api = new ProductReviewsApi(http, { apiUrl: 'http://localhost:4000', getRequestOptions: () => requestOptions });
  api.getPage('canonical-a', 2, 20).subscribe();
  api.getMine('canonical-a').subscribe();
  let error;
  api.saveMine('canonical-a', { rating: 4, comment: 'Tốt', userId: 'not-sent' })
    .subscribe({ error: value => error = value });
  assert.deepEqual(calls.map(({ method, args }) => ({ method, args })), [
    { method: 'get', args: ['http://localhost:4000/api/products/canonical-a/reviews?page=2&pageSize=20', requestOptions] },
    { method: 'get', args: ['http://localhost:4000/api/products/canonical-a/reviews/me', requestOptions] },
    { method: 'put', args: ['http://localhost:4000/api/products/canonical-a/reviews/me', { rating: 4, comment: 'Tốt' }, requestOptions] },
  ]);
  const failure = { status: 401 };
  calls[2].response.error(failure);
  assert.equal(error, failure);
});

test('component adapts signin id and profile _id, preserves returnUrl, and tears down on logout/destroy', async t => {
  await import('@angular/compiler');
  const [core, common, forms] = await Promise.all([import('@angular/core'), import('@angular/common'), import('@angular/forms')]);
  const user = new BehaviorSubject({ id: 'user-a' });
  const calls = [];
  const api = Object.fromEntries(['getPage', 'getMine', 'saveMine'].map(method => [method, (...args) => {
    const response = new Subject(); calls.push({ method, args, response }); return response.asObservable();
  }]));
  const navigations = [];
  const router = { url: '/vi/product/product-a?ref=profile#reviews', navigate: (...args) => navigations.push(args) };
  const { ProductReviewsComponent } = loadTypeScript('client/src/app/user/shared/reviews/product-reviews.component.ts', {
    '@angular/core': core,
    '@angular/common': common,
    '@angular/forms': forms,
    '@angular/core/rxjs-interop': { toObservable: () => user.asObservable() },
    '@angular/router': { Router: class {} },
    '../../../services/product-reviews.service': { ProductReviewsApi: class {} },
    '../../../store/signal.store.selectors': { SignalStoreSelectors: class {} },
    '../../../store/signal.store': { SignalStore: class {} },
  });
  const component = new ProductReviewsComponent(api, { user: () => user.value }, router, 'server');
  t.after(() => component.ngOnDestroy());
  component.productId = 'product-a';
  component.ngOnChanges();
  assert.equal(component.state.userId, 'user-a');
  assert.deepEqual(calls.map(call => call.method), ['getPage', 'getMine']);
  calls.at(-1).response.next(mine('product-a', { myReview: review }));
  assert.deepEqual(component.form.getRawValue(), { rating: 4, comment: 'Tốt' });
  component.form.setValue({ rating: 3, comment: 'Bản nháp' });
  assert.equal(component.state.draft.comment, 'Bản nháp');
  component.signIn();
  assert.deepEqual(navigations.at(-1), [ ['/', 'vi', 'authorize', 'signin'],
    { queryParams: { returnUrl: '/vi/product/product-a?ref=profile#reviews' } } ]);
  for (const unsafeUrl of ['//external.invalid/product', '/admin', '/jwtToken/invalid']) {
    router.url = unsafeUrl;
    component.signIn();
    assert.equal(navigations.at(-1)[1].queryParams.returnUrl, '/vi/product/product-a');
  }
  user.next({ _id: 'user-b' });
  assert.equal(component.state.userId, 'user-b');
  assert.deepEqual(component.form.getRawValue(), { rating: 0, comment: '' });
  user.next(null);
  assert.equal(component.state.userId, null);
  assert.equal(component.state.eligibility, null);
  component.ngOnDestroy();
  assert.equal(user.observed, false);
  for (const call of calls) assert.equal(call.response.observed, false);
});

async function authHarness(t) {
  await import('@angular/compiler');
  const [core, common, forms] = await Promise.all([import('@angular/core'), import('@angular/common'), import('@angular/forms')]);
  const { SignalStoreSelectors } = loadTypeScript('client/src/app/store/signal.store.selectors.ts', { '@angular/core': core });
  const { SignalStore } = loadTypeScript('client/src/app/store/signal.store.ts', {
    '@angular/core': core,
    './signal.store.selectors': { SignalStoreSelectors },
    '../services/api.service': { ApiService: class {} },
  });
  const selectors = new SignalStoreSelectors();
  const staleUser = { id: 'user-a', accessToken: require('node:crypto').randomBytes(16).toString('hex') };
  selectors.userState.update(state => ({ ...state, user: staleUser }));
  selectors.productState.update(state => ({ ...state, cart: { items: [] }, userOrders: [{}], order: {} }));
  const storage = () => {
    const values = new Map([['accessToken', staleUser.accessToken]]);
    return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key) };
  };
  for (const [key, value] of Object.entries({ window: {}, localStorage: storage(), sessionStorage: storage() })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  const signout = new Subject();
  const store = new SignalStore({ signOut: () => signout.asObservable(), clearGuestCartLocal() {},
    saveGuestCartLocal() {}, getCart: () => of({ items: [] }) }, selectors);
  const calls = [];
  const api = Object.fromEntries(['getPage', 'getMine', 'saveMine'].map(method => [method, (...args) => {
    const response = new Subject(); calls.push({ method, args, response }); return response.asObservable();
  }]));
  const navigations = [];
  const redirects = [];
  const router = { url: '/vi/product/product-a#reviews', navigate: (...args) => navigations.push(args), navigateByUrl: url => redirects.push(url) };
  const sharedMocks = {
    '@angular/core': core, '@angular/common': common, '@angular/forms': forms,
    '@angular/core/rxjs-interop': { toObservable: () => of(selectors.user()) },
    '@angular/router': { Router: class {}, RouterLink: class {}, ActivatedRoute: class {} },
  };
  const { ProductReviewsComponent } = loadTypeScript('client/src/app/user/shared/reviews/product-reviews.component.ts', {
    ...sharedMocks,
    '../../../services/product-reviews.service': { ProductReviewsApi: class {} },
    '../../../store/signal.store.selectors': { SignalStoreSelectors },
    '../../../store/signal.store': { SignalStore },
  });
  const component = new ProductReviewsComponent(api, selectors, router, 'browser', store);
  component.productId = 'product-a'; component.ngOnChanges();
  t.after(() => component.ngOnDestroy());
  const { SignInComponent } = loadTypeScript('client/src/app/user/pages/auth/signin/signin.component.ts', {
    ...sharedMocks,
    '../../../../store/signal.store': { SignalStore },
    '../../../../store/signal.store.selectors': { SignalStoreSelectors },
    '../../../../services/api.service': { ApiService: class {} },
    '../../../../services/translate.service': { TranslateService: class {} },
    '../../../../pipes/translate.pipe': { TranslatePipe: class {} },
    '@angular/material/input': { MatInputModule: class {} },
    '@angular/material/snack-bar': { MatSnackBar: class {}, MatSnackBarModule: class {} },
  });
  const signin = new SignInComponent({ getLang$: () => of('vi') }, store, selectors, {}, new forms.FormBuilder(), {}, router,
    { snapshot: { queryParams: { returnUrl: router.url } } });
  return { component, selectors, staleUser, signout, calls, navigations, redirects, signin,
    last(method) { return calls.filter(call => call.method === method).at(-1); } };
}

for (const source of ['getMine', 'saveMine']) {
  for (const signoutResult of ['success', 'error']) {
    test(`${source} 401 sign-in invalidates stale auth and reaches the existing form after signout ${signoutResult}`, async t => {
      const h = await authHarness(t);
      h.signin.ngOnInit();
      assert.deepEqual(h.redirects, ['/vi/product/product-a#reviews']);
      h.redirects.length = 0;
      if (source === 'saveMine') {
        h.last('getMine').response.next(mine());
        h.component.form.setValue({ rating: 4, comment: 'Bản nháp' });
        h.component.submit();
      }
      h.last(source).response.error({ status: 401 });
      assert.equal(h.component.state.error.kind, 'auth');
      if (source === 'saveMine') assert.equal(h.component.state.draft.comment, 'Bản nháp');
      h.component.signIn();
      assert.equal(h.selectors.user() === null, true);
      assert.equal(globalThis.localStorage.getItem('accessToken'), null);
      assert.equal(globalThis.sessionStorage.getItem('accessToken'), null);
      assert.equal(h.selectors.productState().userOrders, null);
      assert.equal(h.navigations.length, 0);
      h.component.signIn();
      assert.equal(h.navigations.length, 0);
      if (signoutResult === 'success') h.signout.next({ success: true });
      else h.signout.error({ status: 500 });
      assert.deepEqual(h.navigations, [[['/', 'vi', 'authorize', 'signin'],
        { queryParams: { returnUrl: '/vi/product/product-a#reviews' } }]]);
      h.signin.ngOnInit();
      assert.deepEqual(h.redirects, []);
      assert.equal(h.signin.signInForm.valid, false);
    });
  }
}

test('a late 401 action does not invalidate a newer authenticated session', async t => {
  const h = await authHarness(t);
  h.last('getMine').response.error({ status: 401 });
  const newerUser = { id: 'user-a', accessToken: require('node:crypto').randomBytes(16).toString('hex') };
  h.selectors.userState.update(state => ({ ...state, user: newerUser }));
  globalThis.localStorage.setItem('accessToken', newerUser.accessToken);
  globalThis.sessionStorage.setItem('accessToken', newerUser.accessToken);
  h.last('getPage').response.next(page());
  h.component.signIn();
  assert.equal(h.selectors.user() === newerUser, true);
  assert.equal(h.signout.observed, false);
});

test('signout completion after a newer login does not redirect that session', async t => {
  const h = await authHarness(t);
  h.last('getMine').response.error({ status: 401 });
  h.component.signIn();
  const newerUser = { id: 'user-b' };
  h.selectors.userState.update(state => ({ ...state, user: newerUser }));
  h.signout.next({ success: true });
  assert.equal(h.selectors.user() === newerUser, true);
  assert.deepEqual(h.navigations, []);
});

for (const source of ['getMine', 'saveMine']) {
  for (const replaceUser of [true, false]) {
    test(`delayed ${source} 401 preserves a replacement same-user credential before delivery (replaceUser=${replaceUser})`, async t => {
      const h = await authHarness(t);
      if (source === 'saveMine') {
        h.last('getMine').response.next(mine());
        h.component.form.setValue({ rating: 4, comment: 'Bản nháp' });
        h.component.submit();
      }
      const currentUser = replaceUser ? { id: 'user-a' } : h.staleUser;
      const freshCredential = require('node:crypto').randomBytes(16).toString('hex');
      h.selectors.userState.update(state => ({ ...state, user: currentUser }));
      globalThis.localStorage.setItem('accessToken', freshCredential);
      globalThis.sessionStorage.setItem('accessToken', freshCredential);
      h.last(source).response.error({ status: 401 });
      assert.equal(h.component.state.error.kind, 'auth');
      h.component.signIn();
      assert.equal(h.selectors.user() === currentUser, true);
      assert.equal(globalThis.localStorage.getItem('accessToken') === freshCredential, true);
      assert.equal(globalThis.sessionStorage.getItem('accessToken') === freshCredential, true);
      assert.equal(h.signout.observed, false);
    });
  }
}

test('a profile refresh with the same rejected credential still allows 401 sign-in recovery', async t => {
  const h = await authHarness(t);
  h.selectors.userState.update(state => ({ ...state, user: { _id: 'user-a' } }));
  h.last('getMine').response.error({ status: 401 });
  h.component.signIn();
  assert.equal(h.selectors.user() === null, true);
  assert.equal(h.signout.observed, true);
});

test('PUT captures its own rejected credential after the initial eligibility request used another session', async t => {
  const h = await authHarness(t);
  h.last('getMine').response.next(mine());
  const currentUser = { _id: 'user-a' };
  const currentCredential = require('node:crypto').randomBytes(16).toString('hex');
  h.selectors.userState.update(state => ({ ...state, user: currentUser }));
  globalThis.localStorage.setItem('accessToken', currentCredential);
  globalThis.sessionStorage.setItem('accessToken', currentCredential);
  h.component.form.setValue({ rating: 4, comment: 'Bản nháp' });
  h.component.submit();
  h.last('saveMine').response.error({ status: 401 });
  h.component.signIn();
  assert.equal(h.selectors.user() === null, true);
  assert.equal(h.signout.observed, true);
});

test('signout completion after reviews are destroyed does not navigate', async t => {
  const h = await authHarness(t);
  h.last('getMine').response.error({ status: 401 });
  h.component.signIn();
  h.component.ngOnDestroy();
  h.signout.next({ success: true });
  assert.deepEqual(h.navigations, []);
});
