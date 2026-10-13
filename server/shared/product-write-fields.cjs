const protectedFields = new Set(['reviews', 'rating', 'reviewSummary', 'reviewCount']);
const languageFields = new Set(['vi', 'en', 'sk', 'cs']);

// Incoming product edits describe ordinary fields, never Mongo operators or paths.
// Keep variant/config objects intact; only root and language write fields are filtered.
function sanitizeProductWrite(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input)
    .filter(([key]) => !protectedFields.has(key) && !key.startsWith('$') && !key.includes('.'))
    .map(([key, value]) => [key, languageFields.has(key) && value && typeof value === 'object' && !Array.isArray(value)
      ? sanitizeProductWrite(value) : value]));
}

module.exports = { sanitizeProductWrite };
