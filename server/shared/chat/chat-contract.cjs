const VALID_LANGUAGES = new Set(['vi', 'en']);

function invalid(message) {
  const error = new Error(message);
  error.code = 'INVALID_REQUEST';
  return error;
}

function validateChatRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid('Invalid chat request');
  }
  if (Object.keys(value).some((key) => !['message', 'history', 'lang'].includes(key))) {
    throw invalid('Invalid chat request');
  }
  if (typeof value.message !== 'string') throw invalid('Invalid message');
  const message = value.message.trim();
  if (!message || message.length > 1000) throw invalid('Invalid message');
  const lang = value.lang === undefined ? 'vi' : value.lang;
  if (!VALID_LANGUAGES.has(lang)) throw invalid('Invalid language');
  const sourceHistory = value.history === undefined ? [] : value.history;
  if (!Array.isArray(sourceHistory) || sourceHistory.length > 10) throw invalid('Invalid history');
  const history = sourceHistory.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).some((key) => !['role', 'text'].includes(key))
      || !['user', 'assistant'].includes(entry.role) || typeof entry.text !== 'string') {
      throw invalid('Invalid history');
    }
    const text = entry.text.trim();
    if (!text || text.length > 1000) throw invalid('Invalid history');
    return { role: entry.role, text };
  });
  return { message, history, lang };
}

module.exports = { validateChatRequest };
