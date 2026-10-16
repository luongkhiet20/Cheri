import { Injectable } from '@nestjs/common';
import {
  extractFashionAttributes,
  normalizeVietnameseText,
  removeVietnameseAccents,
  tokenizeSearchQuery,
  sanitizeSearchText,
  escapeRegex,
  FashionAttributes,
} from './vietnamese-normalizer';
import {
  getSynonymPhrases,
  isExcludedSemanticPair,
  COMMON_TYPO_MAP,
} from './fashion-dictionary';
import {
  findBestFuzzyMatchInTokens,
  compareFuzzyTokens,
} from './fuzzy-matcher';

export interface ScoredProduct {
  product: any;
  score: number;
  matchTier: 1 | 2 | 3 | 4 | 5; // Cấp 1 -> Cấp 5
  matchedReasons: string[];
}

export interface SmartSearchResult {
  scoredProducts: ScoredProduct[];
  totalMatches: number;
  normalizedQuery: string;
  detectedAttributes: FashionAttributes;
}

@Injectable()
export class SmartSearchService {
  /**
   * Build an inclusive MongoDB candidate query that captures exact, phrase, unaccented,
   * synonym, and typo candidates for high recall before ranking.
   */
  buildCandidateQuery(search: string, lang: string = 'vi'): any {
    if (!search || !search.trim()) return {};

    const clean = sanitizeSearchText(search);
    const normalized = normalizeVietnameseText(clean);
    const unaccented = removeVietnameseAccents(clean);
    const tokens = tokenizeSearchQuery(clean);
    const unaccentedTokens = tokens.map(removeVietnameseAccents);
    const synonyms = getSynonymPhrases(normalized);

    // Also check typo corrections for query and tokens
    const correctedTokens = tokens.map((t) => COMMON_TYPO_MAP[removeVietnameseAccents(t)] || t);
    const correctedQuery = COMMON_TYPO_MAP[unaccented] || correctedTokens.join(' ');

    const allSearchPhrases = Array.from(
      new Set([
        search.trim(),
        clean,
        normalized,
        unaccented,
        correctedQuery,
        ...synonyms,
      ])
    ).filter((p) => p && p.length > 0);

    const searchFields = [
      `${lang}.title`,
      'vi.title',
      'title',
      'titleUrl',
      'tags',
      `${lang}.categoryLevel1`,
      'vi.categoryLevel1',
      'categoryLevel1',
      `${lang}.categoryLevel2`,
      'vi.categoryLevel2',
      'categoryLevel2',
      `${lang}.productType`,
      'vi.productType',
      'productType',
      `${lang}.colors.name`,
      'vi.colors.name',
      'colors.name',
      'variants.color',
      'variants.classification',
      `${lang}.description`,
      'vi.description',
      'description',
    ];

    const conditions: any[] = [];

    // 1. Phrase & Synonym regexes
    for (const phrase of allSearchPhrases) {
      const escaped = escapeRegex(phrase);
      const regex = new RegExp(escaped, 'i');
      for (const field of searchFields) {
        conditions.push({ [field]: regex });
      }

      // Also match titleUrl slug format (e.g. "chan-vay", "ao-corset")
      const slugPhrase = phrase.toLowerCase().replace(/\s+/g, '-');
      conditions.push({ titleUrl: new RegExp(escapeRegex(slugPhrase), 'i') });
    }

    // 2. Individual token conditions
    const allTokens = Array.from(new Set([...tokens, ...unaccentedTokens, ...correctedTokens]));
    for (const token of allTokens) {
      if (token.length >= 2) {
        const tokenRegex = new RegExp(escapeRegex(token), 'i');
        conditions.push({ 'vi.title': tokenRegex });
        conditions.push({ titleUrl: tokenRegex });
        conditions.push({ tags: tokenRegex });
        conditions.push({ 'vi.colors.name': tokenRegex });
      }
    }

    return { $or: conditions };
  }

  /**
   * Score and rank candidate products based on the 5-tier matching architecture.
   */
  scoreAndRankProducts(
    candidates: any[],
    rawQuery: string,
    lang: string = 'vi',
    minResultsThreshold: number = 8
  ): SmartSearchResult {
    if (!rawQuery || !rawQuery.trim() || !candidates || candidates.length === 0) {
      return {
        scoredProducts: (candidates || []).map((p) => ({
          product: p,
          score: 1,
          matchTier: 2,
          matchedReasons: ['default'],
        })),
        totalMatches: candidates ? candidates.length : 0,
        normalizedQuery: '',
        detectedAttributes: extractFashionAttributes(''),
      };
    }

    const attrs = extractFashionAttributes(rawQuery);
    const normalizedQuery = attrs.normalizedQuery;
    const unaccentedQuery = attrs.unaccentedQuery;
    const queryTokens = attrs.tokens;
    const unaccentedQueryTokens = attrs.unaccentedTokens;
    const synonyms = getSynonymPhrases(normalizedQuery);
    const unaccentedSynonyms = synonyms.map(removeVietnameseAccents);

    const scoredList: ScoredProduct[] = [];

    for (const product of candidates) {
      const p = product && typeof product.toObject === 'function' ? product.toObject() : product;
      const langData = p[lang] || p.vi || p.en || {};

      // 1. Product text components
      const rawTitle = (langData.title || p.title || '').trim();
      const titleUrl = (p.titleUrl || '').trim();
      const title = rawTitle || titleUrl.replace(/-/g, ' ');
      const titleNorm = normalizeVietnameseText(title);
      const titleUnacc = removeVietnameseAccents(title);
      const titleTokens = tokenizeSearchQuery(title);
      const titleUnaccTokens = titleTokens.map(removeVietnameseAccents);

      const desc = (langData.description || p.description || '').replace(/<[^>]*>/g, ' ');
      const descNorm = normalizeVietnameseText(desc);
      const descUnacc = removeVietnameseAccents(desc);

      const tags: string[] = Array.isArray(p.tags) ? p.tags.map((t: string) => String(t)) : [];
      const tagsNorm = tags.map(normalizeVietnameseText);
      const tagsUnacc = tags.map(removeVietnameseAccents);

      const categories: string[] = [
        langData.categoryLevel1,
        p.categoryLevel1,
        langData.categoryLevel2,
        p.categoryLevel2,
        langData.productType,
        p.productType,
      ]
        .filter(Boolean)
        .map((c) => String(c).trim());
      const categoriesNorm = categories.map(normalizeVietnameseText);
      const categoriesUnacc = categories.map(removeVietnameseAccents);

      // Color info from product
      const productColors: string[] = [];
      if (Array.isArray(langData.colors)) {
        for (const c of langData.colors) {
          if (c?.name) productColors.push(normalizeVietnameseText(c.name));
        }
      }
      if (Array.isArray(p.variants)) {
        for (const v of p.variants) {
          if (v?.color) productColors.push(normalizeVietnameseText(v.color));
          if (v?.classification) productColors.push(normalizeVietnameseText(v.classification));
        }
      }

      let score = 0;
      let highestTier: 1 | 2 | 3 | 4 | 5 = 5;
      const reasons: string[] = [];

      // -------------------------------------------------------------
      // CẤP 1: KHỚP CHÍNH XÁC (Exact Match - ~40%)
      // -------------------------------------------------------------
      if (titleNorm === normalizedQuery) {
        score += 45;
        highestTier = 1;
        reasons.push('exact_title_match');
      } else if (titleUnacc === unaccentedQuery) {
        score += 40;
        if (highestTier > 1) highestTier = 1;
        reasons.push('exact_unaccented_title_match');
      }

      // -------------------------------------------------------------
      // CẤP 2: KHỚP CỤM TỪ VÀ TỪ KHÓA (Phrase & Keyword - ~25%)
      // -------------------------------------------------------------
      // Full phrase in title
      if (titleNorm.includes(normalizedQuery)) {
        score += 28;
        if (highestTier > 2) highestTier = 2;
        reasons.push('title_contains_phrase');
      } else if (titleUnacc.includes(unaccentedQuery)) {
        score += 24;
        if (highestTier > 2) highestTier = 2;
        reasons.push('title_contains_unaccented_phrase');
      }

      // Token overlap in title
      let matchedTokenCount = 0;
      for (let i = 0; i < queryTokens.length; i++) {
        const qTok = queryTokens[i];
        const qUnacc = unaccentedQueryTokens[i];
        if (titleTokens.includes(qTok) || titleNorm.includes(qTok)) {
          matchedTokenCount++;
        } else if (titleUnaccTokens.includes(qUnacc) || titleUnacc.includes(qUnacc)) {
          matchedTokenCount += 0.85;
        }
      }

      if (queryTokens.length > 0 && matchedTokenCount > 0) {
        const tokenRatio = Math.min(1, matchedTokenCount / queryTokens.length);
        const tokenScore = Math.round(tokenRatio * 20);
        score += tokenScore;
        if (tokenRatio === 1 && highestTier > 2) {
          highestTier = 2;
        }
        reasons.push(`title_token_match_${Math.round(tokenRatio * 100)}%`);
      }

      // -------------------------------------------------------------
      // CẤP 3: KHỚP KHÔNG DẤU VÀ GẦN ĐÚNG / FUZZY MATCH (Levenshtein ~10%)
      // -------------------------------------------------------------
      // Check fuzzy matching for query tokens against title tokens
      let fuzzyMatchPoints = 0;
      for (const qTok of queryTokens) {
        const fuzzyRes = findBestFuzzyMatchInTokens(qTok, titleTokens);
        if (fuzzyRes.isMatch && fuzzyRes.distance > 0) {
          // Typo matched (e.g. corsset -> corset)
          fuzzyMatchPoints += Math.round(fuzzyRes.similarity * 12);
          reasons.push(`fuzzy_match_${qTok}_to_${fuzzyRes.matchedTargetToken}`);
          if (highestTier > 3) highestTier = 3;
        }
      }
      if (fuzzyMatchPoints > 0) {
        score += Math.min(15, fuzzyMatchPoints);
      }

      // -------------------------------------------------------------
      // CẤP 4: TỪ ĐỒNG NGHĨA VÀ TƯƠNG ĐƯƠNG (Fashion Synonyms ~10%)
      // -------------------------------------------------------------
      // Check if target is explicitly excluded by semantic rules (e.g. 'đầm' vs 'chân váy')
      const isExcluded = isExcludedSemanticPair(normalizedQuery, titleNorm);

      if (!isExcluded) {
        let synonymFound = false;
        for (let i = 0; i < synonyms.length; i++) {
          const syn = synonyms[i];
          const synNorm = normalizeVietnameseText(syn);
          const synUnacc = unaccentedSynonyms[i];

          if (titleNorm.includes(synNorm)) {
            score += 15;
            synonymFound = true;
            reasons.push(`synonym_match_${syn}`);
            if (highestTier > 4) highestTier = 4;
            break;
          } else if (titleUnacc.includes(synUnacc)) {
            score += 12;
            synonymFound = true;
            reasons.push(`synonym_unaccented_match_${syn}`);
            if (highestTier > 4) highestTier = 4;
            break;
          }
        }

        // Also check synonyms in tags or description if not yet found
        if (!synonymFound) {
          for (let i = 0; i < synonyms.length; i++) {
            const syn = synonyms[i];
            const synNorm = normalizeVietnameseText(syn);
            const inTags = tagsNorm.some((t) => t.includes(synNorm));
            const inDesc = descNorm.includes(synNorm);
            if (inTags || inDesc) {
              score += 8;
              reasons.push(`synonym_in_meta_${syn}`);
              if (highestTier > 4) highestTier = 4;
              break;
            }
          }
        }
      } else {
        // Downrank if contradictory garment type was matched inadvertently
        score -= 15;
        reasons.push('semantic_type_exclusion_penalty');
      }

      // -------------------------------------------------------------
      // ƯU TIÊN THUỘC TÍNH: MÀU SẮC, CHẤT LIỆU, LOẠI SẢN PHẨM
      // -------------------------------------------------------------
      // 1. Color priority (e.g. "chân váy đen" -> black color is prioritized)
      if (attrs.colors.length > 0) {
        let colorMatched = false;
        for (const reqColor of attrs.colors) {
          const reqUnacc = removeVietnameseAccents(reqColor);
          const inTitle = titleNorm.includes(reqColor) || titleUnacc.includes(reqUnacc);
          const inProductColors = productColors.some(
            (c) => c.includes(reqColor) || removeVietnameseAccents(c).includes(reqUnacc)
          );
          const inDesc = descNorm.includes(reqColor) || descUnacc.includes(reqUnacc);

          if (inTitle || inProductColors) {
            score += 16;
            colorMatched = true;
            reasons.push(`color_match_${reqColor}`);
            break;
          } else if (inDesc) {
            score += 8;
            colorMatched = true;
            reasons.push(`color_in_desc_${reqColor}`);
            break;
          }
        }
        if (!colorMatched) {
          // If query specifically requested a color and product doesn't have it, slight demotion
          score -= 6;
          reasons.push('color_mismatch_penalty');
        }
      }

      // 2. Material priority (e.g. "lụa" -> satin, silk, lụa)
      if (attrs.materials.length > 0) {
        for (const reqMat of attrs.materials) {
          const reqUnacc = removeVietnameseAccents(reqMat);
          const inTitle = titleNorm.includes(reqMat) || titleUnacc.includes(reqUnacc);
          const inDesc = descNorm.includes(reqMat) || descUnacc.includes(reqUnacc);
          if (inTitle) {
            score += 14;
            reasons.push(`material_match_${reqMat}`);
            break;
          } else if (inDesc) {
            score += 8;
            reasons.push(`material_in_desc_${reqMat}`);
            break;
          }
        }
      }

      // 3. Garment type match
      if (attrs.garmentTypes.length > 0) {
        for (const reqGarment of attrs.garmentTypes) {
          const reqUnacc = removeVietnameseAccents(reqGarment);
          if (titleNorm.includes(reqGarment) || titleUnacc.includes(reqUnacc)) {
            score += 14;
            reasons.push(`garment_type_match_${reqGarment}`);
            break;
          }
        }
      }

      // -------------------------------------------------------------
      // DANH MỤC VÀ TAGS PHÙ HỢP (~15%)
      // -------------------------------------------------------------
      let categoryMatch = false;
      for (const cat of [...categoriesNorm, ...tagsNorm]) {
        if (cat.includes(normalizedQuery) || normalizedQuery.includes(cat)) {
          score += 14;
          categoryMatch = true;
          reasons.push('category_or_tag_match');
          break;
        }
      }
      if (!categoryMatch) {
        for (const tok of queryTokens) {
          if (tok.length >= 3 && tagsNorm.some((t) => t.includes(tok))) {
            score += 6;
            reasons.push(`tag_token_${tok}`);
            break;
          }
        }
      }

      // -------------------------------------------------------------
      // MÔ TẢ SẢN PHẨM (~10%)
      // -------------------------------------------------------------
      if (descNorm.includes(normalizedQuery)) {
        score += 8;
        reasons.push('description_contains_phrase');
      } else if (descUnacc.includes(unaccentedQuery)) {
        score += 6;
        reasons.push('description_contains_unaccented_phrase');
      }

      // CẤP 5: SẢN PHẨM LIÊN QUAN (Related product bonus)
      if (highestTier === 5 && (categoryMatch || tagsNorm.length > 0)) {
        score += 5;
        reasons.push('related_product');
      }

      // Sắp xếp phụ ổn định: Tỉ lệ độ dài từ khóa so với độ dài tên (title match density)
      // Giúp tên ngắn, gọn, tập trung chính xác vào từ khóa được ưu tiên hơn
      if (score > 0 && titleNorm.length > 0) {
        const densityBonus = Math.min(5, (normalizedQuery.length / titleNorm.length) * 5);
        score += Number(densityBonus.toFixed(2));
      }

      // Filter out non-matching candidates (score threshold)
      if (score >= 8) {
        scoredList.push({
          product,
          score,
          matchTier: highestTier,
          matchedReasons: reasons,
        });
      }
    }

    // -------------------------------------------------------------
    // CƠ CHẾ MỞ RỘNG KẾT QUẢ CÓ KIỂM SOÁT (Controlled Expansion)
    // -------------------------------------------------------------
    // Tiers 1 & 2 & 3: direct matches
    const highTierMatches = scoredList.filter((item) => item.matchTier <= 3);

    let finalResults: ScoredProduct[];
    if (highTierMatches.length >= minResultsThreshold) {
      // Đủ kết quả chính xác và gần đúng -> chỉ ưu tiên các kết quả chất lượng cao
      // Vẫn giữ các kết quả khác nhưng chúng tự nhiên có điểm thấp hơn ở dưới
      finalResults = scoredList;
    } else {
      // Thiếu kết quả -> giữ tất cả kết quả đã mở rộng sang cấp 4 (đồng nghĩa) và cấp 5 (liên quan)
      finalResults = scoredList;
    }

    // Sort by relevance score descending
    // Stable secondary sort: dateAdded DESC, then _id
    finalResults.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const dateA = a.product?.dateAdded ? new Date(a.product.dateAdded).getTime() : 0;
      const dateB = b.product?.dateAdded ? new Date(b.product.dateAdded).getTime() : 0;
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      const idA = String(a.product?._id || '');
      const idB = String(b.product?._id || '');
      return idA.localeCompare(idB);
    });

    return {
      scoredProducts: finalResults,
      totalMatches: finalResults.length,
      normalizedQuery,
      detectedAttributes: attrs,
    };
  }
}
