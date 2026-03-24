import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import type { PropertyJson, ExcelMapping } from '../models/types';
import { excelMapping } from './excelMapping';
import { checkboxMappings } from './checkboxMapping';
import { addDiagonalLines } from './drawings';

/**
 * Detect cells where the template already provides units (via numFmt or adjacent cell).
 * These cells should receive numeric values only to avoid unit duplication.
 */
function detectNumericCells(ws: ExcelJS.Worksheet, cellRefs: string[]): Set<string> {
  const UNIT_CHARS = ['㎡', '円', 'm²', '%'];
  const result = new Set<string>();

  for (const ref of cellRefs) {
    const cell = ws.getCell(ref);
    const fmt = cell.numFmt || '';

    // Check 1: numFmt contains a unit string (e.g. 0.00"㎡", #,##0"円", "約"0.00)
    if (fmt && UNIT_CHARS.some(u => fmt.includes(u))) {
      result.add(ref);
      continue;
    }
    // numFmt with "約" prefix also implies numeric input
    if (fmt && fmt.includes('約')) {
      result.add(ref);
      continue;
    }
    // Plain numeric numFmt (e.g. "0.00", "#,##0")
    if (fmt && /^[#0,.\s]+$/.test(fmt)) {
      result.add(ref);
      continue;
    }

    // Check 2: adjacent cell (to the right, within 8 cols) contains a standalone unit
    const colIdx = cell.col;
    const row = cell.row;
    for (let offset = 1; offset <= 8; offset++) {
      const neighbor = ws.getCell(row, colIdx + offset);
      const neighborText = typeof neighbor.value === 'string' ? neighbor.value.trim() : '';
      if (UNIT_CHARS.includes(neighborText)) {
        result.add(ref);
        break;
      }
      // Stop scanning if the neighbor has non-empty, non-unit content
      if (neighbor.value && typeof neighbor.value !== 'object') break;
    }
  }

  return result;
}

/**
 * Parse a string value into a number, stripping common Japanese units.
 * Returns null if the value is not numeric.
 */
function parseNumericValue(value: string): number | null {
  // Strip units and whitespace
  const cleaned = value
    .replace(/[㎡m²円階%約]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');

  if (cleaned === '' || isNaN(Number(cleaned))) return null;
  return Number(cleaned);
}

/**
 * Resolve a dot-notation path with array indexing against PropertyJson.
 */
function resolveFieldPath(json: PropertyJson, fieldPath: string): string | undefined {
  const arrayMatch = fieldPath.match(/^(\w+)\[(\d+)\]\.(.+)$/);
  if (arrayMatch) {
    const [, section, indexStr, field] = arrayMatch;
    const index = parseInt(indexStr, 10);
    const array = (json as unknown as Record<string, unknown>)[section];
    if (Array.isArray(array) && array[index]) {
      return (array[index] as Record<string, string>)[field];
    }
    return undefined;
  }

  const parts = fieldPath.split('.');
  if (parts.length === 2) {
    const [section, field] = parts;
    const obj = (json as unknown as Record<string, unknown>)[section];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return (obj as Record<string, string>)[field];
    }
  }

  return undefined;
}

function normalizeForMatch(text: string): string {
  return text
    .replace(/[\s　]/g, '')
    .replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

/**
 * Determine which diagonal lines to add based on PropertyJson values.
 * Lines indicate "not applicable" sections.
 */
function determineDiagonalLines(json: PropertyJson): string[] {
  const lines: string[] = [];
  const val = (path: string) => resolveFieldPath(json, path) || '';

  // 登記 — 土地乙区: 担保権なしの場合
  if (val('mortgage[0].mortgage_type') === '' && json.mortgage.length === 0) {
    lines.push('registry_land_otsu');
  }

  // 登記 — 建物: 新築未登記の場合
  if (val('building.registry_owner_name')?.includes('未登記') || val('building.building_number')?.includes('未定')) {
    lines.push('registry_building');
  }

  // 市街化調整区域: 市街化区域の場合は調整区域セクション不要
  if (val('zoning.area_classification') === '市街化区域') {
    lines.push('urbanization_control');
    lines.push('development_permit');
  }

  // 土地区画整理: 無の場合
  if (val('zoning.land_readjustment') === '無') {
    lines.push('land_readjustment_note');
  }

  // その他の建築制限: 特に無しの場合
  if (val('zoning.other_restrictions') === '' || val('zoning.other_restrictions')?.includes('無')) {
    lines.push('other_building_restriction');
  }

  // 条例等: 無の場合
  if (val('zoning.ordinance_restrictions') === '無') {
    lines.push('ordinance_restriction');
  }

  // アスベスト: 調査なしの場合 (default)
  lines.push('asbestos');

  // 耐震診断: 新築の場合は不要
  lines.push('seismic');

  // 契約解除備考: 通常は不要
  lines.push('cancellation_note');

  // 私道備考: 不要の場合
  lines.push('private_road_note');

  // 金銭貸借追加行: 1行のみの場合
  lines.push('loan_extra');

  // 割賦販売: 無の場合
  if (val('contract.installment_sale') !== '有') {
    lines.push('installment');
  }

  // 土地測量清算: 無の場合
  if (val('contract.land_survey_settlement') !== '有') {
    lines.push('land_survey');
  }

  // 長期使用製品: 非該当の場合 (default)
  lines.push('long_term_product');

  // 支払金保全: 講じないの場合
  if (val('contract.payment_protection') !== '講じる') {
    lines.push('payment_protection');
  }

  return lines;
}

/**
 * Replace □ with ■ inside cell text strings (for cells where the checkbox
 * is embedded within a longer text, e.g. "売買の□売　主" → "売買の■売　主").
 */
function applyTextReplacements(ws: ExcelJS.Worksheet, json: PropertyJson) {
  const val = (path: string) => resolveFieldPath(json, path) || '';

  // 取引態様 (row 30): "売買の□売　主" → "売買の■売　主"
  // This is always 売主 for this business
  replaceInCell(ws, 'G30', '□売', '■売');
  replaceInCell(ws, 'G31', '□売', '■売');

  // 供託所等 (rows 34-39): always 保証協会
  for (let r = 34; r <= 39; r++) {
    const cell = ws.getCell('G' + r);
    if (getCellText(cell) === '□') {
      cell.value = '■';
    }
  }

  // 私道負担 有無 (row 355-356): "□有　・　□無" → "■有　・　□無"
  if (val('private_road.has_burden') === '有') {
    replaceInCell(ws, 'J355', '□有', '■有');
    replaceInCell(ws, 'J356', '□有', '■有');
  } else if (val('private_road.has_burden') === '無') {
    replaceInCell(ws, 'J355', '□無', '■無');
    replaceInCell(ws, 'J356', '□無', '■無');
  }

  // 登記 土地甲区 — 所有権以外の権利 (row 134)
  // 所有権のみの場合は G134=■(無), 他の権利がある場合は E134=■(有)
  const rightType = val('ownership[0].right_type');
  if (rightType === '所有権' || !rightType) {
    ws.getCell('G134').value = '■';
  } else {
    ws.getCell('E134').value = '■';
  }

  // 登記 土地乙区 — 担保権 (row 137)
  const mortgageType = val('mortgage[0].mortgage_type');
  if (mortgageType) {
    ws.getCell('E137').value = '■';
  } else {
    ws.getCell('G137').value = '■';
  }

  // 登記 建物甲区/乙区 — 新築未登記の場合は無 (rows 144, 147)
  const buildingOwnerName = val('building.registry_owner_name');
  if (buildingOwnerName && !buildingOwnerName.includes('未登記')) {
    ws.getCell('E144').value = '■';
  } else {
    ws.getCell('G144').value = '■';
  }
  // 建物乙区は常に無（新築のため）
  ws.getCell('G147').value = '■';
}

function getCellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'richText' in v) {
    return (v as { richText: Array<{ text: string }> }).richText.map(r => r.text).join('');
  }
  return '';
}

function replaceInCell(ws: ExcelJS.Worksheet, ref: string, search: string, replace: string) {
  const cell = ws.getCell(ref);
  const text = getCellText(cell);
  if (text.includes(search)) {
    cell.value = text.replace(search, replace);
  }
}

/**
 * Normalize full-width numbers to half-width in address/owner cells.
 */
function normalizeAddressCells(ws: ExcelJS.Worksheet) {
  const addressCells = ['K128', 'K129', 'K130', 'K131', 'K138', 'K139', 'K140', 'K141', 'E115', 'E116'];
  for (const ref of addressCells) {
    const cell = ws.getCell(ref);
    const text = getCellText(cell);
    if (text) {
      // Convert full-width digits to half-width
      const normalized = text.replace(/[０-９]/g, c =>
        String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30)
      );
      if (normalized !== text) {
        cell.value = normalized;
      }
    }
  }
}

/**
 * Apply Avantio-specific defaults for new construction properties.
 * These are values that are consistently the same for Avantio's business model
 * and can be pre-filled to reduce manual input.
 *
 * Only fills fields that are empty (does not overwrite OCR/AI extracted data).
 */
function applyAvantioDefaults(json: PropertyJson): PropertyJson {
  const result = JSON.parse(JSON.stringify(json)) as PropertyJson;

  const setDefault = (section: string, field: string, value: string) => {
    const obj = (result as unknown as Record<string, Record<string, string>>)[section];
    if (obj && !obj[field]) {
      obj[field] = value;
    }
  };

  // === 売主情報 (Avantio is always the seller) ===
  setDefault('contract', 'seller_name', '株式会社アバンティオ');
  setDefault('contract', 'seller_address', '大阪市中央区玉造二丁目25番1号アバンティオ玉造2階');
  setDefault('contract', 'seller_same_as_registry', '同じ');

  // === 新築物件のデフォルト ===
  setDefault('property', 'incomplete_property', '該当');
  setDefault('property', 'land_area_basis', '公簿');
  setDefault('property', 'survey_status', '未済');
  setDefault('property', 'survey_settlement', '無');

  // === 登記関連 ===
  if (result.ownership.length > 0) {
    if (!result.ownership[0].right_type) result.ownership[0].right_type = '所有権';
    if (!result.ownership[0].share) result.ownership[0].share = '1/1';
  }
  // 新築 → 建物は未登記
  setDefault('building', 'registry_owner_name', '新築のため未登記');

  // === 第三者占有 ===
  setDefault('contract', 'third_party_occupation', '無');

  // === 違約金 ===
  setDefault('contract', 'penalty_type', '売買代金');
  setDefault('contract', 'penalty_rate', '20');
  setDefault('contract', 'penalty_rate_decimal', '0.2');

  // === 契約解除条項 (Avantio standard contract) ===
  setDefault('contract', 'cancel_deposit', '有');
  setDefault('contract', 'cancel_deposit_article', '13');
  setDefault('contract', 'cancel_loss', '有');
  setDefault('contract', 'cancel_loss_article', '14');
  setDefault('contract', 'cancel_breach', '有');
  setDefault('contract', 'cancel_breach_article', '15');
  setDefault('contract', 'cancel_loan', '有');
  setDefault('contract', 'cancel_loan_article', '16');
  setDefault('contract', 'cancel_defect', '有');
  setDefault('contract', 'cancel_defect_article', '17');
  setDefault('contract', 'cancel_antisocial', '有');

  // === 保全措置 ===
  setDefault('contract', 'deposit_protection', '講じません');
  setDefault('contract', 'deposit_protection_incomplete', '有');
  setDefault('contract', 'warranty_measure', '講ずる');
  setDefault('contract', 'installment_sale', '無');
  setDefault('contract', 'land_survey_settlement', '無');
  setDefault('contract', 'payment_protection', '講じない');
  setDefault('contract', 'long_term_product', '非該当');

  // === 住宅性能評価 (新築は通常該当) ===
  setDefault('building', 'performance_evaluation', '該当');
  setDefault('building', 'performance_cert', '有');
  setDefault('building', 'design_performance', '有');
  setDefault('building', 'construction_performance', '有');

  // === 金銭貸借 ===
  setDefault('loan', 'has_mediation', '有');

  // === 供託所 ===
  setDefault('contract', 'deposit_guarantee_type', '保証協会');

  // === 道路関連 ===
  setDefault('road', 'diagram_type', '別紙');

  // === 建物検査 (新築デフォルト) ===
  setDefault('building_inspection', 'confirmation_label', '建築確認申請');
  setDefault('building_inspection', 'interim1_label', '中 間 検 査　(基礎)');
  setDefault('building_inspection', 'interim2_label', '中 間 検 査　(建方)');
  setDefault('building_inspection', 'completion_label', '完 了 検 査');
  setDefault('building_inspection', 'completion_status', '受検予定');
  setDefault('building_inspection', 'inspection_sticker', '有');

  // === 添付書類 (標準リスト) ===
  setDefault('attachments', 'item1', '売買契約書（案）');
  setDefault('attachments', 'item2', '位置図');
  setDefault('attachments', 'item3', '土地登記事項証明書');
  setDefault('attachments', 'item4', '公図（写し）');
  setDefault('attachments', 'item5', '地積測量図(写し)');
  setDefault('attachments', 'item6', '意匠図(配置図、平面図、立面図)');
  setDefault('attachments', 'item7', '建築確認済証・申請書1～6面（写し)');
  setDefault('attachments', 'item8', 'アフターサービス基準');
  setDefault('attachments', 'item9', '水害ハザードマップ');
  setDefault('attachments', 'item10', '中間検査合格証(基礎・建方)');

  return result;
}

/**
 * Generate Excel file from PropertyJson using the template.
 * Returns the Excel file as a Buffer.
 */
export async function generateExcel(
  propertyJson: PropertyJson,
  templatePath?: string,
  mapping?: ExcelMapping
): Promise<Buffer> {
  const effectiveMapping = mapping || excelMapping;
  const effectiveTemplatePath = templatePath ||
    process.env.TEMPLATE_PATH ||
    path.resolve(process.cwd(), '..', 'templates', 'jyusetsu_template.xlsx');

  // Apply Avantio-specific defaults before generation
  const json = applyAvantioDefaults(propertyJson);

  const workbook = new ExcelJS.Workbook();

  if (fs.existsSync(effectiveTemplatePath)) {
    await workbook.xlsx.readFile(effectiveTemplatePath);
  } else {
    workbook.addWorksheet('重要事項説明書');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in template');
  }

  // 1. Apply text value mapping
  // Build a set of cells where the template already provides units
  // (via numFmt or adjacent cell) so we write numeric values only
  const numericCells = detectNumericCells(worksheet, Object.keys(effectiveMapping));

  for (const [cellRef, fieldPath] of Object.entries(effectiveMapping)) {
    const value = resolveFieldPath(json, fieldPath);
    if (value === undefined || value === null) continue;

    if (numericCells.has(cellRef)) {
      // Strip unit suffix and write as number to preserve numFmt / avoid duplication
      const num = parseNumericValue(value);
      if (num !== null) {
        worksheet.getCell(cellRef).value = num;
      } else {
        // Non-numeric (e.g. "未定") — write as-is but clear numFmt to avoid garbled display
        const cell = worksheet.getCell(cellRef);
        cell.numFmt = '@'; // text format
        cell.value = value;
      }
    } else {
      worksheet.getCell(cellRef).value = value;
    }
  }

  // 2. Apply checkbox mappings (□ → ■)
  for (const cbMapping of checkboxMappings) {
    const fieldValue = resolveFieldPath(json, cbMapping.fieldPath);
    if (!fieldValue) continue;

    const normalizedValue = normalizeForMatch(fieldValue);

    for (const option of cbMapping.options) {
      const normalizedOption = normalizeForMatch(option.value);
      if (normalizedValue.includes(normalizedOption) || normalizedOption.includes(normalizedValue)) {
        worksheet.getCell(option.cell).value = '■';
      }
    }
  }

  // 3. Apply in-cell text replacements (□→■ within longer text)
  applyTextReplacements(worksheet, json);

  // 4. Normalize full-width numbers to half-width in address fields
  normalizeAddressCells(worksheet);

  // 5. Write to buffer
  let buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  // 6. Add diagonal lines (斜線) via XML injection
  const lineKeys = determineDiagonalLines(json);
  if (lineKeys.length > 0) {
    buffer = Buffer.from(await addDiagonalLines(buffer, lineKeys));
  }

  return buffer;
}
