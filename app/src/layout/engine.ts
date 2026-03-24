import type { OcrToken, BoundingBox, LayoutTemplate, LayoutFieldDef, Direction } from '../models/types';
import { normalizeJapanese } from '../utils/textNormalizer';

/**
 * Layout Template Engine
 *
 * Given OCR tokens and a layout template, extracts field values by:
 * 1. Finding the keyword token (with alternate keywords and fuzzy matching)
 * 2. Using the direction to find the value token relative to the keyword
 */

export interface ExtractedField {
  fieldPath: string;
  value: string;
  confidence: number;
  keywordBBox: BoundingBox;
  valueBBox: BoundingBox;
}

// Use shared normalizer
const normalizeText = normalizeJapanese;

/**
 * Find tokens that contain the given keyword text.
 * Supports:
 * - Exact match in a single token
 * - Normalized match (ignoring spaces and fullwidth chars)
 * - Adjacent token joining (keyword split across 2-3 tokens)
 */
function findKeywordTokens(tokens: OcrToken[], keyword: string): OcrToken[] {
  const matches: OcrToken[] = [];
  const normalizedKeyword = normalizeText(keyword);

  // 1. Exact match in a single token
  for (const token of tokens) {
    if (token.text.includes(keyword)) {
      matches.push(token);
    }
  }

  // 2. Normalized match if no exact matches
  if (matches.length === 0) {
    for (const token of tokens) {
      if (normalizeText(token.text).includes(normalizedKeyword)) {
        matches.push(token);
      }
    }
  }

  // 3. Adjacent token joining (2-3 tokens) if still no matches
  if (matches.length === 0) {
    for (let i = 0; i < tokens.length; i++) {
      for (let span = 2; span <= 3 && i + span <= tokens.length; span++) {
        const joined = tokens.slice(i, i + span).map(t => t.text).join('');
        if (normalizeText(joined).includes(normalizedKeyword)) {
          // Create a virtual token from the span
          const bboxes = tokens.slice(i, i + span).map(t => t.boundingBox);
          const merged = mergeBoundingBoxes(bboxes);
          const avgConf = tokens.slice(i, i + span).reduce((s, t) => s + t.confidence, 0) / span;
          matches.push({
            text: joined,
            boundingBox: merged,
            confidence: avgConf,
          });
          break;
        }
      }
    }
  }

  return matches;
}

/**
 * Calculate the distance between two bounding boxes in a given direction.
 */
function getDirectionalDistance(
  from: BoundingBox,
  to: BoundingBox,
  direction: Direction
): number | null {
  switch (direction) {
    case 'right': {
      const dx = to.x - (from.x + from.width);
      if (dx < -from.width * 0.5) return null;
      const overlapY = getVerticalOverlap(from, to);
      if (overlapY < 0.2) return null; // relaxed from 0.3
      return Math.abs(dx) + Math.abs(getCenterY(to) - getCenterY(from)) * 0.5;
    }
    case 'below': {
      const dy = to.y - (from.y + from.height);
      if (dy < -from.height * 0.5) return null;
      const overlapX = getHorizontalOverlap(from, to);
      if (overlapX < 0.2) return null; // relaxed from 0.3
      return Math.abs(dy) + Math.abs(getCenterX(to) - getCenterX(from)) * 0.5;
    }
    case 'left': {
      const dx = (from.x) - (to.x + to.width);
      if (dx < -from.width * 0.5) return null;
      const overlapY = getVerticalOverlap(from, to);
      if (overlapY < 0.2) return null;
      return Math.abs(dx) + Math.abs(getCenterY(to) - getCenterY(from)) * 0.5;
    }
    case 'above': {
      const dy = (from.y) - (to.y + to.height);
      if (dy < -from.height * 0.5) return null;
      const overlapX = getHorizontalOverlap(from, to);
      if (overlapX < 0.2) return null;
      return Math.abs(dy) + Math.abs(getCenterX(to) - getCenterX(from)) * 0.5;
    }
  }
}

function getCenterX(bbox: BoundingBox): number {
  return bbox.x + bbox.width / 2;
}

function getCenterY(bbox: BoundingBox): number {
  return bbox.y + bbox.height / 2;
}

function getVerticalOverlap(a: BoundingBox, b: BoundingBox): number {
  const aTop = a.y;
  const aBottom = a.y + a.height;
  const bTop = b.y;
  const bBottom = b.y + b.height;
  const overlap = Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
  const minHeight = Math.min(a.height, b.height);
  if (minHeight === 0) return 0;
  return overlap / minHeight;
}

function getHorizontalOverlap(a: BoundingBox, b: BoundingBox): number {
  const aLeft = a.x;
  const aRight = a.x + a.width;
  const bLeft = b.x;
  const bRight = b.x + b.width;
  const overlap = Math.min(aRight, bRight) - Math.max(aLeft, bLeft);
  const minWidth = Math.min(a.width, b.width);
  if (minWidth === 0) return 0;
  return overlap / minWidth;
}

/**
 * Find the value token in the given direction from the keyword token.
 * Returns the closest token in the specified direction.
 * If multiline is true, concatenates multiple tokens in that direction.
 */
function findValueInDirection(
  keywordToken: OcrToken,
  allTokens: OcrToken[],
  fieldDef: LayoutFieldDef
): { text: string; bbox: BoundingBox; confidence: number } | null {
  const maxDistance = fieldDef.maxDistance || Infinity;
  const candidates: Array<{ token: OcrToken; distance: number }> = [];
  const normalizedKeyword = normalizeText(fieldDef.keyword);

  for (const token of allTokens) {
    if (token === keywordToken) continue;
    // Skip tokens that match any keyword (to avoid extracting labels as values)
    const normalizedToken = normalizeText(token.text);
    if (normalizedToken === normalizedKeyword) continue;
    if (fieldDef.alternateKeywords?.some(ak => normalizedToken === normalizeText(ak))) continue;

    const distance = getDirectionalDistance(
      keywordToken.boundingBox,
      token.boundingBox,
      fieldDef.direction
    );

    if (distance !== null && distance <= maxDistance) {
      candidates.push({ token, distance });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.distance - b.distance);

  if (fieldDef.multiline) {
    const gathered: OcrToken[] = [];
    for (const candidate of candidates.slice(0, 10)) {
      gathered.push(candidate.token);
    }

    if (gathered.length === 0) return null;

    const text = gathered.map(t => t.text).join(' ');
    const allBBoxes = gathered.map(t => t.boundingBox);
    const mergedBBox = mergeBoundingBoxes(allBBoxes);

    return {
      text,
      bbox: mergedBBox,
      confidence: gathered.reduce((sum, t) => sum + t.confidence, 0) / gathered.length,
    };
  }

  // If pattern is defined, try pattern match first among candidates
  if (fieldDef.pattern) {
    const regex = new RegExp(fieldDef.pattern);
    for (const candidate of candidates) {
      if (regex.test(candidate.token.text)) {
        return {
          text: candidate.token.text,
          bbox: candidate.token.boundingBox,
          confidence: candidate.token.confidence,
        };
      }
    }
    // If no single token matches, try joining adjacent candidates
    for (let i = 0; i < Math.min(candidates.length, 5); i++) {
      for (let j = i + 1; j < Math.min(candidates.length, 5); j++) {
        const joined = candidates[i].token.text + candidates[j].token.text;
        if (regex.test(joined)) {
          const bbox = mergeBoundingBoxes([
            candidates[i].token.boundingBox,
            candidates[j].token.boundingBox,
          ]);
          return {
            text: joined,
            bbox,
            confidence: (candidates[i].token.confidence + candidates[j].token.confidence) / 2,
          };
        }
      }
    }
  }

  // If pattern was defined but no candidate matched, return null instead of garbage
  if (fieldDef.pattern) {
    return null;
  }

  // Single value: return the closest token, but reject obvious garbage
  const closest = candidates[0];
  if (isGarbageValue(closest.token.text)) {
    return null;
  }
  return {
    text: closest.token.text,
    bbox: closest.token.boundingBox,
    confidence: closest.token.confidence,
  };
}

/**
 * Reject values that are clearly garbage from the layout engine.
 *
 * Strategy: a meaningful extracted value almost always contains at least one
 * "substantive" character — kanji, digit, or katakana.
 * Short strings made only of hiragana, punctuation, or symbols are garbage.
 * No blocklist needed — this is purely character-class based.
 */
function isGarbageValue(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  // Has substantive content (kanji, numbers, katakana)?
  const hasKanji = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(trimmed);
  const hasDigit = /\d/.test(trimmed);
  const hasKatakana = /[\u30A1-\u30FA]/.test(trimmed);  // exclude ・ etc.

  // Short values (≤3 chars) without any substantive character are garbage
  if (trimmed.length <= 3 && !hasKanji && !hasDigit && !hasKatakana) {
    return true;
  }

  // Single-character values: only accept kanji or digits
  if (trimmed.length === 1 && !hasKanji && !hasDigit) {
    return true;
  }

  return false;
}

function mergeBoundingBoxes(bboxes: BoundingBox[]): BoundingBox {
  if (bboxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const minX = Math.min(...bboxes.map(b => b.x));
  const minY = Math.min(...bboxes.map(b => b.y));
  const maxX = Math.max(...bboxes.map(b => b.x + b.width));
  const maxY = Math.max(...bboxes.map(b => b.y + b.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Main extraction function.
 * Takes OCR tokens and a layout template, returns extracted fields.
 * Supports alternateKeywords for fallback matching.
 */
export function extractFields(
  tokens: OcrToken[],
  template: LayoutTemplate
): ExtractedField[] {
  const results: ExtractedField[] = [];

  for (const [fieldPath, fieldDef] of Object.entries(template)) {
    // Try primary keyword first
    let keywordTokens = findKeywordTokens(tokens, fieldDef.keyword);

    // Try alternate keywords if primary not found
    if (keywordTokens.length === 0 && fieldDef.alternateKeywords) {
      for (const altKeyword of fieldDef.alternateKeywords) {
        keywordTokens = findKeywordTokens(tokens, altKeyword);
        if (keywordTokens.length > 0) break;
      }
    }

    if (keywordTokens.length === 0) continue;

    // Try each keyword match, take the one with highest confidence result
    let bestResult: ExtractedField | null = null;

    for (const kwToken of keywordTokens) {
      const value = findValueInDirection(kwToken, tokens, fieldDef);
      if (!value) continue;

      const candidate: ExtractedField = {
        fieldPath,
        value: value.text,
        confidence: value.confidence,
        keywordBBox: kwToken.boundingBox,
        valueBBox: value.bbox,
      };

      if (!bestResult || candidate.confidence > bestResult.confidence) {
        bestResult = candidate;
      }
    }

    if (bestResult) {
      results.push(bestResult);
    }
  }

  return results;
}

/**
 * Convert extracted fields array into a flat key-value map.
 */
export function fieldsToMap(fields: ExtractedField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of fields) {
    map[field.fieldPath] = field.value;
  }
  return map;
}
