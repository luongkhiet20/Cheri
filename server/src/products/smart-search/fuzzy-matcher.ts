/**
 * Damerau-Levenshtein Distance & Guarded Fuzzy Matching for Fashion Queries
 */

import { removeVietnameseAccents } from './vietnamese-normalizer';

/**
 * Calculates the Damerau-Levenshtein distance between two strings,
 * including transpositions of adjacent characters (e.g., 'corsset' <-> 'corset').
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (!a || !b) return (a || '').length + (b || '').length;
  const la = a.length;
  const lb = b.length;

  if (a === b) return 0;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d: number[][] = [];
  for (let i = 0; i <= la; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= lb; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[la][lb];
}

/**
 * Maximum allowed edit distance based on token length to prevent false positives.
 * E.g., short words like 'áo', 'váy', 'đỏ' (length <= 3) MUST have distance 0.
 */
export function getMaxAllowedDistance(tokenLength: number): number {
  if (tokenLength <= 3) return 0; // Strict match only!
  if (tokenLength <= 6) return 1; // 1 typo allowed (e.g., 'satin' vs 'satim')
  return 2; // 2 typos allowed for long words (e.g., 'corsset' vs 'corset')
}

export interface FuzzyMatchResult {
  isMatch: boolean;
  distance: number;
  similarity: number; // 0 to 1
  matchedTargetToken?: string;
}

/**
 * Compare a query token against a candidate target token using length guards.
 */
export function compareFuzzyTokens(queryToken: string, targetToken: string): FuzzyMatchResult {
  const qClean = removeVietnameseAccents(queryToken).trim();
  const tClean = removeVietnameseAccents(targetToken).trim();

  if (qClean === tClean) {
    return { isMatch: true, distance: 0, similarity: 1.0, matchedTargetToken: targetToken };
  }

  const minLen = Math.min(qClean.length, tClean.length);
  const maxDistance = getMaxAllowedDistance(minLen);

  if (maxDistance === 0) {
    return { isMatch: false, distance: Math.abs(qClean.length - tClean.length), similarity: 0 };
  }

  // Length difference guard
  if (Math.abs(qClean.length - tClean.length) > maxDistance) {
    return { isMatch: false, distance: 99, similarity: 0 };
  }

  const dist = damerauLevenshtein(qClean, tClean);
  if (dist <= maxDistance) {
    const maxLen = Math.max(qClean.length, tClean.length);
    const similarity = Math.max(0, 1 - dist / maxLen);
    return {
      isMatch: true,
      distance: dist,
      similarity,
      matchedTargetToken: targetToken,
    };
  }

  return { isMatch: false, distance: dist, similarity: 0 };
}

/**
 * Checks if a query token fuzzy-matches any token in an array of target tokens.
 */
export function findBestFuzzyMatchInTokens(
  queryToken: string,
  targetTokens: string[]
): FuzzyMatchResult {
  let bestMatch: FuzzyMatchResult = { isMatch: false, distance: 99, similarity: 0 };

  for (const t of targetTokens) {
    const res = compareFuzzyTokens(queryToken, t);
    if (res.isMatch) {
      if (!bestMatch.isMatch || res.similarity > bestMatch.similarity) {
        bestMatch = res;
      }
      if (res.distance === 0) break; // Exact match found
    }
  }

  return bestMatch;
}
