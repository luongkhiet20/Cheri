const test = require('node:test');
const assert = require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true, target: 'ES2022' });
require('ts-node/register/transpile-only');
require('@angular/compiler');
const { of } = require('rxjs');
const { SignalStore } = require('./signal.store.ts');
const { OrderComponent } = require('../user/pages/order/order.component.ts');

for (const method of ['makeOrder', 'makeOrderWithPayment']) {
  for (const pending of [true, false]) {
    test(`${method}: ${pending ? 'VNPAY preserves cart before payment' : 'COD completes checkout'}`, () => {
      const cart = { items: [{ id: 'selected' }, { id: 'unselected' }] };
      let state = { cart, order: null };
      let saved = 0;
      const response = { result: { orderId: 'ORDER1' }, ...(pending ? { payment: { provider: 'VNPAY', status: 'PENDING', paymentUrl: 'https://example.test' } } : {}) };
      const store = new SignalStore({
        makeOrder: () => of(response), handleToken: () => of(response),
        saveGuestCartLocal: () => saved++,
      }, { productState: { update: fn => { state = fn(state); } }, user: () => null }, {}, {});
      let callbackCount = 0;
      store[method]({}, result => { assert.equal(result, response); callbackCount++; });
      assert.equal(callbackCount, 1);
      assert.equal(state.loading, false);
      assert.equal(saved, pending ? 0 : 1);
      if (pending) {
        assert.equal(state.cart, cart);
        assert.equal(state.order, null);
      } else {
        assert.equal(state.order, response.result);
        assert.equal(state.cart.items.length, 0);
      }
    });
  }
}

test('bill distinguishes pending, failed, paid online payments and COD', () => {
  const component = Object.create(OrderComponent.prototype);
  for (const [method, status, title] of [
    ['VNPAY', 'PENDING', 'Đơn hàng chờ thanh toán'],
    ['VNPAY', 'FAILED', 'Thanh toán không thành công'],
    ['VNPAY', 'PAID', 'Đặt hàng thành công'],
    ['COD', 'PENDING', 'Đặt hàng thành công'],
  ]) {
    component.currentOrder = { payment: { method }, paymentStatus: status };
    assert.equal(component.confirmationTitle, title);
    if (method === 'COD') {
      assert.equal(component.getPaymentStatusText(status), 'Chưa thanh toán');
    }
  }
});

test('payment return ignores stale store and verifies order with server', () => {
  const component = Object.create(OrderComponent.prototype);
  component.cdr = { markForCheck: () => {} };
  component.route = { snapshot: { queryParamMap: new Map([['payment', 'success']]) } };
  component.orderSignal = () => ({ orderId: 'ORDER1', paymentStatus: 'PAID' });
  component.selectors = { user: () => ({ _id: 'USER1' }) };
  const confirmed = { orderId: 'ORDER1', payment: { method: 'VNPAY' }, paymentStatus: 'FAILED' };
  let fetched = false;
  component.apiService = { getOrder: () => { fetched = true; return of(confirmed); } };
  component.saveOrderToSession = () => {};
  component.resetScrollToTop = () => {};
  component.resolveOrderData('ORDER1');
  assert.equal(fetched, true);
  assert.equal(component.currentOrder, confirmed);
  assert.equal(component.confirmationTitle, 'Thanh toán không thành công');
});

test('guest tracking response retains pending VNPAY status on bill', () => {
  const { buildPublicTrackingResponse } = require('../../../../server/src/orders/tracking-response.cjs');
  const component = Object.create(OrderComponent.prototype);
  component.currentOrder = buildPublicTrackingResponse({
    orderId: 'ORDER1', payment: { method: 'VNPAY', status: 'PENDING' },
  });
  assert.equal(component.confirmationTitle, 'Đơn hàng chờ thanh toán');
  assert.equal(component.paymentMethodLabel, 'Thanh toán qua VNPAY');
});

test('missing payment metadata never displays COD', () => {
  const component = Object.create(OrderComponent.prototype);
  component.currentOrder = { paymentStatus: 'PAID' };
  assert.equal(component.paymentMethodLabel, 'Chưa xác định');
});
