/**
 * Extensible Fashion Synonym & Equivalence Dictionary for Cheri
 * Handles context-aware expansions and strict semantic distinctions.
 */

import {
  normalizeVietnameseText,
  removeVietnameseAccents,
  escapeRegex,
} from './vietnamese-normalizer';

export interface SynonymRule {
  /** The primary term or phrase (normalized Vietnamese) */
  term: string;
  /** Synonym phrases or equivalents to expand into */
  synonyms: string[];
  /** Whether the synonym is bidirectional (default true) */
  bidirectional?: boolean;
  /** Terms that should NOT be equated or matched with this term */
  exclusions?: string[];
  /** Notes on fashion context */
  category?: 'garment' | 'material' | 'attribute' | 'style';
}

export const FASHION_SYNONYM_RULES: SynonymRule[] = [
  // 1. DRESS vs SKIRT distinction
  {
    term: 'đầm',
    synonyms: ['váy', 'dress', 'đầm liền', 'đầm tiệc', 'đầm xòe', 'đầm body'],
    bidirectional: false, // searching 'đầm' includes 'váy', but 'chân váy' is strictly excluded
    exclusions: ['chân váy', 'miniskirt', 'skirt'],
    category: 'garment',
  },
  {
    term: 'váy',
    synonyms: ['đầm', 'dress'],
    bidirectional: false,
    exclusions: ['chân váy'],
    category: 'garment',
  },
  {
    term: 'chân váy',
    synonyms: ['chân váy', 'skirt', 'miniskirt', 'chân váy xếp ly', 'chân váy chữ a', 'chân váy ngắn'],
    bidirectional: true,
    exclusions: ['đầm', 'đầm dạ hội', 'đầm công chúa'],
    category: 'garment',
  },

  // 2. CORSET / BODY SHAPE
  {
    term: 'áo corset',
    synonyms: ['áo định hình', 'corset', 'corset top', 'top corset', 'đai corset', 'áo nịt bụng', 'áo siết eo', 'áo bó eo'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'corset',
    synonyms: ['áo corset', 'áo định hình', 'đai corset', 'top corset', 'siết eo', 'định hình'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'áo định hình',
    synonyms: ['áo corset', 'corset', 'định hình eo', 'siết eo'],
    bidirectional: true,
    category: 'garment',
  },

  // 3. STRAP TOPS
  {
    term: 'áo hai dây',
    synonyms: ['áo 2 dây', 'áo dây', 'camisole', 'áo 2day', 'áo hai day', 'áo yếm 2 dây'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'áo 2 dây',
    synonyms: ['áo hai dây', 'áo dây', 'camisole'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'áo dây',
    synonyms: ['áo 2 dây', 'áo hai dây', 'camisole'],
    bidirectional: true,
    category: 'garment',
  },

  // 4. FABRIC / MATERIALS (Satin / Silk)
  {
    term: 'lụa',
    synonyms: ['satin', 'sa tanh', 'silk', 'lụa satin', 'vải lụa', 'lụa bóng'],
    bidirectional: true,
    category: 'material',
  },
  {
    term: 'satin',
    synonyms: ['sa tanh', 'lụa', 'silk', 'lụa satin', 'satin bóng'],
    bidirectional: true,
    category: 'material',
  },
  {
    term: 'sa tanh',
    synonyms: ['satin', 'lụa', 'silk'],
    bidirectional: true,
    category: 'material',
  },

  // 5. T-SHIRT / CASUAL TOPS
  {
    term: 'áo phông',
    synonyms: ['áo thun', 't-shirt', 'tshirt', 'áo cộc tay', 'tee'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'áo thun',
    synonyms: ['áo phông', 't-shirt', 'tshirt', 'tee'],
    bidirectional: true,
    category: 'garment',
  },

  // 6. CROPTOP
  {
    term: 'croptop',
    synonyms: ['crop top', 'áo lửng', 'áo croptop', 'áo ngắn'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'crop top',
    synonyms: ['croptop', 'áo lửng', 'áo croptop'],
    bidirectional: true,
    category: 'garment',
  },

  // 7. JEANS / DENIM
  {
    term: 'quần bò',
    synonyms: ['quần jean', 'quần jeans', 'quần denim', 'jeans'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'quần jean',
    synonyms: ['quần jeans', 'quần bò', 'denim', 'jeans'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'quần jeans',
    synonyms: ['quần jean', 'quần bò', 'denim', 'jeans'],
    bidirectional: true,
    category: 'garment',
  },

  // 8. HOODIE / SWEATSHIRT
  {
    term: 'áo hoodie',
    synonyms: ['hoodie', 'áo khoác hoodie', 'áo nỉ có mũ', 'áo mũ'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'hoodie',
    synonyms: ['áo hoodie', 'áo nỉ có mũ'],
    bidirectional: true,
    category: 'garment',
  },

  // 9. BLAZER / VEST
  {
    term: 'blazer',
    synonyms: ['áo vest', 'áo khoác vest', 'vest nữ', 'suit'],
    bidirectional: true,
    category: 'garment',
  },
  {
    term: 'áo vest',
    synonyms: ['blazer', 'vest nữ', 'áo blazer'],
    bidirectional: true,
    category: 'garment',
  },

  // 10. BAGS
  {
    term: 'túi xách',
    synonyms: ['túi thời trang', 'túi nữ', 'handbag', 'túi đeo chéo', 'túi kẹp nách'],
    bidirectional: true,
    category: 'garment',
  },
];

/**
 * Common typo corrections and slang mapping in fashion
 */
export const COMMON_TYPO_MAP: Record<string, string> = {
  corsset: 'corset',
  corse: 'corset',
  corsett: 'corset',
  dam: 'đầm',
  damm: 'đầm',
  vay: 'váy',
  vayy: 'váy',
  ao: 'áo',
  chanvay: 'chân váy',
  'chan vay': 'chân váy',
  quan: 'quần',
  satim: 'satin',
  satanh: 'sa tanh',
  lua: 'lụa',
  croptop: 'crop top',
  miniskir: 'miniskirt',
  miniskrt: 'miniskirt',
  tshirt: 'áo thun',
  den: 'đen',
  trang: 'trắng',
  do: 'đỏ',
  hong: 'hồng',
  vang: 'vàng',
  xam: 'xám',
};

/**
 * Check if target text should be excluded from a query term based on semantic distinctions.
 * E.g., if user searches "đầm", "chân váy" is excluded from synonym bonus.
 */
export function isExcludedSemanticPair(queryNormalized: string, targetNormalized: string): boolean {
  for (const rule of FASHION_SYNONYM_RULES) {
    if (rule.exclusions && rule.exclusions.length > 0) {
      const qMatchesRule =
        queryNormalized.includes(rule.term) ||
        removeVietnameseAccents(queryNormalized).includes(removeVietnameseAccents(rule.term));

      if (qMatchesRule) {
        for (const excl of rule.exclusions) {
          const tMatchesExcl =
            targetNormalized.includes(excl) ||
            removeVietnameseAccents(targetNormalized).includes(removeVietnameseAccents(excl));

          if (tMatchesExcl) {
            // Target matches an excluded term!
            // But if query explicitly contains the excluded term as well, do not exclude
            if (!queryNormalized.includes(excl) && !removeVietnameseAccents(queryNormalized).includes(removeVietnameseAccents(excl))) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

/**
 * Get all expanded synonym phrases for a normalized query.
 */
export function getSynonymPhrases(normalizedQuery: string): string[] {
  const synonymsFound = new Set<string>();
  const unaccentedQuery = removeVietnameseAccents(normalizedQuery);

  // Check typo map first
  if (COMMON_TYPO_MAP[unaccentedQuery]) {
    synonymsFound.add(COMMON_TYPO_MAP[unaccentedQuery]);
  }

  for (const rule of FASHION_SYNONYM_RULES) {
    // If query explicitly contains any of the rule's exclusions, skip this rule
    if (
      rule.exclusions &&
      rule.exclusions.some(
        (ex) =>
          normalizedQuery.includes(normalizeVietnameseText(ex)) ||
          unaccentedQuery.includes(removeVietnameseAccents(ex))
      )
    ) {
      continue;
    }

    const termNorm = normalizeVietnameseText(rule.term);
    const termUnacc = removeVietnameseAccents(rule.term);

    const termRegex = new RegExp(`(^|\\s)${escapeRegex(termNorm)}(\\s|$)`, 'i');
    const termUnaccRegex = new RegExp(`(^|\\s)${escapeRegex(termUnacc)}(\\s|$)`, 'i');

    const isMatch =
      termRegex.test(normalizedQuery) ||
      termUnaccRegex.test(unaccentedQuery) ||
      termNorm === normalizedQuery ||
      termUnacc === unaccentedQuery;

    if (isMatch) {
      for (const syn of rule.synonyms) {
        synonymsFound.add(syn);
      }
    } else if (rule.bidirectional) {
      for (const syn of rule.synonyms) {
        const synNorm = normalizeVietnameseText(syn);
        const synUnacc = removeVietnameseAccents(syn);
        const synRegex = new RegExp(`(^|\\s)${escapeRegex(synNorm)}(\\s|$)`, 'i');
        const synUnaccRegex = new RegExp(`(^|\\s)${escapeRegex(synUnacc)}(\\s|$)`, 'i');

        if (
          synRegex.test(normalizedQuery) ||
          synUnaccRegex.test(unaccentedQuery) ||
          synNorm === normalizedQuery ||
          synUnacc === unaccentedQuery
        ) {
          synonymsFound.add(rule.term);
          for (const s of rule.synonyms) {
            if (s !== syn) synonymsFound.add(s);
          }
        }
      }
    }
  }

  return Array.from(synonymsFound);
}
