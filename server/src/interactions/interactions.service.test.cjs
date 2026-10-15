const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Mock User Model & Types
const { ObjectId } = mongoose.Types;

class MockProductModel {
  constructor(existingIds = []) {
    this.existingIds = new Set(existingIds.map(id => id.toString()));
  }
  async exists(query) {
    const id = query._id ? query._id.toString() : '';
    return this.existingIds.has(id);
  }
}

class MockInteractionModel {
  constructor() {
    this.storage = [];
  }
  findOne(query) {
    return {
      lean: async () => {
        return this.storage.find(doc => {
          if (query.productId && doc.productId.toString() !== query.productId.toString()) return false;
          if (query.userId && (!doc.userId || doc.userId.toString() !== query.userId.toString())) return false;
          if (query.sessionId && doc.sessionId !== query.sessionId) return false;
          if (query.timestamp && query.timestamp.$gte && doc.timestamp < query.timestamp.$gte) return false;
          return true;
        }) || null;
      }
    };
  }
  async create(doc) {
    const created = {
      _id: new ObjectId(),
      ...doc,
      timestamp: doc.timestamp || new Date(),
    };
    this.storage.push(created);
    return created;
  }
}

// Import InteractionsService logic
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
  experimentalDecorators: true,
  target: 'ES2022',
});
require('ts-node/register/transpile-only');
const { InteractionsService } = require('./interactions.service.ts');

const validProdId1 = new ObjectId();
const validProdId2 = new ObjectId();
const uncataloguedProdId = new ObjectId();

function setupService() {
  const mockProductModel = new MockProductModel([validProdId1, validProdId2]);
  const mockInteractionModel = new MockInteractionModel();
  const service = new InteractionsService(mockInteractionModel, mockProductModel);
  return { service, mockInteractionModel };
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

test('1. Ghi nhận lượt xem thành công cho người dùng đã đăng nhập', async () => {
  const { service, mockInteractionModel } = setupService();
  const loggedInUser = { _id: new ObjectId(), email: 'real_customer@gmail.com', name: 'Nguyen Van A' };

  const result = await service.recordView(
    { productId: validProdId1.toString(), eventType: 'VIEW' },
    loggedInUser,
    { id: 'sess_123' },
    'guest_cart_abc',
    'Mozilla/5.0 (Windows NT 10.0)'
  );

  assert.equal(result.success, true);
  assert.equal(result.isGuest, false);
  assert.equal(result.isSynthetic, false);
  assert.equal(result.userId.toString(), loggedInUser._id.toString());
  assert.equal(result.productId.toString(), validProdId1.toString());

  // Xác minh document trong database không chứa email, name hay PII
  const saved = mockInteractionModel.storage[0];
  assert.equal(saved.isSynthetic, false);
  assert.equal(saved.metadata.isSynthetic, false);
  assert.equal(saved.metadata.email, undefined);
  assert.equal(saved.metadata.phone, undefined);
});

test('2. Ghi nhận lượt xem ẩn danh cho khách vãng lai (không tự tạo tài khoản giả)', async () => {
  const { service, mockInteractionModel } = setupService();

  const result = await service.recordView(
    { productId: validProdId2.toString(), eventType: 'VIEW', sessionId: 'cheri_guest_9988' },
    null, // Không đăng nhập
    { id: 'express_sess_456' },
    'cheri_guest_9988',
    'Mozilla/5.0'
  );

  assert.equal(result.success, true);
  assert.equal(result.isGuest, true);
  assert.equal(result.userId, null);
  assert.equal(result.isSynthetic, false);

  const saved = mockInteractionModel.storage[0];
  assert.equal(saved.userId, null);
  assert.equal(saved.sessionId, 'cheri_guest_9988');
  assert.equal(saved.isSynthetic, false);
});

test('3. Từ chối productId không đúng định dạng ObjectId (ném BadRequestException)', async () => {
  const { service } = setupService();

  await assert.rejects(
    async () => {
      await service.recordView({ productId: 'invalid-sku-12345' }, null, {});
    },
    (err) => {
      assert.match(err.message, /ObjectId/i);
      return true;
    }
  );
});

test('4. Từ chối productId hợp lệ nhưng không tồn tại trong Catalog (ném NotFoundException)', async () => {
  const { service } = setupService();

  await assert.rejects(
    async () => {
      await service.recordView({ productId: uncataloguedProdId.toString() }, null, {});
    },
    (err) => {
      assert.match(err.message, /không tồn tại/i);
      return true;
    }
  );
});

test('5. Bảo vệ cờ dữ liệu: Client cố tình gửi isSynthetic=true vẫn bị ép thành false', async () => {
  const { service, mockInteractionModel } = setupService();

  const result = await service.recordView(
    { productId: validProdId1.toString(), eventType: 'VIEW', isSynthetic: true }, // Client gửi lừa đảo
    null,
    {},
    'guest_session_safe'
  );

  assert.equal(result.isSynthetic, false);
  const saved = mockInteractionModel.storage[0];
  assert.equal(saved.isSynthetic, false);
  assert.equal(saved.metadata.isSynthetic, false);
});

test('6. Deduplication kỹ thuật: Tránh spam khi nhấn liên tục trong vòng 2 giây', async () => {
  const { service, mockInteractionModel } = setupService();
  const user = { _id: new ObjectId() };

  // Lần click 1
  const res1 = await service.recordView({ productId: validProdId1.toString() }, user, {});
  // Lần click 2 ngay lập tức (< 2s)
  const res2 = await service.recordView({ productId: validProdId1.toString() }, user, {});

  assert.equal(mockInteractionModel.storage.length, 1, 'Chỉ được phép lưu 1 document duy nhất');
  assert.equal(res2.message.includes('deduplicated'), true);
});
