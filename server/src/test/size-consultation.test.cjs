const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Import compiled services
const { ChatbotIntentService } = require('../../dist/chat/services/chatbot-intent.service');
const { ChatbotProductService } = require('../../dist/chat/services/chatbot-product.service');
const { ChatbotSessionService } = require('../../dist/chat/services/chatbot-session.service');
const { ChatbotModerationService } = require('../../dist/chat/services/chatbot-moderation.service');
const { ChatbotAiService } = require('../../dist/chat/services/chatbot-ai.service');
const { ChatbotService } = require('../../dist/chat/services/chatbot.service');

describe('Size Consultation Feature - Complete Multi-Turn & Verification Suite', () => {

  // Test 1: Intent Classification
  test('1. Intent classifier accurately categorizes size queries as size_consultation (not policy or search)', () => {
    const intentService = new ChatbotIntentService();

    assert.equal(
      intentService.classifyIntent('Hướng dẫn mình cách chọn size đầm chuẩn'),
      'size_consultation',
      'Generic size guide query must be classified as size_consultation',
    );

    assert.equal(
      intentService.classifyIntent('Mình cao 1m60, nặng 50kg thì mặc size gì?'),
      'size_consultation',
      'Height and weight query must be classified as size_consultation',
    );

    assert.equal(
      intentService.classifyIntent('Vòng eo mình 68cm'),
      'size_consultation',
      'Waist query must be classified as size_consultation',
    );

    assert.equal(
      intentService.classifyIntent('Mình thích mặc hơi rộng'),
      'size_consultation',
      'Fit preference query must be classified as size_consultation',
    );

    assert.equal(
      intentService.classifyIntent('Mẫu đầm này có size M không?'),
      'size_consultation',
      'Product size inquiry must be classified as size_consultation',
    );

    assert.equal(
      intentService.classifyIntent('Size M và L khác nhau thế nào?'),
      'size_consultation',
      'Size comparison query must be classified as size_consultation',
    );

    // Ensure exchange policy is still policy_faq
    assert.equal(
      intentService.classifyIntent('Chính sách đổi trả của Chéri như thế nào?'),
      'policy_faq',
      'Return policy must remain policy_faq',
    );

    assert.equal(
      intentService.classifyIntent('Mình muốn đổi size đầm'),
      'policy_faq',
      'Size exchange request must remain policy_faq',
    );
  });

  // Test 2: Size Consultation Handler produces rich, non-empty guide on general inquiry
  test('2. "Hướng dẫn mình cách chọn size đầm chuẩn" returns measurement guide for bust, waist, hips and invites height/weight', async () => {
    const mockOrderModel = {};
    const mockSession = {
      sessionId: 'sess_size_test_1',
      messages: [],
      context: {},
    };

    const sessionService = {
      getOrCreateSession: async () => mockSession,
      appendMessage: async () => {},
      resolveFollowUpProduct: () => null,
    };

    const mockAiService = {
      generateResponse: async () => '', // Test fallback path to verify deterministic non-empty safety
    };

    const chatbot = new ChatbotService(
      mockOrderModel,
      new ChatbotModerationService(),
      new ChatbotIntentService(),
      {}, // knowledge
      {}, // product
      sessionService,
      mockAiService,
    );

    const res = await chatbot.processMessage({
      message: 'Hướng dẫn mình cách chọn size đầm chuẩn',
      sessionId: 'sess_size_test_1',
    });

    assert.equal(res.intent, 'size_consultation');
    assert.ok(res.reply && res.reply.length > 50, 'Reply must not be empty or short');
    assert.match(res.reply, /vòng (?:1|ngực)/i, 'Must guide measuring bust');
    assert.match(res.reply, /vòng (?:2|eo)/i, 'Must guide measuring waist');
    assert.match(res.reply, /vòng (?:3|mông)/i, 'Must guide measuring hips');
    assert.match(res.reply, /chiều cao.*cân nặng/i, 'Must invite customer to provide height and weight');
  });

  // Test 3: Multi-turn context preservation (Height/Weight -> Waist -> Fit preference)
  test('3. Multi-turn context correctly accumulates height, weight, waist, and fit preference', async () => {
    let sessionContext = {};

    const mockSession = {
      sessionId: 'sess_multiturn_size',
      messages: [],
      get context() {
        return sessionContext;
      },
    };

    const sessionService = {
      getOrCreateSession: async () => mockSession,
      appendMessage: async (sId, role, text, intent, updates) => {
        if (updates?.sizingProfile) {
          sessionContext.sizingProfile = {
            ...(sessionContext.sizingProfile || {}),
            ...updates.sizingProfile,
          };
        }
      },
      resolveFollowUpProduct: () => null,
    };

    const mockAiService = {
      generateResponse: async () => '', // fallback mode
    };

    const chatbot = new ChatbotService(
      {},
      new ChatbotModerationService(),
      new ChatbotIntentService(),
      {},
      {},
      sessionService,
      mockAiService,
    );

    // Turn 1: Height & Weight
    const res1 = await chatbot.processMessage({
      message: 'Mình cao 1m60, nặng 50kg thì mặc size gì?',
      sessionId: 'sess_multiturn_size',
    });

    assert.equal(res1.intent, 'size_consultation');
    assert.match(res1.reply, /size m/i, '50kg 1m60 should suggest size M');
    assert.equal(sessionContext.sizingProfile?.height, 160);
    assert.equal(sessionContext.sizingProfile?.weight, 50);

    // Turn 2: Waist provided
    const res2 = await chatbot.processMessage({
      message: 'Vòng eo mình 68cm',
      sessionId: 'sess_multiturn_size',
    });

    assert.equal(res2.intent, 'size_consultation');
    assert.match(res2.reply, /size m/i, 'Waist 68cm should reinforce size M');
    assert.match(res2.reply, /160cm/i, 'Must remember previous height');
    assert.match(res2.reply, /50kg/i, 'Must remember previous weight');
    assert.equal(sessionContext.sizingProfile?.waist, 68);

    // Turn 3: Fit preference
    const res3 = await chatbot.processMessage({
      message: 'Mình thích mặc hơi rộng',
      sessionId: 'sess_multiturn_size',
    });

    assert.equal(res3.intent, 'size_consultation');
    assert.match(res3.reply, /rộng/i, 'Must acknowledge preference for loose/comfortable fit');
    assert.equal(sessionContext.sizingProfile?.fitPreference, 'rộng thoải mái');
  });

  // Test 4: Size difference inquiry (Size M and L)
  test('4. "Size M và L khác nhau thế nào?" returns comparative sizing analysis without hallucinating fake data', async () => {
    const chatbot = new ChatbotService(
      {},
      new ChatbotModerationService(),
      new ChatbotIntentService(),
      {},
      {},
      {
        getOrCreateSession: async () => ({ sessionId: 'sess_diff', messages: [], context: {} }),
        appendMessage: async () => {},
        resolveFollowUpProduct: () => null,
      },
      { generateResponse: async () => '' },
    );

    const res = await chatbot.processMessage({
      message: 'Size M và L khác nhau thế nào?',
      sessionId: 'sess_diff',
    });

    assert.equal(res.intent, 'size_consultation');
    assert.match(res.reply, /size m/i);
    assert.match(res.reply, /size l/i);
    assert.match(res.reply, /48\s*-\s*53kg/i);
    assert.match(res.reply, /54\s*-\s*58kg/i);
  });

  // Test 5: Specific product size inquiry with real MongoDB variants
  test('5. Product size inquiry "Mẫu đầm này có size M không?" inspects real variants without hallucinating fake charts', async () => {
    const mockProductDoc = {
      _id: '507f191e810c19729de86001',
      title: 'Đầm Lụa Chiffon Cao Cấp',
      variants: [
        { size: 'S', color: 'Đỏ', stock: 10 },
        { size: 'M', color: 'Đỏ', stock: 5 },
      ],
      visibility: true,
    };

    const mockProductCard = {
      id: '507f191e810c19729de86001',
      title: 'Đầm Lụa Chiffon Cao Cấp',
      availableSizes: ['S', 'M'],
      inStock: true,
    };

    const mockProductService = {
      getProductById: async () => mockProductDoc,
      checkProductStock: async (pId, color, size) => ({
        inStock: size === 'M' || size === 'S',
        availableStock: size === 'M' ? 5 : 10,
        availableSizes: ['S', 'M'],
        availableColors: ['Đỏ'],
      }),
    };

    const chatbot = new ChatbotService(
      {},
      new ChatbotModerationService(),
      new ChatbotIntentService(),
      {},
      mockProductService,
      {
        getOrCreateSession: async () => ({
          sessionId: 'sess_prod_size',
          messages: [],
          context: { lastProducts: [mockProductCard] },
        }),
        appendMessage: async () => {},
        resolveFollowUpProduct: () => mockProductCard,
      },
      { generateResponse: async () => '' },
    );

    const res = await chatbot.processMessage({
      message: 'Mẫu đầm này có size M không?',
      sessionId: 'sess_prod_size',
    });

    assert.equal(res.intent, 'size_consultation');
    assert.match(res.reply, /còn size m/i);
    assert.match(res.reply, /5 sản phẩm/i);
    assert.ok(res.products && res.products.length === 1, 'Should attach the target product card');
  });

  // Test 6: Specific product out of stock size
  test('6. Product size inquiry for out of stock size correctly notifies unavailable', async () => {
    const mockProductCard = {
      id: '507f191e810c19729de86002',
      title: 'Đầm Dạ Hội Cúp Ngực',
      availableSizes: ['S'],
      inStock: true,
    };

    const mockProductService = {
      getProductById: async () => ({ _id: '507f191e810c19729de86002' }),
      checkProductStock: async (pId, color, size) => ({
        inStock: false, // Size XL is out of stock
        availableStock: 0,
        availableSizes: ['S'],
      }),
    };

    const chatbot = new ChatbotService(
      {},
      new ChatbotModerationService(),
      new ChatbotIntentService(),
      {},
      mockProductService,
      {
        getOrCreateSession: async () => ({
          sessionId: 'sess_prod_size_oos',
          messages: [],
          context: { lastProducts: [mockProductCard] },
        }),
        appendMessage: async () => {},
        resolveFollowUpProduct: () => mockProductCard,
      },
      { generateResponse: async () => '' },
    );

    const res = await chatbot.processMessage({
      message: 'Mẫu đầm này có size XL không?',
      sessionId: 'sess_prod_size_oos',
    });

    assert.equal(res.intent, 'size_consultation');
    assert.match(res.reply, /hết hàng/i);
  });
});
