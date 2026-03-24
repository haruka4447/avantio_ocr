import { NextRequest, NextResponse } from 'next/server';
import { listDocuments } from '@/services/documentService';
import { getProperty, updatePropertyStatus } from '@/services/propertyService';
import { supabaseAdmin } from '@/lib/supabase';
import type { PropertyJson } from '@/models/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `あなたは不動産の重要事項説明書データ抽出AIです。
OCRテキストから必要な情報のみを正確に抽出してください。

# ルール（厳守）
- 推測禁止。不明は "" を返す
- 同じ項目が複数ある場合は最も明確な値を採用
- OCRの誤認識（空白・改行・全角半角）を考慮する

# 抽出優先順位
1. キーバリュー（例：所在：〇〇）
2. 表
3. 文章

# 正規化
- 空白・改行は無視
- 数値は結合（例：1 1 4 0 → 1140）

# フォーマット
- 金額：数字のみ
- 面積：数字+㎡
- 該当なし：""（null禁止）

# チェックボックス
- ■：該当
- □：非該当

# 注意
- 類似項目を混同しない（例：地積と延床面積）
- 別項目の値を流用しない

# 出力
以下のJSON形式で出力してください。必ず有効なJSONのみを出力し、それ以外のテキストは含めないでください。

{
  "property": {
    "address": "所在（例：大阪市東住吉区住道矢田一丁目）",
    "land_number": "地番（例：25番19）",
    "land_type": "地目（例：宅地）",
    "land_area": "地積（例：171.87㎡）",
    "total_trading_area": "取引対象面積合計",
    "building_name": "建物名称",
    "building_structure": "構造（例：木造）",
    "building_area": "建物延べ面積",
    "building_date": "築年月日",
    "floors": "階数",
    "usage_type": "用途（例：共同住宅）",
    "land_area_basis": "土地売買の対象面積の根拠（公簿/実測）",
    "survey_status": "実測（済/未済）",
    "survey_settlement": "実測清算（有/無）",
    "survey_type": "測量面積の種類（現況平面図/確定測量図/地積測量図）",
    "incomplete_property": "未完成物件（該当/非該当）"
  },
  "building": {
    "building_number": "家屋番号",
    "address": "建物の所在",
    "residential_address": "住居表示",
    "structure": "構造（例：木造(在来軸組工法)）",
    "usage": "種類（例：共同住宅）",
    "floors": "階数",
    "area": "延べ床面積合計（例：約311.04㎡）",
    "floor_area_1f": "1階床面積（例：約102.80㎡）",
    "floor_area_2f": "2階床面積",
    "floor_area_3f": "3階床面積",
    "built_date": "新築年月日",
    "note": "建物に関する特記事項",
    "registry_owner_address": "建物登記 名義人住所",
    "registry_owner_name": "建物登記 名義人氏名",
    "performance_evaluation": "住宅性能評価（該当/非該当）",
    "performance_cert": "住宅性能評価書の交付（有/無）",
    "design_performance": "設計住宅性能評価書（有/空文字）",
    "construction_performance": "建設住宅性能評価書（有/空文字）"
  },
  "ownership": [
    {
      "name": "所有者・名義人の氏名",
      "address": "所有者の住所",
      "share": "持分（例：1/1）",
      "right_type": "権利の種類（例：所有権）",
      "registration_date": "登記日",
      "cause": "原因（例：売買）"
    }
  ],
  "mortgage": [
    {
      "mortgage_type": "抵当権/根抵当権",
      "amount": "債権額・極度額",
      "interest_rate": "利率",
      "debtor": "債務者",
      "creditor": "債権者/抵当権者",
      "registration_date": "登記日",
      "cause": "原因"
    }
  ],
  "contract": {
    "seller_name": "売主の氏名・名称",
    "seller_address": "売主の住所",
    "seller_same_as_registry": "登記名義人と同じ/異なる",
    "buyer_name": "買主の氏名・名称",
    "buyer_address": "買主の住所",
    "price": "売買代金（数字のみ。例：114000000）",
    "deposit_amount": "手付金（数字のみ。例：5000000）",
    "fixed_asset_tax": "固定資産税等年税額",
    "tax_base_date": "公租公課の起算日（例：4月1日）",
    "penalty_type": "違約金の種類（手付金の額 or 売買代金）",
    "penalty_rate": "違約金率（例：10 = 10%）",
    "contract_date": "契約日",
    "delivery_date": "引渡日",
    "third_party_occupation": "第三者による占有（有/無）",
    "third_party_occupation_note": "第三者占有の備考",
    "special_conditions": "特約事項・特記事項",
    "cancel_deposit": "手付解除（有/空文字）",
    "cancel_deposit_article": "手付解除の条文番号（例：13）",
    "cancel_loss": "引渡前の滅失・毀損の場合の解除（有/空文字）",
    "cancel_loss_article": "条文番号",
    "cancel_breach": "契約違反による解除（有/空文字）",
    "cancel_breach_article": "条文番号",
    "cancel_loan": "融資利用の特約による解除（有/空文字）",
    "cancel_loan_article": "条文番号",
    "cancel_building_condition": "建築条件付きの特約による解除（有/空文字）",
    "cancel_defect": "契約不適合責任による解除（有/空文字）",
    "cancel_defect_article": "条文番号",
    "cancel_replacement": "買い換え契約の特約による解除（有/空文字）",
    "cancel_antisocial": "反社会的勢力排除条項に基づく解除（有/空文字）",
    "penalty_rate_decimal": "違約金率を小数形式で（10%→0.1, 20%→0.2）",
    "deposit_protection": "手付金等保全措置（講じません/講じます）",
    "deposit_protection_incomplete": "未完成物件の場合の保全措置（有/空文字）",
    "warranty_measure": "契約不適合責任の履行に関する措置（講ずる/講じない）",
    "warranty_content": "措置の内容",
    "installment_sale": "割賦販売（有/無）",
    "land_survey_settlement": "土地の測量清算（有/無）",
    "payment_protection": "支払金保全措置（講じる/講じない）",
    "long_term_product": "長期使用製品安全点検制度（該当/非該当）"
  },
  "hazard": {
    "hazard_type": "災害種別",
    "risk_level": "危険度",
    "zone_name": "区域名",
    "flood_depth": "想定浸水深"
  },
  "zoning": {
    "area_classification": "区域区分（市街化区域/市街化調整区域/非線引き区域）",
    "use_district": "用途地域（例：第一種住居地域）※正式名称で",
    "fire_zone": "防火地域/準防火地域",
    "building_coverage_ratio": "指定建ぺい率（数字のみ。例：80）",
    "building_coverage_relaxation": "建ぺい率の緩和（有/無）",
    "floor_area_ratio": "指定容積率（数字のみ。例：200）",
    "road_setline": "道路斜線制限（有/無）",
    "adjacent_setline": "隣地斜線制限（有/無）",
    "north_setline": "北側斜線制限（有/無）",
    "shadow_regulation": "日影規制（有/無）",
    "absolute_height": "絶対高さ制限（有/無）",
    "building_agreement": "建築協定（有/無）",
    "city_plan_road": "都市計画道路等（有/無）",
    "land_readjustment": "土地区画整理法（有/無）",
    "ordinance_restrictions": "条例等による制限（有/無）",
    "floor_area_ratio_type": "容積率制限タイプ（12m未満/12m以上）",
    "land_readjustment_project": "土地区画整理事業（有/無）",
    "aviation_law": "航空法の制限（有/空文字）",
    "land_development_law": "宅地造成及び特定盛土等規制法の制限（有/空文字）",
    "landscape_law": "景観法の制限（有/空文字）",
    "dense_area_law": "密集市街地整備法の制限（有/空文字）"
  },
  "road": {
    "direction": "接道方向（北/南/東/西）",
    "road_type": "公道/私道",
    "road_category": "道路の種類（例：42条2項）",
    "road_category_display": "道路の種類の表示形式（例：道路の種類 42 条 2項）",
    "width": "幅員（例：約4.00）※数字のみ",
    "frontage_length": "接道長さ（例：約13.010）※数字のみ",
    "setback": "セットバック（有/無）",
    "setback_area": "セットバック面積",
    "private_road_change": "私道の変更又は廃止の制限（有/無/公道につき該当しない）",
    "article43": "法43条2項2号の適用（有/無）",
    "flag_lot_restriction": "路地状敷地の制限（有/無）",
    "diagram_type": "概略図（別紙/下記に表示）"
  },
  "private_road": {
    "has_burden": "私道負担（有/無）",
    "burden_area": "負担面積（例：2.00㎡）",
    "burden_share": "持分（例：1/1）",
    "burden_cost": "負担金（例：無し）",
    "setback_area": "セットバック部分の面積",
    "note": "私道に関する備考"
  },
  "infrastructure": {
    "water_type": "飲用水（公営水道/私営水道/井戸）",
    "water_road_pipe": "水道 前面道路配管（有/無）",
    "water_site_pipe": "水道 敷地内配管（有/無）",
    "gas_type": "ガス（都市ガス/プロパン）",
    "gas_road_pipe": "ガス 前面道路配管（有/無）",
    "gas_site_pipe": "ガス 敷地内配管（有/無）",
    "electricity": "電気（例：関西電力）",
    "sewage_type": "汚水（公共下水/個別浄化槽/集中浄化槽）",
    "sewage_road_pipe": "汚水 前面道路配管（有/無）",
    "sewage_site_pipe": "汚水 敷地内配管（有/無）",
    "drainage_type": "雑排水（公共下水/集中浄化槽/個別浄化槽）",
    "drainage_road_pipe": "雑排水 前面道路配管（有/無）",
    "drainage_site_pipe": "雑排水 敷地内配管（有/無）",
    "rainwater_type": "雨水（公共下水/側溝等/浸透式）"
  },
  "disaster_zone": {
    "development_disaster_zone": "造成宅地防災区域（内/外）",
    "landslide_zone": "土砂災害警戒区域（内/外）",
    "tsunami_zone": "津波災害警戒区域（内/外/未指定）",
    "flood_hazard_map": "洪水ハザードマップ（内/外）",
    "rainwater_hazard_map": "内水ハザードマップ（内/外）",
    "storm_surge_hazard_map": "高潮ハザードマップ（内/外）"
  },
  "loan": {
    "has_mediation": "斡旋の有無（有/無）",
    "loan_deadline": "融資利用の特約の期限（例：令和8年3月13日）",
    "bank_name": "金融機関名（例：紀陽銀行）",
    "loan_amount": "融資額（数字のみ。例：98000000）",
    "interest_rate": "金利（例：1.750%迄）",
    "loan_period": "借入期間（例：30年）",
    "repayment_method": "返済方法（例：元利均等）",
    "guarantee_fee": "保証料（例：2156000）",
    "loan_fee": "ローン事務手数料（例：200000）"
  },
  "building_inspection": {
    "confirmation_label": "建築確認申請",
    "confirmation_status": "受検済/受検予定/未受検",
    "confirmation_detail": "受検（■有・□無）の後の日付（例：受検（■有・□無）\\n令和7年8月18日）",
    "confirmation_number": "建築確認番号（例：第 R07確認建築近確0001140 号）※「第」「号」を含める",
    "confirmation_date": "建築確認日",
    "interim1_label": "中間検査の名称（例：中 間 検 査　(基礎)）",
    "interim1_status": "受検済/受検予定/未受検",
    "interim1_detail": "受検（■有・□無）の後の日付",
    "interim_inspection_number": "中間検査(基礎)の番号（例：第 R07確合建築近確0001670 号）",
    "interim2_label": "2つ目の中間検査の名称（例：中 間 検 査　(建方)）",
    "interim2_status": "受検済/受検予定/未受検",
    "interim2_detail": "受検（■有・□無）の後の日付",
    "interim2_number": "中間検査(建方)の番号",
    "completion_label": "完了検査の名称（例：完 了 検 査）",
    "completion_status": "受検済/受検予定/未受検",
    "completion_inspection_date": "完了検査日",
    "completion_inspection_number": "完了検査番号",
    "inspection_sticker": "検査済証ステッカー（有/空文字）"
  },
  "attachments": {
    "item1": "添付書類1（例：売買契約書（案））",
    "item2": "添付書類2（例：位置図）",
    "item3": "添付書類3（例：土地登記事項証明書（土地登記簿謄本））",
    "item4": "添付書類4（例：公図（写し））",
    "item5": "添付書類5（例：地積測量図(写し)）",
    "item6": "添付書類6（例：意匠図(配置図、平面図、立面図)）",
    "item7": "添付書類7（例：建築確認済証・申請書1～6面（写し)）",
    "item8": "添付書類8（例：アフターサービス基準）",
    "item9": "添付書類9（例：水害ハザードマップ）",
    "item10": "添付書類10（例：中間検査合格証(基礎・建方)）"
  }
}`;

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

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

    // Get all documents with OCR results
    const documents = await listDocuments(property_id);
    const ocrDocs = documents.filter(d => d.ocr_status === 'completed' && d.ocr_result);

    if (ocrDocs.length === 0) {
      return NextResponse.json({ error: 'No OCR results available' }, { status: 400 });
    }

    // Build prompt with data ordered by extraction priority:
    // 1. キーバリュー (highest priority)
    // 2. 表
    // 3. 文章 (lowest priority)
    const docTypeLabel: Record<string, string> = {
      registry: '登記簿謄本',
      contract: '売買契約書',
      drawing: '建物図面',
      hazard: 'ハザードマップ',
      permit: '建築確認関連',
      other: 'その他',
    };

    // Token budget per document for fullText fallback
    const FULLTEXT_MAX_CHARS = 3000;

    let totalFormFields = 0;
    let totalTables = 0;
    let fullTextIncluded = 0;
    let fullTextTruncated = 0;

    const docTexts = ocrDocs.map(d => {
      const label = docTypeLabel[d.document_type] || d.document_type;
      const meta = d.ocr_result?.formParserMeta;
      const sections: string[] = [`--- ${label}: ${d.file_name} ---`];

      let hasStructuredData = false;

      // Priority 1: キーバリューペア（最も信頼性が高い）
      const formFields = d.ocr_result?.formFields;
      if (formFields && formFields.length > 0) {
        const kvPairs = formFields
          .filter((f: { fieldName: string; fieldValue: string; confidence: number }) =>
            f.fieldName && f.fieldValue)
          .sort((a: { confidence: number }, b: { confidence: number }) =>
            b.confidence - a.confidence)
          .map((f: { fieldName: string; fieldValue: string }) =>
            `  ${f.fieldName}: ${f.fieldValue}`)
          .join('\n');
        if (kvPairs) {
          sections.push(`[キーバリューペア]\n${kvPairs}`);
          hasStructuredData = true;
          totalFormFields += formFields.length;
        }
      }

      // Priority 2: 表データ
      const tables = d.ocr_result?.tables;
      if (tables && tables.length > 0) {
        const tableTexts = tables.map((t: { headerRows: Array<Array<{text: string}>>; bodyRows: Array<Array<{text: string}>>}, i: number) => {
          const headers = t.headerRows.map(row => row.map(c => c.text).join(' | ')).join('\n');
          const body = t.bodyRows.map(row => row.map(c => c.text).join(' | ')).join('\n');
          return `  [表${i + 1}]\n  ${headers}\n  ${body}`;
        }).join('\n');
        sections.push(`[表データ]\n${tableTexts}`);
        hasStructuredData = true;
        totalTables += tables.length;
      }

      // Priority 3: OCR全文テキスト
      // - キーバリュー/表がある場合: fullTextは省略（トークン節約）
      // - ない場合: fullTextを上限付きで送る（フォールバック）
      const fullText = d.ocr_result?.fullText || '';
      if (!hasStructuredData && fullText) {
        if (fullText.length > FULLTEXT_MAX_CHARS) {
          sections.push(`[OCR全文（先頭${FULLTEXT_MAX_CHARS}文字）]\n${fullText.substring(0, FULLTEXT_MAX_CHARS)}...`);
          fullTextTruncated++;
        } else {
          sections.push(`[OCR全文]\n${fullText}`);
        }
        fullTextIncluded++;
      } else if (hasStructuredData && fullText) {
        // 構造化データがある場合でも、キーバリューで拾えない自由記述を補完
        // 先頭1000文字のみ送る
        const supplementMax = 1000;
        if (fullText.length > supplementMax) {
          sections.push(`[補足テキスト（先頭${supplementMax}文字）]\n${fullText.substring(0, supplementMax)}...`);
        }
      }

      // メタ情報
      if (meta && meta.status !== 'success') {
        sections.push(`[注意: この書類のフォーム解析は${meta.status === 'error' ? '失敗' : '空結果'}でした。OCR全文から慎重に抽出してください]`);
      }

      return sections.join('\n\n');
    }).join('\n\n');

    console.log(`[AI-Parse] Prompt stats: ${ocrDocs.length} docs, ${totalFormFields} formFields, ${totalTables} tables, fullText included: ${fullTextIncluded}, truncated: ${fullTextTruncated}`);

    const prompt = `${SYSTEM_PROMPT}\n\n以下は物件に関する全書類のデータです:\n\n${docTexts}`;

    // Single Gemini call
    const resultText = await callGemini(prompt);
    const propertyJson: PropertyJson = JSON.parse(resultText);

    // Update property with parsed data
    const updateData: Record<string, unknown> = {
      property_json: propertyJson,
      updated_at: new Date().toISOString(),
      status: 'parsed',
    };

    // Also update top-level columns
    if (propertyJson.property?.address) updateData.address = propertyJson.property.address;
    if (propertyJson.property?.land_number) updateData.land_number = propertyJson.property.land_number;
    if (propertyJson.property?.land_type) updateData.land_type = propertyJson.property.land_type;
    if (propertyJson.property?.land_area) updateData.land_area = propertyJson.property.land_area;
    if (propertyJson.property?.building_name) updateData.building_name = propertyJson.property.building_name;
    if (propertyJson.property?.building_structure) updateData.building_structure = propertyJson.property.building_structure;
    if (propertyJson.property?.building_area) updateData.building_area = propertyJson.property.building_area;
    if (propertyJson.property?.building_date) updateData.building_date = propertyJson.property.building_date;
    if (propertyJson.property?.floors) updateData.floors = propertyJson.property.floors;
    if (propertyJson.property?.usage_type) updateData.usage_type = propertyJson.property.usage_type;

    const { error } = await supabaseAdmin
      .from('properties')
      .update(updateData)
      .eq('id', property_id);

    if (error) throw new Error(`Failed to update property: ${error.message}`);

    return NextResponse.json({
      success: true,
      documents_analyzed: ocrDocs.length,
      property_json: propertyJson,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
