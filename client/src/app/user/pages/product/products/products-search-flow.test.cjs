const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
  experimentalDecorators: true,
  target: 'ES2022',
});
require('ts-node/register/transpile-only');
require('@angular/compiler');
const { ProductsComponent } = require('./products.component.ts');
const { SearchModalComponent } = require('../../../shared/search-modal/search-modal.component.ts');

function testSignal(initialValue) {
  let value = initialValue;
  const read = () => value;
  read.set = (nextValue) => { value = nextValue; };
  return read;
}

function routeComponent(queryParams = {}) {
  const component = Object.create(ProductsComponent.prototype);
  component.selectedCategories = testSignal([]);
  component.selectedRatings = testSignal([]);
  component.searchQuery = testSignal('đầm đỏ');
  component.isImageSearch = testSignal(false);
  component.productIdsFilter = testSignal('');
  component.filterRating = testSignal(0);
  component.filterStock = testSignal('all');
  component.filterPrice = testSignal(0);
  component.filterMinPrice = testSignal(0);
  component.category = testSignal('');
  component.lang = testSignal('vi');
  component.page = testSignal(3);
  component.sortBy = testSignal('newest');
  component.route = { snapshot: { queryParams } };
  component.store = { updatePosition: () => undefined };
  component.cdr = { markForCheck: () => undefined };
  component.router = { navigate: () => undefined };
  return component;
}

test('removing a category from a category route preserves the active keyword query', () => {
  const component = Object.create(ProductsComponent.prototype);
  const navigations = [];
  component.selectedCategories = testSignal(['dresses']);
  component.category = testSignal('dresses');
  component.lang = testSignal('vi');
  component.sortBy = testSignal('newest');
  component.route = { snapshot: { queryParams: { search: 'đầm đỏ', page: '3', stock: 'onStock' } } };
  component.router = { navigate: (...args) => { navigations.push(args); } };
  component.store = { updatePosition: () => undefined };

  component.removeCategoryFilter('dresses');

  assert.deepEqual(navigations[0][1].queryParams, {
    search: 'đầm đỏ',
    page: 1,
    stock: 'onStock',
    sort: 'newest',
  });
});

test('pagination and sorting retain the keyword and supported query filters', () => {
  const queryParams = { search: 'đầm đỏ', stock: 'onStock', page: '3', sort: 'newest' };
  const pageComponent = routeComponent(queryParams);
  let pageNavigation;
  pageComponent.router.navigate = (...args) => { pageNavigation = args; };
  pageComponent.changePage(4);
  assert.deepEqual(pageNavigation[1].queryParams, { ...queryParams, page: 4, sort: 'newest' });

  const sortComponent = routeComponent(queryParams);
  let sortNavigation;
  sortComponent.router.navigate = (...args) => { sortNavigation = args; };
  sortComponent.changeSort('price-asc');
  assert.deepEqual(sortNavigation[1].queryParams, { ...queryParams, page: 3, sort: 'price-asc' });
});

test('clear-search removes keyword/image parameters and requests an unfiltered first page', () => {
  const component = routeComponent({
    search: 'đầm đỏ',
    imageSearch: '1',
    productIds: 'p1,p2',
    page: '4',
    sort: 'price-asc',
    stock: 'onStock',
  });
  const navigations = [];
  const requests = [];
  component.isImageSearch.set(true);
  component.productIdsFilter.set('p1,p2');
  component.filterStock.set('onStock');
  component.router.navigate = (...args) => { navigations.push(args); };
  component.store.getProducts = (request) => { requests.push(request); };

  component.clearSearch();

  assert.deepEqual(navigations[0][1].queryParams, { page: 1, sort: 'price-asc', stock: 'onStock' });
  assert.equal(requests[0].page, 1);
  assert.equal(requests[0].search, undefined);
  assert.equal(requests[0].productIds, undefined);
});

test('keyword modal preserves Vietnamese text while trimming and collapsing whitespace', () => {
  const component = Object.create(SearchModalComponent.prototype);
  let navigation;
  component.keyword = '  đầm   đỏ  ';
  component.selectedFile = null;
  component.currentLang = 'vi';
  component.errorMessage = '';
  component.close = { emit: () => undefined };
  component.router = { navigate: (...args) => { navigation = args; } };

  component.submitSearch();

  assert.equal(navigation[0][0], '/vi/product/all');
  assert.deepEqual(navigation[1].queryParams, { search: 'đầm đỏ', page: 1 });
});
