import { NextRequest, NextResponse } from 'next/server';
import { listDocuments } from '@/services/documentService';
import { getProperty } from '@/services/propertyService';
import { supabaseAdmin } from '@/lib/supabase';
import type { PropertyJson } from '@/models/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * Identify fields that are missing or contain garbage values.
 * Returns a map of section.field -> description for Gemini to fill.
 */
function findGapFields(json: PropertyJson): Record<string, string> {
  const gaps: Record<string, string> = {};

  const FIELD_DEFS: Record<string, string> = {
    // building
    'building.area': '建物延べ床面積（例：311.04㎡）',
    'building.floors': '建物の階数（例：3階）',
    'building.address': '建物の所在（例：大阪市東住吉区住道矢田一丁目25番19）',
    'building.note': '建物の特記事項',
    // contract
    'contract.buyer_name': '買主の氏名・名称',
    'contract.buyer_address': '買主の住所',
    'contract.seller_address': '売主の住所',
    'contract.contract_date': '契約日（例：令和8年2月12日）',
    'contract.delivery_date': '引渡日',
    'contract.special_conditions': '特約事項（要約で）',
    'contract.tax_base_date': '公租公課の起算日（例：4月1日）',
    'contract.fixed_asset_tax': '固定資産税等年税額',
    // ownership
    'ownership.address': '最新の所有者住所（全文）',
    // loan
    'loan.loan_amount': '融資額（数字+円。例：98000000円）',
    'loan.loan_deadline': '融資利用の特約の期限（例：令和8年3月13日）',
    'loan.interest_rate': '金利',
    'loan.loan_period': '借入期間（例：35年）',
    // building_inspection
    'building_inspection.confirmation_number': '建築確認番号（例：第 R07確認建築近確0001140号）',
  };

  // Check each field
  for (const [path, description] of Object.entries(FIELD_DEFS)) {
    const [section, field] = path.split('.');
    let value: string | undefined;

    if (section === 'ownership') {
      const arr = json.ownership;
      if (arr && arr.length > 0) {
        value = (arr[0] as unknown as Record<string, string>)[field];
      }
    } else {
      const obj = (json as unknown as Record<string, Record<string, string>>)[section];
      if (obj) value = obj[field];
    }

    // Check if value is missing or garbage
    if (!value || isGarbageValue(value)) {
      gaps[path] = description;
    }
  }

  return gaps;
}

/**
 * Detect garbage values that Gemini should re-extract.
 */
function isGarbageValue(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return true;
  // Single character (not a meaningful value for most fields)
  if (v.length <= 2 && !/\d/.test(v)) return true;
  // Phone numbers misidentified as areas
  if (/^\d{2,4}-\d{3,4}-\d{3,4}/.test(v)) return true;
  // Template placeholder text
  if (v === '年月日' || v === '日') return true;
  // Contains OCR prefix garbage
  if (v.startsWith('、') || v.startsWith('設置場所')) return true;
  return false;
}

/**
 * Select minimal text from documents relevant to the gap fields.
 */
function selectRelevantText(
  documents: Array<{ document_type: string; file_name: string; ocr_result?: { fullText?: string } | null }>,
  gaps: Record<string, string>
): string {
  // Map gap fields to relevant document types
  const DOC_RELEVANCE: Record<string, string[]> = {
    'building.': ['contract', 'permit'],
    'contract.': ['contract'],
    'ownership.': ['registry'],
    'loan.': ['contract'],
    'building_inspection.': ['permit'],
  };

  const neededTypes = new Set<string>();
  for (const path of Object.keys(gaps)) {
    for (const [prefix, types] of Object.entries(DOC_RELEVANCE)) {
      if (path.startsWith(prefix)) {
        types.forEach(t => neededTypes.add(t));
      }
    }
  }

  // Collect text from relevant documents only, with character limits
  const MAX_CHARS_PER_DOC = 2000;
  const texts: string[] = [];

  for (const doc of documents) {
    if (!neededTypes.has(doc.document_type)) continue;
    const fullText = doc.ocr_result?.fullText;
    if (!fullText) continue;

    const truncated = fullText.length > MAX_CHARS_PER_DOC
      ? fullText.substring(0, MAX_CHARS_PER_DOC) + '...(省略)'
      : fullText;

    texts.push(`--- ${doc.document_type}: ${doc.file_name} ---\n${truncated}`);
  }

  return texts.join('\n\n');
}

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { property_id } = body;

    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 });
    }

    const property = await getProperty(property_id);
    const json = property.property_json as PropertyJson;

    if (!json) {
      return NextResponse.json({ error: 'No property_json. Run parse first.' }, { status: 400 });
    }

    // Step 1: Find gap fields
    const gaps = findGapFields(json);

    if (Object.keys(gaps).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No gaps to fill',
        filled_count: 0,
      });
    }

    // Step 2: Select minimal relevant text
    const documents = await listDocuments(property_id);
    const ocrDocs = documents.filter(d => d.ocr_status === 'completed' && d.ocr_result);
    const relevantText = selectRelevantText(ocrDocs, gaps);

    if (!relevantText) {
      return NextResponse.json({ error: 'No relevant OCR text found' }, { status: 400 });
    }

    // Step 3: Build targeted prompt (much smaller than full extraction)
    const gapList = Object.entries(gaps)
      .map(([path, desc]) => `  "${path}": "${desc}"`)
      .join(',\n');

    const prompt = `以下のOCRテキストから、指定されたフィールドのみを抽出してください。

# ルール
- 推測禁止。テキストに明記されている値のみ抽出
- 見つからない場合は "" を返す
- OCRの誤認識（空白・改行・全角半角）を考慮する
- ■はチェックあり、□はチェックなし

# 抽出対象フィールド
{
${gapList}
}

# 出力形式
上記フィールドのみを含むJSONを出力してください。例:
{"building.area": "311.04㎡", "contract.buyer_name": "山田太郎"}

# OCRテキスト
${relevantText}`;

    console.log(`[AI-Fill] ${Object.keys(gaps).length} gaps, prompt: ${prompt.length} chars`);

    // Step 4: Call Gemini
    const resultText = await callGemini(prompt);
    const filledFields: Record<string, string> = JSON.parse(resultText);

    // Step 5: Merge into existing property_json (only fill gaps, never overwrite)
    const updated = JSON.parse(JSON.stringify(json)) as PropertyJson;
    let filledCount = 0;

    for (const [path, value] of Object.entries(filledFields)) {
      if (!value || value === '') continue;

      const [section, field] = path.split('.');

      if (section === 'ownership') {
        if (updated.ownership.length > 0) {
          const existing = (updated.ownership[0] as unknown as Record<string, string>)[field];
          if (!existing || isGarbageValue(existing)) {
            (updated.ownership[0] as unknown as Record<string, string>)[field] = value;
            filledCount++;
          }
        }
      } else {
        const obj = (updated as unknown as Record<string, Record<string, string>>)[section];
        if (obj) {
          const existing = obj[field];
          if (!existing || isGarbageValue(existing)) {
            obj[field] = value;
            filledCount++;
          }
        }
      }
    }

    // Step 6: Save
    const { error } = await supabaseAdmin
      .from('properties')
      .update({
        property_json: updated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', property_id);

    if (error) throw new Error(`Failed to update: ${error.message}`);

    return NextResponse.json({
      success: true,
      gaps_found: Object.keys(gaps).length,
      filled_count: filledCount,
      filled_fields: Object.keys(filledFields).filter(k => filledFields[k] !== ''),
      property_json: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI-Fill] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
