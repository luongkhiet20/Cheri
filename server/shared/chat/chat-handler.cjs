const { validateChatRequest } = require('./chat-contract.cjs');

function result(status, code, message, headers = {}) {
  return { status, body: { error: { code, message } }, headers };
}

function createChatHandler({ getDb, limiter, gemini, loadContext, finalize, logger = console, now = Date.now }) {
  return async function handle(body, clientKey) {
    let request;
    try {
      request = validateChatRequest(body);
    } catch {
      return result(400, 'INVALID_REQUEST', 'Tin nhắn chưa hợp lệ. Bạn kiểm tra lại nội dung nhé.');
    }
    try {
      const db = await getDb();
      const rate = await limiter.consume(clientKey, now());
      if (!rate.allowed) {
        return result(429, 'RATE_LIMITED', 'Bạn gửi hơi nhanh. Bạn thử lại sau một chút nhé.', {
          'Retry-After': String(Math.max(1, rate.retryAfterSeconds)),
        });
      }
      const context = await loadContext(db, request);
      const answer = await gemini.generate(request, context);
      return { status: 200, body: finalize(answer, context), headers: {} };
    } catch (error) {
      const code = error?.code === 'CHAT_TIMEOUT' ? 'CHAT_TIMEOUT' : 'CHAT_UNAVAILABLE';
      try { logger.warn?.({ event: 'chat_request_failed', code }); } catch {}
      return code === 'CHAT_TIMEOUT'
        ? result(504, code, 'Chéri đang phản hồi chậm. Bạn thử lại sau nhé.')
        : result(503, code, 'Chat hiện chưa thể phản hồi. Bạn thử lại sau nhé.');
    }
  };
}

module.exports = { createChatHandler };
