/**
 * Shared Japanese text normalizer for OCR field matching.
 * Used by: base.ts (FormFields/Tables), engine.ts (Layout), textExtractor.ts (Regex)
 */

/**
 * Normalize Japanese text for comparison:
 * - Fullwidth alphanumeric/symbols → ASCII
 * - Remove all whitespace (incl. fullwidth space)
 * - Unify dashes, brackets, colons
 * - Lowercase
 */
export function normalizeJapanese(text: string): string {
  return text
    .replace(/[\uff01-\uff5e]/g, c =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\u3000\t]/g, '')
    .replace(/[ー─━−—–]/g, '-')
    .replace(/[（]/g, '(').replace(/[）]/g, ')')
    .replace(/[：]/g, ':')
    .toLowerCase();
}

/**
 * Levenshtein distance (edit distance) between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy match: normalized edit distance within threshold.
 * Short keywords (≤3 chars) require exact/inclusion match only (avoids false positives).
 */
export function fuzzyMatch(
  target: string,
  keyword: string,
  maxDistance?: number
): boolean {
  const a = normalizeJapanese(target);
  const b = normalizeJapanese(keyword);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // Short keywords: no fuzzy (too many false positives for kanji)
  if (b.length <= 3) return false;

  const threshold = maxDistance ?? Math.floor(b.length * 0.3);
  return levenshteinDistance(a, b) <= threshold;
}

/**
 * Normalize fullText for more robust regex matching.
 * Handles inconsistencies between digital PDF text layer and OCR text.
 */
export function normalizeFullText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    // Single newlines (not paragraph breaks) → space
    .replace(/([^\n])\n([^\n])/g, '$1 $2')
    .replace(/\u3000/g, ' ')
    .replace(/ {2,}/g, ' ');
}
