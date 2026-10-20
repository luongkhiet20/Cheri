const CONTEXT_MAX_BYTES = 12000;
const PRODUCT_LIMIT = 8;
const PRODUCT_SCAN_LIMIT = 100;
const POLICY_LIMIT = 8;
const LANGUAGES = ['vi', 'en'];
const STOP_WORDS = new Set(['và', 'của', 'cho', 'với', 'các', 'một', 'này', 'đó', 'the', 'for', 'and', 'with', 'có', 'không', 'mình', 'bạn', 'chéri']);

function stripHtml(value, max = 400) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\s*(script|style|iframe|object|svg)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, (entity) => ({
      '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
    })[entity.toLowerCase()] ?? ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeAsset(value) {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch { return undefined; }
}

function validSlug(value) {
  return typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}-]{0,139}$/u.test(value)
    && !['all', 'category', 'undefined', 'null'].includes(value.toLowerCase());
}

function words(text) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase();
  return [...new Set(normalized.match(/[\p{L}\p{N}]{2,}/gu) || [])]
    .filter((word) => !STOP_WORDS.has(word)).slice(0, 8);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function allMessages(request) {
  return [...request.history.slice(-6).map((entry) => entry.text), request.message].join(' ').slice(-7000);
}

function translated(product, lang) {
  const langData = product[lang] && typeof product[lang] === 'object' ? product[lang] : {};
  const viData = product.vi && typeof product.vi === 'object' ? product.vi : {};
  return { langData, fallback: viData };
}

function plainStringArray(value, maxItems = 12) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return list.map((item) => stripHtml(typeof item === 'object' && item ? item.name : item, 60))
    .filter(Boolean).slice(0, maxItems);
}

function normalizeProduct(product, lang) {
  if (!product || product.visibility === false || !product._id || !validSlug(product.titleUrl)) return null;
  const { langData, fallback } = translated(product, lang);
  if (langData.visibility === false || fallback.visibility === false) return null;
  const title = stripHtml(langData.title ?? fallback.title ?? product.title, 150);
  if (!title) return null;

  const regularCandidate = langData.regularPrice ?? fallback.regularPrice ?? product.regularPrice;
  const regular = Number(regularCandidate);
  const regularPrice = Number.isFinite(regular) && regular >= 0 ? regular : undefined;
  const sale = Number(langData.salePrice ?? fallback.salePrice ?? product.salePrice);
  const explicitlyOnSale = (langData.onSale ?? fallback.onSale ?? product.onSale) === true;
  const price = explicitlyOnSale && Number.isFinite(sale) && sale > 0
    && regularPrice !== undefined && sale < regularPrice ? sale : regularPrice;

  const variantStocks = Array.isArray(product.variants) && product.variants.length
    ? product.variants.map((variant) => Number(variant?.stock))
    : [];
  const quantityCandidate = langData.quantity ?? fallback.quantity ?? product.quantity;
  const quantity = quantityCandidate === undefined || quantityCandidate === null || quantityCandidate === ''
    ? undefined : Number(quantityCandidate);
  const stock = typeof (langData.stock ?? fallback.stock ?? product.stock) === 'string'
    ? String(langData.stock ?? fallback.stock ?? product.stock).toLowerCase() : '';
  const quantitiesAreKnown = variantStocks.length
    ? variantStocks.every((value) => Number.isFinite(value) && value >= 0)
    : Number.isFinite(quantity) && quantity >= 0;
  const availability = !quantitiesAreKnown ? 'unknown'
    : (variantStocks.length ? variantStocks.some((value) => value > 0) : quantity > 0)
      && !['out', 'outofstock'].includes(stock) ? 'available' : 'unavailable';

  const productResult = {
    id: String(product._id),
    title,
    path: `/${lang}/product/${encodeURIComponent(product.titleUrl)}`,
    description: stripHtml(langData.description ?? fallback.description ?? product.description, 300),
    categories: plainStringArray(langData.categoryLevel1 ?? fallback.categoryLevel1 ?? product.categoryLevel1, 4),
    colors: plainStringArray(langData.colors ?? fallback.colors ?? product.colors, 8),
    sizes: plainStringArray(langData.sizes ?? fallback.sizes ?? product.sizes, 10),
    availability,
  };
  const image = safeAsset(product.mainImage?.url ?? product.images?.[0]);
  if (image) productResult.imageUrl = image;
  if (price !== undefined) productResult.price = price;
  return productResult;
}

function relevance(product, requestWords, lang = 'vi') {
  if (!requestWords.length) return 0;
  const { langData, fallback } = translated(product, lang);
  const source = [
    langData.title, fallback.title, product.title, langData.description, fallback.description,
    product.description, langData.categoryLevel1, fallback.categoryLevel1, product.categoryLevel1,
    langData.categoryLevel2, fallback.categoryLevel2, product.categoryLevel2, product.tags,
    langData.colors, fallback.colors, langData.sizes, fallback.sizes,
  ];
  const normalized = stripHtml(source.flat(Infinity).map((item) => typeof item === 'string' ? item : '').join(' '), 3000)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase();
  return requestWords.reduce((score, word) => score + (normalized.includes(word) ? 1 : 0), 0);
}

function hasPublishedSignal(page, lang) {
  const language = page[lang] && typeof page[lang] === 'object' ? page[lang] : {};
  const status = String(page.status ?? page.statusCode ?? '').trim().toLowerCase();
  const visibleStatus = !['draft', 'inactive', 'hidden', 'bản nháp', 'ẩn', 'tạm ẩn'].includes(status);
  const explicitlyPublished = page.isPublished === true
    || ['published', 'active', 'đã xuất bản', 'đang bán'].includes(status);
  return visibleStatus && explicitlyPublished && page.visibility !== false && language.visibility !== false;
}

function normalizePolicy(page, lang) {
  if (!page || !page._id || !validSlug(page.titleUrl) || !hasPublishedSignal(page, lang)) return null;
  const language = page[lang] && typeof page[lang] === 'object' ? page[lang] : {};
  const vietnamese = page.vi && typeof page.vi === 'object' ? page.vi : {};
  const title = stripHtml(language.title ?? vietnamese.title ?? page.title, 150);
  const text = stripHtml(language.contentHTML ?? language.content ?? vietnamese.contentHTML ?? vietnamese.content ?? page.contentHTML, 700);
  if (!title || !text) return null;
  return { id: String(page._id), title, path: `/${lang}/cheri/${encodeURIComponent(page.titleUrl)}`, text };
}

function regexVariants(word) {
  const variants = { a: '[aáàảãạăắằẳẵặâấầẩẫậ]', e: '[eéèẻẽẹêếềểễệ]', i: '[iíìỉĩị]',
    o: '[oóòỏõọôốồổỗộơớờởỡợ]', u: '[uúùủũụưứừửữự]', y: '[yýỳỷỹỵ]', d: '[dđ]' };
  return [...word].map((char) => variants[char] || escapeRegex(char)).join('');
}

function safeRegexQuery(queryWords, lang = 'vi') {
  return queryWords.flatMap((word) => {
    const regex = regexVariants(word);
    return [
      { title: { $regex: regex, $options: 'i' } },
      { [`${lang}.title`]: { $regex: regex, $options: 'i' } },
      ...(lang === 'vi' ? [] : [{ 'vi.title': { $regex: regex, $options: 'i' } }]),
      { tags: { $regex: regex, $options: 'i' } },
    ];
  });
}

async function findLimited(collection, filter, projection, limit) {
  return collection.find(filter, { projection }).sort({ dateAdded: -1 }).limit(limit).toArray();
}

async function loadPublicContext(db, request) {
  const searchText = allMessages(request);
  const searchWords = words(searchText);
  const productFilter = {
    visibility: { $ne: false },
    $and: [
      { $or: [{ [`${request.lang}.visibility`]: { $ne: false } }, { [`${request.lang}.visibility`]: { $exists: false } }] },
      { $or: safeRegexQuery(searchWords, request.lang) },
    ],
  };
  const productProjection = {
    _id: 1, id: 1, title: 1, titleUrl: 1, description: 1, categoryLevel1: 1,
    categoryLevel2: 1, tags: 1, mainImage: 1, images: { $slice: 1 },
    visibility: 1, variants: 1, quantity: 1, stock: 1, regularPrice: 1, salePrice: 1,
    onSale: 1, colors: 1, sizes: 1, hasColors: 1, hasSizes: 1,
    vi: 1, en: 1,
  };
  const rawProducts = searchWords.length
    ? await findLimited(db.collection('products'), productFilter, productProjection, PRODUCT_SCAN_LIMIT) : [];
  const candidates = rawProducts.map((raw) => ({ raw, score: relevance(raw, searchWords, request.lang) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PRODUCT_LIMIT)
    .map(({ raw }) => normalizeProduct(raw, request.lang))
    .filter(Boolean);

  const policyFilter = { $or: safeRegexQuery(searchWords, request.lang) };
  const pageProjection = { _id: 1, titleUrl: 1, status: 1, statusCode: 1, isPublished: 1, visibility: 1, vi: 1, en: 1 };
  const policyScore = (page) => {
    const vi = page.vi && typeof page.vi === 'object' ? page.vi : {};
    const language = page[request.lang] && typeof page[request.lang] === 'object' ? page[request.lang] : {};
    const source = stripHtml([language.title, language.contentHTML, language.content, vi.title, vi.contentHTML, vi.content].join(' '), 4000)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase();
    return searchWords.reduce((score, word) => score + (source.includes(word) ? 1 : 0), 0);
  };
  const loadPolicies = async (name) => searchWords.length
    ? findLimited(db.collection(name), policyFilter, pageProjection, 100) : [];
  let rawPolicies = await loadPolicies('pages_policies');
  let policies = rawPolicies.map((page) => ({ page, score: policyScore(page) }))
    .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score)
    .map(({ page }) => normalizePolicy(page, request.lang)).filter(Boolean).slice(0, POLICY_LIMIT);
  if (!policies.length) {
    rawPolicies = await loadPolicies('pages');
    policies = rawPolicies.map((page) => ({ page, score: policyScore(page) }))
      .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score)
      .map(({ page }) => normalizePolicy(page, request.lang)).filter(Boolean).slice(0, POLICY_LIMIT);
  }

  const context = { products: candidates, policies };
  while (Buffer.byteLength(JSON.stringify(context), 'utf8') > CONTEXT_MAX_BYTES) {
    if (context.policies.length) { context.policies.pop(); continue; }
    if (context.products.length) { context.products.pop(); continue; }
    break;
  }
  return context;
}

module.exports = { loadPublicContext, normalizeProduct, normalizePolicy, stripHtml, validSlug };
