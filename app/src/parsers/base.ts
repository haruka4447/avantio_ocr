import type { OcrResult, LayoutTemplate, DocumentParser, FormField } from '../models/types';
import { extractFields, fieldsToMap } from '../layout/engine';
import { extractFromText } from './textExtractor';
import { normalizeJapanese, fuzzyMatch } from '../utils/textNormalizer';

/**
 * Base parser that uses multiple strategies in priority order:
 * 1. Text regex patterns on fullText — most reliable for structured docs
 * 2. Form Parser entities (key-value pairs) — high accuracy
 * 3. Form Parser tables — for tabular data
 * 4. Layout Template Engine (keyword+direction) — fallback
 *
 * Higher priority results overwrite lower ones.
 * When Form Parser fails (status='error'), Layout Engine search radius is expanded.
 */
export abstract class BaseParser implements DocumentParser {
  protected documentType: string = '';

  constructor(protected template: LayoutTemplate) {}

  parse(ocrResult: OcrResult): Record<string, string> {
    const meta = ocrResult.formParserMeta;

    // Strategy 4 (lowest priority): Layout engine
    // Expand search radius when Form Parser failed or unavailable (Document OCR mode)
    const shouldExpand = meta?.status === 'error' || meta?.status === 'empty';
    const effectiveTemplate = shouldExpand
      ? this.expandSearchRadius(this.template, 1.5)
      : this.template;

    const allTokens = ocrResult.pages.flatMap(page => page.tokens);
    const layoutFields = extractFields(allTokens, effectiveTemplate);
    const layoutMap = fieldsToMap(layoutFields);

    // Strategy 3: Form Parser tables
    const tableMap = this.extractFromTables(ocrResult);

    // Strategy 2: Form Parser key-value entities (skip if API error)
    const formMap = meta?.status !== 'error'
      ? this.extractFromFormFields(ocrResult.formFields || [])
      : {};

    // Strategy 1 (highest priority): Text regex patterns on fullText
    const textMap = extractFromText(ocrResult.fullText, this.documentType);

    // Merge: Text patterns > Form Parser > Tables > Layout Engine
    const merged = { ...layoutMap, ...tableMap, ...formMap, ...textMap };

    // Log coverage for debugging
    const templateKeys = Object.keys(this.template);
    const filled = templateKeys.filter(k => merged[k]);
    console.log(`[Parse] ${this.documentType}: ${filled.length}/${templateKeys.length} fields extracted (formParser: ${meta?.status ?? 'unknown'})`);

    return this.postProcess(merged);
  }

  /**
   * Map Form Parser entities to PropertyJson field paths.
   * Matches entity field names against template keywords.
   * Uses fuzzyMatch for resilience against OCR variations.
   */
  private extractFromFormFields(formFields: FormField[]): Record<string, string> {
    const result: Record<string, string> = {};
    if (formFields.length === 0) return result;

    // Build a reverse map: keyword → fieldPath from the template
    const keywordToPath = new Map<string, string>();
    for (const [fieldPath, fieldDef] of Object.entries(this.template)) {
      const keywords = [fieldDef.keyword, ...(fieldDef.alternateKeywords || [])];
      for (const kw of keywords) {
        keywordToPath.set(normalizeJapanese(kw), fieldPath);
      }
    }

    for (const field of formFields) {
      if (!field.fieldName || !field.fieldValue) continue;
      const normalizedName = normalizeJapanese(field.fieldName);

      // Direct match
      const path = keywordToPath.get(normalizedName);
      if (path) {
        // Only overwrite if higher confidence or not yet set
        if (!result[path] || field.confidence > 0.8) {
          result[path] = field.fieldValue.trim();
        }
        continue;
      }

      // Fuzzy match: check if any keyword fuzzy-matches the entity name
      for (const [keyword, fieldPath] of keywordToPath) {
        if (fuzzyMatch(normalizedName, keyword)) {
          if (!result[fieldPath]) {
            result[fieldPath] = field.fieldValue.trim();
          }
          break;
        }
      }
    }

    return result;
  }

  /**
   * Extract data from Form Parser tables.
   * Looks for tables with header rows matching template keywords.
   */
  private extractFromTables(ocrResult: OcrResult): Record<string, string> {
    const result: Record<string, string> = {};
    const tables = ocrResult.tables;
    if (!tables || tables.length === 0) return result;

    // Build keyword → fieldPath map
    const keywordToPath = new Map<string, string>();
    for (const [fieldPath, fieldDef] of Object.entries(this.template)) {
      keywordToPath.set(normalizeJapanese(fieldDef.keyword), fieldPath);
    }

    for (const table of tables) {
      // Try to match header cells to template keywords
      const headerTexts = table.headerRows.flatMap(row =>
        row.map(cell => normalizeJapanese(cell.text))
      );

      for (const bodyRow of table.bodyRows) {
        for (let ci = 0; ci < bodyRow.length; ci++) {
          const cellText = bodyRow[ci].text.trim();
          if (!cellText) continue;

          // Check if any header or adjacent cell matches a keyword
          if (ci < headerTexts.length) {
            const headerNorm = headerTexts[ci];
            const path = keywordToPath.get(headerNorm);
            if (path && !result[path]) {
              result[path] = cellText;
            }
          }

          // Also check if cell itself is a keyword, and next cell is the value
          const cellNorm = normalizeJapanese(cellText);
          const path = keywordToPath.get(cellNorm);
          if (path && ci + 1 < bodyRow.length) {
            const valueText = bodyRow[ci + 1].text.trim();
            if (valueText && !result[path]) {
              result[path] = valueText;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Expand maxDistance for all layout template fields.
   * Used when Form Parser failed and we need Layout Engine to search more aggressively.
   */
  private expandSearchRadius(template: LayoutTemplate, factor: number): LayoutTemplate {
    const expanded: LayoutTemplate = {};
    for (const [key, def] of Object.entries(template)) {
      expanded[key] = { ...def, maxDistance: (def.maxDistance || 200) * factor };
    }
    return expanded;
  }

  /**
   * Override in subclasses to add document-specific post-processing.
   */
  protected postProcess(rawMap: Record<string, string>): Record<string, string> {
    return this.deduplicateUnits(rawMap);
  }

  /**
   * Remove duplicate units (㎡㎡, 円円, 階階 etc.) from all values.
   * Applied as the final step in all parsers.
   */
  private deduplicateUnits(map: Record<string, string>): Record<string, string> {
    const result = { ...map };
    for (const [key, value] of Object.entries(result)) {
      if (!value) continue;
      result[key] = value
        .replace(/(㎡){2,}/g, '㎡')
        .replace(/(円){2,}/g, '円')
        .replace(/(階){2,}/g, '階')
        .replace(/(m²){2,}/g, 'm²');
    }
    return result;
  }
}
