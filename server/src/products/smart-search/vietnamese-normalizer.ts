/**
 * Vietnamese Text Normalization & Semantic Attribute Extraction for Cheri Fashion Search
 */

export interface FashionAttributes {
  colors: string[];
  materials: string[];
  garmentTypes: string[];
  cleanQuery: string;
  normalizedQuery: string;
  unaccentedQuery: string;
  tokens: string[];
  unaccentedTokens: string[];
}

// Common Vietnamese fashion colors
export const FASHION_COLORS = [
  'đen', 'trắng', 'đỏ', 'hồng', 'be', 'vàng', 'xám', 'xanh', 'nâu',
  'tím', 'cam', 'bạc', 'kem', 'rêu', 'pastel', 'caro', 'chấm bi',
  'họa tiết', 'loang', 'sọc'
];

// Common Vietnamese fashion materials
export const FASHION_MATERIALS = [
  'lụa', 'satin', 'sa tanh', 'ren', 'cotton', 'voan', 'jean', 'jeans',
  'denim', 'da', 'dạ', 'dạ tweed', 'tweed', 'nỉ', 'tulle', 'thun',
  'gân', 'bo gân', 'lông', 'n hung', 'nhung', 'len', 'kate', 'kaki'
];

// Common Vietnamese garment types (sorted by length descending for greedy phrase matching)
export const GARMENT_TYPES = [
  'chân váy', 'áo corset', 'áo hai dây', 'áo 2 dây', 'áo dây',
  'áo croptop', 'áo sơ mi', 'áo khoác', 'áo phông', 'áo thun',
  'áo len', 'áo dạ', 'áo ống', 'áo yếm', 'áo nỉ', 'áo hoodie',
  'quần jeans', 'quần jean', 'quần short', 'quần đùi', 'quần dài',
  'quần ống rộng', 'quần baggy', 'set đồ', 'set bộ', 'chân váy',
  'đầm', 'váy', 'áo', 'quần', 'set', 'top', 'skirt', 'dress'
];

/**
 * Standardize Vietnamese diacritics and Unicode characters.
 * Handles both NFC and NFD combining characters.
 */
export function normalizeVietnameseText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '') // Remove stray combining marks if any
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips all Vietnamese accents and marks to create clean unaccented text.
 * Example: "Áo Corset Đen" -> "ao corset den"
 */
export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  let normalized = str.normalize('NFD');
  // Remove combining diacritical marks
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  // Replace Vietnamese specific characters
  normalized = normalized
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/ḍ/g, 'd')
    .replace(/Ḍ/g, 'd');
  // Normalize back to NFC and lowercase
  return normalized.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Strip non-alphanumeric punctuation while preserving spaces and Vietnamese letters
 */
export function sanitizeSearchText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>@\[\]\\\|+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize a search string into unique cleaned words
 */
export function tokenizeSearchQuery(str: string): string[] {
  const sanitized = sanitizeSearchText(str);
  if (!sanitized) return [];
  return sanitized
    .toLowerCase()
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Extract semantic fashion attributes from query (colors, materials, garment types)
 */
export function extractFashionAttributes(query: string): FashionAttributes {
  const clean = sanitizeSearchText(query);
  const normalized = normalizeVietnameseText(clean);
  const unaccented = removeVietnameseAccents(clean);
  const tokens = tokenizeSearchQuery(clean);
  const unaccentedTokens = tokens.map(removeVietnameseAccents);

  const matchedColors: string[] = [];
  const matchedMaterials: string[] = [];
  const matchedGarmentTypes: string[] = [];

  // Match multi-word or single-word colors
  for (const color of FASHION_COLORS) {
    const colorNorm = normalizeVietnameseText(color);
    const colorUnacc = removeVietnameseAccents(color);
    if (
      normalized.includes(colorNorm) ||
      unaccented.includes(colorUnacc) ||
      tokens.includes(colorNorm) ||
      unaccentedTokens.includes(colorUnacc)
    ) {
      if (!matchedColors.includes(colorNorm)) {
        matchedColors.push(colorNorm);
      }
    }
  }

  // Match materials
  for (const mat of FASHION_MATERIALS) {
    const matNorm = normalizeVietnameseText(mat);
    const matUnacc = removeVietnameseAccents(mat);
    if (
      normalized.includes(matNorm) ||
      unaccented.includes(matUnacc) ||
      tokens.includes(matNorm) ||
      unaccentedTokens.includes(matUnacc)
    ) {
      if (!matchedMaterials.includes(matNorm)) {
        matchedMaterials.push(matNorm);
      }
    }
  }

  // Match garment types
  for (const g of GARMENT_TYPES) {
    const gNorm = normalizeVietnameseText(g);
    const gUnacc = removeVietnameseAccents(g);
    const pattern = new RegExp(`(^|\\s)${escapeRegex(gNorm)}(\\s|$)`, 'i');
    const unaccPattern = new RegExp(`(^|\\s)${escapeRegex(gUnacc)}(\\s|$)`, 'i');

    if (pattern.test(normalized) || unaccPattern.test(unaccented)) {
      if (!matchedGarmentTypes.includes(gNorm)) {
        matchedGarmentTypes.push(gNorm);
      }
    }
  }

  return {
    colors: matchedColors,
    materials: matchedMaterials,
    garmentTypes: matchedGarmentTypes,
    cleanQuery: clean,
    normalizedQuery: normalized,
    unaccentedQuery: unaccented,
    tokens,
    unaccentedTokens,
  };
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
