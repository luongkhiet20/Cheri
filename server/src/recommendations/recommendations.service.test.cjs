const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

// Setup ts-node compiler
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
  experimentalDecorators: true,
  target: 'ES2022',
});
require('ts-node/register/transpile-only');

const { RecommendationsService } = require('./recommendations.service.ts');

// Create mock database storage
function createMockModels() {
  const products = [
    {
      _id: new ObjectId('6ab8f745547709e9279f68fc'),
      title: 'Đầm 2 Dây Xòe Zoey Dress',
      titleUrl: 'dam-2-day-xoe-zoey-dress',
      categoryLevel1: 'Đầm & Váy',
      regularPrice: 2090000,
      salePrice: 1814818,
      quantity: 50,
      visibility: true,
      variants: [],
    },
    {
      _id: new ObjectId('6ab8f745547709e9279f68fd'),
      title: 'Áo Corset Cổ Yếm Caro Đỏ',
      titleUrl: 'ao-corset-co-yem-caro-do',
      categoryLevel1: 'Áo',
      regularPrice: 1290000,
      salePrice: 1068000,
      quantity: 20,
      visibility: true,
      variants: [],
    },
    {
      _id: new ObjectId('6ab8f745547709e9279f68fe'),
      title: 'Đầm Cúp Ngực Trễ Vai Tua Rua',
      titleUrl: 'dam-cup-nguc-tre-vai-tua-rua',
      categoryLevel1: 'Đầm & Váy',
      regularPrice: 950000,
      salePrice: 783750,
      quantity: 15,
      visibility: true,
      variants: [],
    },
    {
      _id: new ObjectId('6ab8f746547709e9279f68ff'),
      title: 'Set Áo Corset + Chân Váy Enal',
      titleUrl: 'set-ao-corset-chan-vay-enal',
      categoryLevel1: 'Set trang phục',
      regularPrice: 1450000,
      salePrice: 1254000,
      quantity: 10,
      visibility: true,
      variants: [],
    },
    {
      _id: new ObjectId('6ab8f746547709e9279f6901'),
      title: 'Đầm Maxi Đi Tiệc Zoey Luxury',
      titleUrl: 'dam-maxi-di-tiec-zoey-luxury',
      categoryLevel1: 'Đầm & Váy',
      regularPrice: 2500000,
      salePrice: 2200000,
      quantity: 30,
      visibility: true,
      variants: [],
    },
    {
      _id: new ObjectId('6ab8f746547709e9279f6900'),
      title: 'Sản Phẩm Đã Bị Ẩn (Hidden Item)',
      titleUrl: 'san-pham-da-bi-an',
      categoryLevel1: 'Đầm & Váy',
      regularPrice: 500000,
      salePrice: 500000,
      quantity: 100,
      visibility: false, // ẨN KHỎI SHOP
      variants: [],
    },
  ];

  class MockProductModel {
    findById(id) {
      const match = products.find((p) => p._id.toString() === id.toString());
      return {
        lean: () => Promise.resolve(match || null),
      };
    }

    findOne(query) {
      const match = products.find((p) => {
        if (query.titleUrl && p.titleUrl !== query.titleUrl) return false;
        return true;
      });
      return {
        lean: () => Promise.resolve(match || null),
      };
    }

    find(query) {
      let filtered = [...products];

      // Handle visibility
      if (query.visibility && query.visibility.$ne === false) {
        filtered = filtered.filter((p) => p.visibility !== false);
      }

      // Handle $in for _id
      if (query._id && query._id.$in) {
        const idSet = new Set(query._id.$in.map((id) => id.toString()));
        filtered = filtered.filter((p) => idSet.has(p._id.toString()));
      }

      // Handle $ne for _id
      if (query._id && query._id.$ne) {
        filtered = filtered.filter((p) => p._id.toString() !== query._id.$ne.toString());
      }

      // Handle category matching
      if (query.$or) {
        const catConditions = query.$or;
        filtered = filtered.filter((p) => {
          return catConditions.some((cond) => {
            if (cond.categoryLevel1) {
              return p.categoryLevel1 === cond.categoryLevel1;
            }
            return false;
          });
        });
      }

      return {
        sort: () => ({
          limit: (n) => ({
            lean: () => Promise.resolve(filtered.slice(0, n)),
          }),
          lean: () => Promise.resolve(filtered),
        }),
        limit: (n) => ({
          lean: () => Promise.resolve(filtered.slice(0, n)),
        }),
        lean: () => Promise.resolve(filtered),
      };
    }
  }

  class MockProductVariantModel {
    find() {
      return {
        lean: () => Promise.resolve([]),
      };
    }
  }

  return {
    mockProductModel: new MockProductModel(),
    mockProductVariantModel: new MockProductVariantModel(),
    products,
  };
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

test('1. API trả gợi ý phổ biến khi không truyền sản phẩm hiện tại (fallback_popularity)', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  const res = await service.getRecommendations({ limit: 3 });

  assert.equal(res.status, 'fallback');
  assert.equal(res.strategy, 'fallback_popularity');
  assert.equal(res.isMachineLearning, false);
  assert.equal(res.modelUsed, 'None');
  assert.equal(res.products.length, 3);
  // Tất cả sản phẩm trả về phải có trường title, salePrice, regularPrice
  assert.ok(res.products[0].title);
  assert.ok(res.products[0].salePrice);
});

test('2. API trả gợi ý cùng danh mục khi truyền ID sản phẩm hiện tại (fallback_category)', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  // Xem 'Đầm 2 Dây Xòe Zoey Dress' (thuộc danh mục 'Đầm & Váy')
  const currentId = '6ab8f745547709e9279f68fc';
  const res = await service.getRecommendations({ productId: currentId, limit: 2 });

  assert.equal(res.status, 'fallback');
  assert.equal(res.strategy, 'fallback_category');
  assert.equal(res.isMachineLearning, false);
  assert.equal(res.currentProductId, currentId);
  assert.ok(res.products.length > 0);

  // Sản phẩm trả về phải cùng danh mục 'Đầm & Váy'
  for (const prod of res.products) {
    assert.equal(prod.categoryLevel1, 'Đầm & Váy');
  }
});

test('3. Không bao giờ trả lại chính sản phẩm hiện tại trong danh sách gợi ý', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  const currentId = '6ab8f745547709e9279f68fc';
  const res = await service.getRecommendations({ productId: currentId, limit: 5 });

  const resultIds = res.products.map((p) => p._id.toString());
  assert.equal(resultIds.includes(currentId), false);
});

test('4. Không trả sản phẩm đã bị xóa hoặc bị ẩn (visibility: false)', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  const res = await service.getRecommendations({ limit: 10 });
  const hiddenId = '6ab8f746547709e9279f6900';

  const resultIds = res.products.map((p) => p._id.toString());
  assert.equal(resultIds.includes(hiddenId), false);
});

test('5. Xử lý an toàn khi ID sản phẩm không hợp lệ hoặc không tồn tại (chuyển sang Popularity an toàn)', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  // ID hoàn toàn bịa đặt
  const nonExistentId = new ObjectId().toString();
  const res = await service.getRecommendations({ productId: nonExistentId, limit: 3 });

  // Vẫn trả về thành công với Popularity fallback, không ném 500 hay crash hệ thống
  assert.equal(res.strategy, 'fallback_popularity');
  assert.equal(res.products.length, 3);
});

test('6. Xử lý an toàn khi môi trường không có Python (Native Fallback hoạt động độc lập 100%)', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  // Mock resolvePythonExecutable trả về null (như trên Vercel Serverless)
  service.resolvePythonExecutable = () => null;

  const res = await service.getRecommendations({ limit: 2 });
  assert.equal(res.status, 'fallback');
  assert.equal(res.strategy, 'fallback_popularity');
  assert.equal(res.isMachineLearning, false);
  assert.equal(res.products.length, 2);
});

test('7. Không nhận vơ mô hình sandbox là Machine Learning trong production', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  // Giả sử CLI trả về mô hình sandbox chưa sẵn sàng
  service.invokePythonCLI = async () => ({
    status: 'success',
    strategy: 'fallback_popularity',
    model_used: 'None',
    count: 2,
    recommendations: [
      { product_id: '6ab8f745547709e9279f68fd' },
      { product_id: '6ab8f745547709e9279f68fe' },
    ],
  });

  const res = await service.getRecommendations({ limit: 2 });
  assert.equal(res.strategy, 'fallback_popularity');
  assert.equal(res.isMachineLearning, false);
  assert.equal(res.modelUsed, 'None');
});

test('8. Giới hạn số lượng sản phẩm trả về tuân thủ tham số limit', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  const res = await service.getRecommendations({ limit: 2 });
  assert.equal(res.products.length, 2);
  assert.equal(res.count, 2);
});

test('9. Khi có mô hình ML production hợp lệ, gắn nhãn strategy=ml_model và isMachineLearning=true', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  service.invokePythonCLI = async () => ({
    status: 'success',
    strategy: 'ml_model',
    model_used: 'RandomForest',
    count: 2,
    recommendations: [
      { product_id: '6ab8f745547709e9279f68fd', score: 0.88 },
      { product_id: '6ab8f745547709e9279f68fe', score: 0.82 },
    ],
  });

  const res = await service.getRecommendations({ limit: 2 });
  assert.equal(res.status, 'success');
  assert.equal(res.strategy, 'ml_model');
  assert.equal(res.isMachineLearning, true);
  assert.equal(res.modelUsed, 'RandomForest');
  assert.equal(res.products.length, 2);
});

test('10. Khi tiến trình Python ném lỗi hoặc timeout (trả null), Native Fallback tự động thế chỗ', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  // Giả lập Python crash hoặc timeout
  service.invokePythonCLI = async () => null;

  const res = await service.getRecommendations({ limit: 3 });
  assert.equal(res.status, 'fallback');
  assert.equal(res.strategy, 'fallback_popularity');
  assert.equal(res.isMachineLearning, false);
  assert.equal(res.products.length, 3);
});

test('11. Khi sử dụng mô hình bootstrap được kích hoạt server-side, trả về strategy=ml_bootstrap_model, isMachineLearning=true và modelUsed=RandomForestBootstrap', async () => {
  const { mockProductModel, mockProductVariantModel } = createMockModels();
  const service = new RecommendationsService(mockProductModel, mockProductVariantModel);

  service.invokePythonCLI = async () => ({
    status: 'success',
    strategy: 'ml_bootstrap_model',
    model_used: 'RandomForestBootstrap',
    is_bootstrap: true,
    data_source: 'ml_bootstrap_interactions',
    count: 2,
    recommendations: [
      { product_id: '6ab8f745547709e9279f68fd', score: 0.95 },
      { product_id: '6ab8f745547709e9279f68fe', score: 0.72 },
    ],
  });

  const res = await service.getRecommendations({ limit: 2 });
  assert.equal(res.status, 'success');
  assert.equal(res.strategy, 'ml_bootstrap_model');
  assert.equal(res.isMachineLearning, true);
  assert.equal(res.modelUsed, 'RandomForestBootstrap');
  assert.equal(res.dataSource, 'ml_bootstrap_interactions');
  assert.equal(res.products.length, 2);
  // Xác minh thứ tự sản phẩm phản ánh đúng ranking của mô hình ML
  assert.equal(res.products[0]._id.toString(), '6ab8f745547709e9279f68fd');
  assert.equal(res.products[1]._id.toString(), '6ab8f745547709e9279f68fe');
});

