const assert = require('node:assert/strict');
const test = require('node:test');
const { Subject, BehaviorSubject } = require('rxjs');
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
