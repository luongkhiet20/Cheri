const test = require('node:test');
const assert = require('node:assert/strict');
const { validateChatRequest } = require('../shared/chat/chat-contract.cjs');

test('valid request trims message and supplies safe defaults', () => {
  assert.deepEqual(validateChatRequest({ message: '  Xin chào  ' }), {
    message: 'Xin chào', history: [], lang: 'vi',
  });
});

test('accepts supported language and maximum request/history lengths', () => {
  const result = validateChatRequest({
    message: 'x'.repeat(1000),
    history: Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user', text: 'y'.repeat(1000),
    })),
    lang: 'en',
  });
  assert.equal(result.message.length, 1000);
  assert.equal(result.history.length, 10);
  assert.equal(result.lang, 'en');
});

test('rejects invalid messages, roles, language and unknown keys', () => {
  const invalid = [
    {}, { message: ' \n ' }, { message: 'x'.repeat(1001) },
    { message: 'hello', extra: true }, { message: 'hello', lang: 'fr' },
    { message: 'hello', history: [{ role: 'system', text: 'secret' }] },
    { message: 'hello', history: Array.from({ length: 11 }, () => ({ role: 'user', text: 'hi' })) },
    { message: 'hello', history: [{ role: 'user', text: ' ' }] },
    { message: 'hello', history: [{ role: 'user', text: 'x'.repeat(1001) }] },
  ];
  for (const request of invalid) {
    assert.throws(() => validateChatRequest(request), { code: 'INVALID_REQUEST' });
  }
});
