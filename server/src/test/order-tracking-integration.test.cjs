const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Types } = mongoose;

const { ChatbotService } = require('../../dist/chat/services/chatbot.service');
const { ChatbotIntentService } = require('../../dist/chat/services/chatbot-intent.service');
const { ChatbotModerationService } = require('../../dist/chat/services/chatbot-moderation.service');

describe('Order Tracking - End-to-End Verification Suite', () => {
  const userA_Id = '6543216e246944e8a8677c01';
  const userB_Id = '6543216e246944e8a8677c02';

  const mockDatabaseOrders = [
    {
      _id: new Types.ObjectId('6543216e246944e8a8677a01'),
      orderId: 'CHERI-1001',
      _user: new Types.ObjectId(userA_Id),
      userId: userA_Id,
      status: 'DELIVERED',
      totalAmount: 550000,
      createdAt: new Date('2026-10-01T10:00:00Z'),
      items: [
        { productSnapshot: { name: 'Đầm Xòe Hoa', image: '/uploads/dam-xoe.jpg' }, quantity: 1, unitPrice: 550000 },
      ],
    },
    {
      _id: new Types.ObjectId('6543216e246944e8a8677a02'),
      orderId: 'CHERI-1002',
      _user: new Types.ObjectId(userA_Id),
      userId: userA_Id,
      status: 'SHIPPING',
      totalAmount: 1250000,
      createdAt: new Date('2026-10-20T14:30:00Z'),
      items: [
        { image: '/uploads/ao-yem.jpg', name: 'Áo Yếm Lụa', quantity: 2, unitPrice: 625000 },
      ],
    },
    {
      _id: new Types.ObjectId('6543216e246944e8a8677b01'),
      orderId: 'CHERI-2001',
      _user: new Types.ObjectId(userB_Id),
      userId: userB_Id,
      status: 'PROCESSING',
      totalAmount: 890000,
      createdAt: new Date('2026-10-18T09:00:00Z'),
      items: [
        { image: '/uploads/dam-da-hoi.jpg', name: 'Đầm Dạ Hội', quantity: 1, unitPrice: 890000 },
      ],
    },
  ];

  // Helper to create a ChatbotService with MongoDB collection simulation
  function createService(options = {}) {
    const mockOrderModel = {
      find: (filter) => ({
        sort: (sortObj) => ({
          limit: (limitCount) => ({
            lean: async () => {
              const conditions = filter.$or || [];
              const matched = mockDatabaseOrders.filter((ord) => {
                return conditions.some((cond) => {
                  if (cond._user !== undefined) {
                    const cUser = cond._user;
                    if (cUser instanceof Types.ObjectId) {
                      return ord._user.equals(cUser);
                    }
                    return String(ord._user) === String(cUser) || ord.userId === cUser;
                  }
                  if (cond.userId !== undefined) {
                    return ord.userId === String(cond.userId);
                  }
                  return false;
                });
              });

              // Sort descending by createdAt
              matched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
              return matched.slice(0, limitCount);
            },
          }),
        }),
      }),
    };

    return new ChatbotService(
      mockOrderModel,
      new ChatbotModerationService(),
      new ChatbotIntentService(),
      {
        findRelevantPolicy: async () => ({
          title: 'Chính sách đổi trả',
          routeLink: '/vi/cheri/return-policy',
          isAvailable: true,
        }),
      },
      {
        parseCriteriaFromText: (text) => ({ text, garmentType: 'ao-yem' }),
        searchProductsWithCriteria: async () => [
          { id: 'prod_yem', title: 'Áo Yếm Cách Tân Chéri', price: 450000, image: '/uploads/yem.jpg' },
        ],
        checkRealtimeStock: async () => true,
        searchProducts: async () => [
          { id: 'prod_yem', title: 'Áo Yếm Cách Tân Chéri', price: 450000, image: '/uploads/yem.jpg' },
        ],
        buildVerifiedProductCard: async (p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          thumbnailUrl: p.image,
          inStock: true,
        }),
      },
      {
        getOrCreateSession: async () => ({ sessionId: 'sess_test_123', messages: [], context: {} }),
        appendMessage: async () => {},
      },
      {
        generateResponse: async () => {
          if (options.throwGeminiError) {
            throw new Error('Gemini API Error: 503 Service Unavailable');
          }
          return '';
        },
      },
    );
  }

  // 1. Unauthenticated guest -> Prompts login
  test('1. Unauthenticated guest prompts login with requiresAuth=true', async () => {
    const service = createService();
    const res = await service.processMessage({ message: 'Kiểm tra tình trạng đơn hàng của mình' }, null);

    assert.equal(res.intent, 'order_tracking');
    assert.equal(res.requiresAuth, true);
    assert.equal(res.reply, '✨Bạn vui lòng đăng nhập để xem và theo dõi đơn hàng của mình nhé!✨');
    assert.equal(res.orders, undefined);
  });

  // 2. Authenticated user with no orders -> Friendly empty message
  test('2. Authenticated user with no orders receives friendly empty notification', async () => {
    const service = createService();
    const res = await service.processMessage(
      { message: 'Kiểm tra tình trạng đơn hàng của mình' },
      { _id: '6543216e246944e8a8677c99' }, // user without orders
    );

    assert.equal(res.intent, 'order_tracking');
    assert.equal(res.requiresAuth, undefined);
    assert.equal(res.reply, '✨Bạn chưa có đơn hàng nào tại Chéri. Cùng khám phá những sản phẩm xinh xắn nhé!✨');
    assert.deepEqual(res.orders, []);
  });

  // 3. Authenticated user with string ID matches BSON ObjectId in MongoDB
  test('3. Authenticated user string ID matches BSON ObjectId and retrieves correct orders', async () => {
    const service = createService();
    // User A has string _id
    const res = await service.processMessage(
      { message: 'Kiểm tra tình trạng đơn hàng của mình' },
      { _id: userA_Id },
    );

    assert.equal(res.intent, 'order_tracking');
    assert.equal(Array.isArray(res.orders), true);
    assert.equal(res.orders.length, 2, 'User A should have exactly 2 orders');
    // Orders should NOT leak User B's order
    assert.ok(res.orders.every((o) => o.orderId !== 'CHERI-2001'), 'Must not contain User B orders');
  });

  // 4. Multiple orders are sorted newest first
  test('4. Multiple orders are sorted newest first (createdAt descending)', async () => {
    const service = createService();
    const res = await service.processMessage(
      { message: 'Kiểm tra tình trạng đơn hàng của mình' },
      { _id: userA_Id },
    );

    assert.equal(res.orders[0].orderId, 'CHERI-1002', '2026-10-20 order must come before 2026-10-01');
    assert.equal(res.orders[1].orderId, 'CHERI-1001');
    assert.equal(res.orders[0].statusText, 'Đang giao hàng');
    assert.equal(res.orders[0].totalAmount, 1250000);
    assert.equal(res.orders[0].thumbnailUrl, '/uploads/ao-yem.jpg');
    assert.equal(res.orders[0].itemsCount, 1);
    assert.equal(res.orders[0].firstItemName, 'Áo Yếm Lụa');
    assert.equal(res.orders[0].totalQuantity, 2);
  });

  // 5. Quick action action: 'CHECK_MY_ORDERS' routes deterministically
  test('5. Quick action action: CHECK_MY_ORDERS routes deterministically without Gemini', async () => {
    const service = createService({ throwGeminiError: true }); // Gemini is broken
    const res = await service.processMessage(
      { message: 'Tra cứu đơn hàng', action: 'CHECK_MY_ORDERS' },
      { _id: userA_Id },
    );

    assert.equal(res.intent, 'order_tracking');
    assert.equal(res.orders.length, 2);
    assert.equal(res.orders[0].orderId, 'CHERI-1002');
  });

  // 6. Natural language queries do not false-positive as order code
  test('6. Natural language questions ("Đơn hàng của mình tới đâu rồi?") return order list, not "không tìm thấy mã"', async () => {
    const service = createService();
    const queries = [
      'Đơn hàng của mình tới đâu rồi?',
      'Bạn kiểm tra giúp mình đơn hàng mới đặt nhé',
      'Cho mình xem các đơn hàng của tôi',
    ];

    for (const q of queries) {
      const res = await service.processMessage({ message: q }, { _id: userA_Id });
      assert.equal(res.intent, 'order_tracking');
      assert.equal(
        res.reply,
        '✨Đây là danh sách đơn hàng của bạn tại Chéri. Hãy chọn một đơn hàng để xem chi tiết và theo dõi tình trạng nhé!✨',
        `Query "${q}" should return orders list`,
      );
      assert.equal(res.orders.length, 2);
    }
  });

  // 7. Query with specific owned order code CHERI-1001 returns that specific order card
  test('7. Specific owned order code query returns exact order card', async () => {
    const service = createService();
    const res = await service.processMessage(
      { message: 'Xem tình trạng đơn CHERI-1001' },
      { _id: userA_Id },
    );

    assert.equal(res.intent, 'order_tracking');
    assert.equal(res.orders.length, 1);
    assert.equal(res.orders[0].orderId, 'CHERI-1001');
    assert.match(res.reply, /#CHERI-1001/);
  });

  // 8. Query with code of another user is safely rejected
  test('8. Query with code of another user is safely rejected without leaking', async () => {
    const service = createService();
    // User A queries User B's order CHERI-2001
    const res = await service.processMessage(
      { message: 'Kiểm tra đơn hàng CHERI-2001' },
      { _id: userA_Id },
    );

    assert.equal(res.intent, 'order_tracking');
    assert.equal(
      res.reply,
      'Chéri không tìm thấy đơn hàng nào có mã này thuộc tài khoản của bạn. Nàng kiểm tra lại mã đơn hoặc truy cập mục Đơn hàng của tôi nhé!',
    );
    assert.equal(res.orders, undefined);
  });

  // 9. Product search query "Tôi cần mua áo yếm" is not intercepted by order tracking
  test('9. Product search "Tôi cần mua áo yếm" is routed to product_search, not order_tracking', async () => {
    const service = createService();
    const res = await service.processMessage({ message: 'Tôi cần mua áo yếm' }, { _id: userA_Id });

    assert.equal(res.intent, 'product_search');
    assert.equal(res.orders, undefined);
    assert.ok(res.products && res.products.length > 0);
  });

  // 10. Store policy inquiry returns return policy relative link, not products or orders
  test('10. Store return policy inquiry returns relative link without domain or protocol', async () => {
    const service = createService();
    const res = await service.processMessage(
      { message: 'Chính sách đổi trả của Chéri như thế nào?' },
      { _id: userA_Id },
    );

    assert.equal(res.intent, 'policy_faq');
    assert.equal(res.orders, undefined);
    assert.equal(
      res.reply,
      'Dạ, nàng xem chính sách đổi trả của Chéri tại đây nhé: [Xem chính sách đổi trả](/vi/cheri/return-policy)',
    );
    assert.doesNotMatch(res.reply, /https?:\/\//i);
    assert.doesNotMatch(res.reply, /\/vi\/return-policy\b/);
  });
});
