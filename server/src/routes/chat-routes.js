const expressDefault = require('express');

const INVALID_RESPONSE = {
  error: { code: 'INVALID_REQUEST', message: 'Tin nhắn chưa hợp lệ. Bạn kiểm tra lại nội dung nhé.' },
};
const TOO_LARGE_RESPONSE = {
  error: { code: 'PAYLOAD_TOO_LARGE', message: 'Nội dung gửi quá dài.' },
};

function sendParserError(error, _req, res, _next) {
  if (error?.type === 'entity.too.large' || error?.status === 413) {
    return res.status(413).json(TOO_LARGE_RESPONSE);
  }
  return res.status(400).json(INVALID_RESPONSE);
}

function createChatBodyGate({ express = expressDefault } = {}) {
  const router = express.Router();
  router.use(express.json({ limit: 16 * 1024, strict: true, type: 'application/json' }));
  router.use(sendParserError);
  return router;
}

function resolveClientKey(req, isVercel) {
  const { resolveClientKey: trustedKey } = require('../../shared/chat/chat-limit.cjs');
  return trustedKey(req, typeof isVercel === 'function' ? isVercel() : !!isVercel);
}

function createChatRouter({ handler, express = expressDefault, resolve = resolveClientKey, isVercel = () => process.env.VERCEL === '1' }) {
  const router = express.Router();
  router.use(createChatBodyGate({ express }));
  router.post('/', async (req, res) => {
    let result;
    try {
      result = await handler(req.body, resolve(req, isVercel()));
    } catch {
      result = { status: 503, headers: {}, body: { error: { code: 'CHAT_UNAVAILABLE', message: 'Chat hiện chưa thể phản hồi. Bạn thử lại sau nhé.' } } };
    }
    for (const [name, value] of Object.entries(result.headers || {})) res.set(name, value);
    return res.status(result.status).json(result.body);
  });
  router.use((req, res) => {
    if (req.path === '/') return res.status(405).json(INVALID_RESPONSE);
    return res.status(404).json(INVALID_RESPONSE);
  });
  return router;
}

module.exports = { createChatRouter, createChatBodyGate, resolveClientKey };
