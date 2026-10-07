const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true });
require('ts-node/register/transpile-only');
const { ProductsService } = require('../src/products/products.service.ts');

function createSearchService() {
  let capturedQuery;
  const service = new ProductsService(
    {
      paginate: async (query) => {
        capturedQuery = query;
        return { all: [], products: [], pagination: { page: 1, pages: 0, total: 0 } };
      },
    },
    {},
    { find: () => ({ lean: async () => [] }) },
  );
  return { service, getQuery: () => capturedQuery };
}

test('Vietnamese keyword tokens match accented product titles while a no-result response stays filtered', async () => {
  const { service, getQuery } = createSearchService();
  const result = await service.getProducts({ search: 'dam do', page: '1', sort: 'newest' }, 'vi');
  const query = getQuery();
  const tokenConditions = query.$or.find((condition) => Array.isArray(condition.$and)).$and;
  const title = 'Đầm đỏ';

  assert.equal(tokenConditions.length, 2);
  for (const condition of tokenConditions) {
    assert.equal(condition.$or.some((fieldCondition) => fieldCondition['vi.title']?.test(title)), true);
  }
  assert.equal(result.all.length, 0);
  assert.ok(query.$or);
});

test('empty keyword intentionally creates an unfiltered product query', async () => {
  const { service, getQuery } = createSearchService();
  await service.getProducts({ search: '   ', page: '1', sort: 'newest' }, 'vi');

  assert.equal(Object.prototype.hasOwnProperty.call(getQuery(), '$or'), false);
});

function matchesQuery(document, query) {
  return Object.entries(query).every(([field, condition]) => {
    if (field === '$and') return condition.every((part) => matchesQuery(document, part));
    if (field === '$or') return condition.some((part) => matchesQuery(document, part));
    const value = field.split('.').reduce((current, key) => current?.[key], document);
    if (condition instanceof RegExp) return condition.test(String(value ?? ''));
    if (condition === null || typeof condition !== 'object') return value === condition;
    return Object.entries(condition).every(([operator, expected]) => {
      if (operator === '$ne') return value !== expected;
      if (operator === '$gte') return value >= expected;
      if (operator === '$lt') return value < expected;
      throw new Error(`Unsupported fixture operator: ${operator}`);
    });
  });
}

for (const [name, filters] of [
  ['stock', { stock: 'onStock' }],
  ['multiple categories', { category: 'dresses,shirts' }],
  ['multiple rating tiers', { rating: '4,5' }],
  ['all filters together', { stock: 'onStock', category: 'dresses,shirts', rating: '4,5' }],
]) {
  test(`keyword remains required alongside ${name}`, async () => {
    const { service, getQuery } = createSearchService();
    await service.getProducts({ search: 'dam do', page: '1', ...filters }, 'vi');
    const matching = { vi: { title: 'Đầm đỏ', stock: 'onStock' }, tags: 'dresses', rating: 4.5 };
    const unrelated = { ...matching, vi: { ...matching.vi, title: 'Áo xanh' } };

    assert.equal(matchesQuery(matching, getQuery()), true);
    assert.equal(matchesQuery(unrelated, getQuery()), false, 'filters must not replace the keyword');
    if (filters.stock) assert.equal(matchesQuery({ ...matching, vi: { ...matching.vi, stock: 'out' } }, getQuery()), false);
    if (filters.category) assert.equal(matchesQuery({ ...matching, tags: 'accessories' }, getQuery()), false);
    if (filters.rating) assert.equal(matchesQuery({ ...matching, rating: 2 }, getQuery()), false);
  });
}
