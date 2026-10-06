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
