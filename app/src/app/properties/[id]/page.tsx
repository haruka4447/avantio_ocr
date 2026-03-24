'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface Property {
  id: string;
  address: string | null;
  land_number: string | null;
  land_type: string | null;
  land_area: string | null;
  building_name: string | null;
  building_structure: string | null;
  building_area: string | null;
  building_date: string | null;
  floors: string | null;
  usage_type: string | null;
  property_json: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface Document {
  id: string;
  document_type: string;
  file_name: string;
  ocr_status: string;
  parsed_data: Record<string, unknown> | null;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  registry: '登記簿謄本',
  contract: '売買契約書',
  drawing: '建物図面',
  hazard: 'ハザードマップ',
  permit: '建築確認関連',
  other: '未分類',
};

const DOC_TYPE_OPTIONS = [
  { value: 'other', label: '未分類' },
  { value: 'registry', label: '登記簿謄本' },
  { value: 'contract', label: '売買契約書' },
  { value: 'drawing', label: '建物図面' },
  { value: 'hazard', label: 'ハザードマップ' },
  { value: 'permit', label: '建築確認関連' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  ocr_processing: 'OCR処理中',
  parsed: '解析済',
  generated: '生成済',
  completed: '完了',
};

const OCR_STATUS_LABELS: Record<string, string> = {
  pending: '未処理',
  processing: '処理中',
  completed: '完了',
  failed: '失敗',
};

// ============================================================
// Shared select options
// ============================================================
const YES_NO = [
  { value: '', label: '（未設定）' }, { value: '有', label: '有' }, { value: '無', label: '無' },
];
const APPLICABLE = [
  { value: '', label: '（未設定）' }, { value: '該当', label: '該当' }, { value: '非該当', label: '非該当' },
];
const INSIDE_OUTSIDE = [
  { value: '', label: '（未設定）' }, { value: '内', label: '内' }, { value: '外', label: '外' },
];
const MEASURE_OPTS = [
  { value: '', label: '（未設定）' }, { value: '講ずる', label: '講ずる' }, { value: '講じない', label: '講じない' },
];

// ============================================================
// Section definitions for the manual input form
// ============================================================
interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  hint?: string; // auto-fill source hint
  colSpan?: 2; // span full width
}

interface SectionDef {
  title: string;
  jsonPath: string;
  fields: FieldDef[];
  defaultOpen?: boolean;
}

const SECTIONS: SectionDef[] = [
  {
    title: '1. 不動産の表示 — 土地',
    jsonPath: 'property',
    defaultOpen: true,
    fields: [
      { key: 'address', label: '所在', hint: '登記簿' },
      { key: 'land_number', label: '地番', hint: '登記簿' },
      { key: 'land_type', label: '地目・現況', hint: '登記簿' },
      { key: 'land_area', label: '地積（登記簿）', hint: '登記簿' },
      { key: 'total_trading_area', label: '取引対象面積合計' },
      { key: 'land_area_basis', label: '対象面積根拠', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '公簿', label: '公簿' }, { value: '実測', label: '実測' },
      ], hint: 'デフォルト' },
      { key: 'survey_status', label: '実測', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '済', label: '済' }, { value: '未済', label: '未済' },
      ], hint: 'デフォルト' },
      { key: 'survey_settlement', label: '実測清算', type: 'select', options: YES_NO, hint: 'デフォルト' },
      { key: 'incomplete_property', label: '未完成物件', type: 'select', options: APPLICABLE, hint: 'デフォルト' },
    ],
  },
  {
    title: '1. 不動産の表示 — 建物',
    jsonPath: 'building',
    defaultOpen: true,
    fields: [
      { key: 'address', label: '所在', hint: '登記簿/確認済証' },
      { key: 'building_number', label: '家屋番号', hint: '登記簿' },
      { key: 'residential_address', label: '住居表示' },
      { key: 'usage', label: '種類', hint: '確認済証' },
      { key: 'structure', label: '構造', hint: '確認済証' },
      { key: 'floor_area_1f', label: '床面積 1階', hint: '確認済証' },
      { key: 'floor_area_2f', label: '床面積 2階', hint: '確認済証' },
      { key: 'floor_area_3f', label: '床面積 3階', hint: '確認済証' },
      { key: 'area', label: '床面積 合計', hint: '確認済証' },
      { key: 'note', label: '特記事項', type: 'textarea', colSpan: 2 },
    ],
  },
  {
    title: '2. 売主の表示',
    jsonPath: 'contract',
    fields: [
      { key: 'seller_name', label: '売主 氏名', hint: 'デフォルト' },
      { key: 'seller_address', label: '売主 住所', hint: 'デフォルト' },
      { key: 'seller_same_as_registry', label: '登記名義人と', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '同じ', label: '同じ' }, { value: '異なる', label: '異なる' },
      ], hint: 'デフォルト' },
      { key: 'third_party_occupation', label: '第三者による占有', type: 'select', options: YES_NO, hint: 'デフォルト' },
      { key: 'third_party_occupation_note', label: '占有 備考', colSpan: 2 },
    ],
  },
  {
    title: '3. 登記記録 — 所有権',
    jsonPath: 'ownership_0',
    fields: [
      { key: 'name', label: '名義人 氏名', hint: '登記簿' },
      { key: 'address', label: '名義人 住所', hint: '登記簿' },
      { key: 'share', label: '持分', hint: '登記簿' },
      { key: 'right_type', label: '権利の種類', hint: 'デフォルト' },
    ],
  },
  {
    title: '4. 都市計画法・建築基準法',
    jsonPath: 'zoning',
    fields: [
      { key: 'area_classification', label: '区域区分', type: 'select', options: [
        { value: '', label: '（未設定）' },
        { value: '市街化区域', label: '市街化区域' },
        { value: '市街化調整区域', label: '市街化調整区域' },
        { value: '非線引き区域', label: '非線引き区域' },
      ]},
      { key: 'use_district', label: '用途地域', type: 'select', options: [
        { value: '', label: '（未設定）' },
        { value: '第一種低層住居専用地域', label: '第一種低層住居専用地域' },
        { value: '第二種低層住居専用地域', label: '第二種低層住居専用地域' },
        { value: '第一種中高層住居専用地域', label: '第一種中高層住居専用地域' },
        { value: '第二種中高層住居専用地域', label: '第二種中高層住居専用地域' },
        { value: '第一種住居地域', label: '第一種住居地域' },
        { value: '第二種住居地域', label: '第二種住居地域' },
        { value: '準住居地域', label: '準住居地域' },
        { value: '準工業地域', label: '準工業地域' },
        { value: '近隣商業地域', label: '近隣商業地域' },
        { value: '商業地域', label: '商業地域' },
        { value: '工業地域', label: '工業地域' },
        { value: '工業専用地域', label: '工業専用地域' },
      ]},
      { key: 'fire_zone', label: '防火地域', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '防火地域', label: '防火地域' }, { value: '準防火地域', label: '準防火地域' },
      ]},
      { key: 'building_coverage_ratio', label: '指定建ぺい率 (%)' },
      { key: 'building_coverage_relaxation', label: '建ぺい率の緩和', type: 'select', options: YES_NO },
      { key: 'floor_area_ratio', label: '指定容積率 (%)' },
      { key: 'floor_area_ratio_type', label: '前面道路幅員', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '12m未満', label: '12m未満' }, { value: '12m以上', label: '12m以上' },
      ]},
      { key: 'road_setline', label: '道路斜線制限', type: 'select', options: YES_NO },
      { key: 'adjacent_setline', label: '隣地斜線制限', type: 'select', options: YES_NO },
      { key: 'north_setline', label: '北側斜線制限', type: 'select', options: YES_NO },
      { key: 'shadow_regulation', label: '日影規制', type: 'select', options: YES_NO },
      { key: 'absolute_height', label: '絶対高さ制限', type: 'select', options: YES_NO },
      { key: 'building_agreement', label: '建築協定', type: 'select', options: YES_NO },
      { key: 'city_plan_road', label: '都市計画道路等', type: 'select', options: YES_NO },
      { key: 'land_readjustment', label: '土地区画整理法', type: 'select', options: YES_NO },
      { key: 'land_readjustment_project', label: '土地区画整理事業', type: 'select', options: YES_NO },
      { key: 'ordinance_restrictions', label: '条例等による制限', type: 'select', options: YES_NO },
      { key: 'dense_area_law', label: '密集市街地整備法', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ]},
      { key: 'land_development_law', label: '宅地造成規制法', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ]},
      { key: 'aviation_law', label: '航空法', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ]},
      { key: 'landscape_law', label: '景観法', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ]},
    ],
  },
  {
    title: '5. 敷地と道路との関係',
    jsonPath: 'road',
    fields: [
      { key: 'direction', label: '接道方向', type: 'select', options: [
        { value: '', label: '（未設定）' },
        { value: '北', label: '北' }, { value: '南', label: '南' },
        { value: '東', label: '東' }, { value: '西', label: '西' },
      ]},
      { key: 'road_type', label: '公道/私道', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '公道', label: '公道' }, { value: '私道', label: '私道' },
      ]},
      { key: 'road_category_display', label: '道路の種類（表示）' },
      { key: 'width', label: '幅員 (m)' },
      { key: 'frontage_length', label: '接道長さ (m)' },
      { key: 'setback', label: 'セットバック', type: 'select', options: YES_NO },
      { key: 'private_road_change', label: '私道変更制限', type: 'select', options: YES_NO },
      { key: 'article43', label: '法43条2項2号', type: 'select', options: YES_NO },
      { key: 'flag_lot_restriction', label: '路地状敷地の制限', type: 'select', options: YES_NO },
      { key: 'diagram_type', label: '概略図', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '別紙', label: '別紙' }, { value: '下記に表示', label: '下記に表示' },
      ], hint: 'デフォルト' },
    ],
  },
  {
    title: '6. 私道負担',
    jsonPath: 'private_road',
    fields: [
      { key: 'has_burden', label: '私道負担', type: 'select', options: YES_NO },
      { key: 'burden_area', label: '負担面積 (㎡)' },
      { key: 'burden_share', label: '持分' },
      { key: 'burden_cost', label: '負担金' },
      { key: 'setback_area', label: 'セットバック面積 (㎡)' },
      { key: 'note', label: '備考', type: 'textarea', colSpan: 2 },
    ],
  },
  {
    title: '7. インフラ整備状況',
    jsonPath: 'infrastructure',
    fields: [
      { key: 'water_type', label: '飲用水', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '公営水道', label: '公営水道' },
        { value: '私営水道', label: '私営水道' }, { value: '井戸', label: '井戸' },
      ]},
      { key: 'water_road_pipe', label: '水道 前面道路配管', type: 'select', options: YES_NO },
      { key: 'water_site_pipe', label: '水道 敷地内配管', type: 'select', options: YES_NO },
      { key: 'water_private_pipe', label: '水道 私設管', type: 'select', options: YES_NO },
      { key: 'gas_type', label: 'ガス', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '都市ガス', label: '都市ガス' }, { value: 'プロパン', label: 'プロパン' },
      ]},
      { key: 'gas_road_pipe', label: 'ガス 前面道路配管', type: 'select', options: YES_NO },
      { key: 'gas_site_pipe', label: 'ガス 敷地内配管', type: 'select', options: YES_NO },
      { key: 'electricity', label: '電気' },
      { key: 'sewage_type', label: '汚水', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '公共下水', label: '公共下水' },
        { value: '個別浄化槽', label: '個別浄化槽' }, { value: '集中浄化槽', label: '集中浄化槽' },
      ]},
      { key: 'sewage_road_pipe', label: '汚水 前面道路配管', type: 'select', options: YES_NO },
      { key: 'sewage_site_pipe', label: '汚水 敷地内配管', type: 'select', options: YES_NO },
      { key: 'drainage_type', label: '雑排水', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '公共下水', label: '公共下水' },
        { value: '集中浄化槽', label: '集中浄化槽' }, { value: '個別浄化槽', label: '個別浄化槽' },
      ]},
      { key: 'drainage_road_pipe', label: '雑排水 前面道路配管', type: 'select', options: YES_NO },
      { key: 'drainage_site_pipe', label: '雑排水 敷地内配管', type: 'select', options: YES_NO },
      { key: 'drainage_private_pipe', label: '雑排水 私設管', type: 'select', options: YES_NO },
      { key: 'rainwater_type', label: '雨水', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '公共下水', label: '公共下水' },
        { value: '側溝等', label: '側溝等' }, { value: '浸透式', label: '浸透式' },
      ]},
    ],
  },
  {
    title: '9. 災害区域',
    jsonPath: 'disaster_zone',
    fields: [
      { key: 'development_disaster_zone', label: '造成宅地防災区域', type: 'select', options: INSIDE_OUTSIDE },
      { key: 'landslide_zone', label: '土砂災害警戒区域', type: 'select', options: INSIDE_OUTSIDE },
      { key: 'tsunami_zone', label: '津波災害警戒区域', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '内', label: '内' }, { value: '外', label: '外' }, { value: '未指定', label: '未指定' },
      ]},
      { key: 'tsunami_alert_zone', label: '津波警戒区域指定', type: 'select', options: YES_NO },
      { key: 'tsunami_special_zone', label: '津波特別警戒区域指定', type: 'select', options: YES_NO },
      { key: 'flood_hazard_map', label: '洪水ハザードマップ', type: 'select', options: INSIDE_OUTSIDE },
      { key: 'rainwater_hazard_map', label: '内水ハザードマップ', type: 'select', options: INSIDE_OUTSIDE },
      { key: 'storm_surge_hazard_map', label: '高潮ハザードマップ', type: 'select', options: INSIDE_OUTSIDE },
    ],
  },
  {
    title: '12. 住宅性能評価',
    jsonPath: 'building',
    fields: [
      { key: 'performance_evaluation', label: '住宅性能評価', type: 'select', options: APPLICABLE, hint: 'デフォルト' },
      { key: 'performance_cert', label: '評価書交付', type: 'select', options: YES_NO, hint: 'デフォルト' },
      { key: 'design_performance', label: '設計住宅性能評価書', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
      { key: 'construction_performance', label: '建設住宅性能評価書', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
    ],
  },
  {
    title: '13. 売買代金',
    jsonPath: 'contract',
    fields: [
      { key: 'price', label: '売買代金' },
      { key: 'deposit_amount', label: '手付金' },
      { key: 'penalty_type', label: '違約金の種類', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '手付金の額', label: '手付金の額' },
        { value: '売買代金', label: '売買代金の_%' },
      ], hint: 'デフォルト' },
      { key: 'penalty_rate', label: '違約金率 (%)', hint: 'デフォルト' },
    ],
  },
  {
    title: '14. 契約の解除',
    jsonPath: 'contract',
    fields: [
      { key: 'cancel_deposit', label: '手付解除', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
      { key: 'cancel_deposit_article', label: '条文番号', hint: 'デフォルト' },
      { key: 'cancel_loss', label: '滅失・毀損による解除', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
      { key: 'cancel_loss_article', label: '条文番号', hint: 'デフォルト' },
      { key: 'cancel_breach', label: '契約違反による解除', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
      { key: 'cancel_breach_article', label: '条文番号', hint: 'デフォルト' },
      { key: 'cancel_loan', label: '融資特約による解除', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
      { key: 'cancel_loan_article', label: '条文番号', hint: 'デフォルト' },
      { key: 'cancel_defect', label: '契約不適合責任', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
      { key: 'cancel_defect_article', label: '条文番号', hint: 'デフォルト' },
      { key: 'cancel_antisocial', label: '反社会的勢力排除', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
    ],
  },
  {
    title: '16. 金銭貸借',
    jsonPath: 'loan',
    fields: [
      { key: 'has_mediation', label: '斡旋の有無', type: 'select', options: YES_NO, hint: 'デフォルト' },
      { key: 'loan_deadline', label: '融資利用の特約の期限' },
      { key: 'bank_name', label: '金融機関名', hint: '契約書' },
      { key: 'loan_amount', label: '融資額', hint: '契約書' },
      { key: 'interest_rate', label: '金利', hint: '契約書' },
      { key: 'loan_period', label: '借入期間', hint: '契約書' },
      { key: 'repayment_method', label: '返済方法', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '元利均等', label: '元利均等' }, { value: '元金均等', label: '元金均等' },
      ]},
      { key: 'guarantee_fee', label: '保証料' },
      { key: 'loan_fee', label: 'ローン事務手数料' },
    ],
  },
  {
    title: '19. 契約不適合責任の措置',
    jsonPath: 'contract',
    fields: [
      { key: 'warranty_measure', label: '措置', type: 'select', options: MEASURE_OPTS, hint: 'デフォルト' },
      { key: 'warranty_content', label: '措置の内容', type: 'textarea', colSpan: 2 },
    ],
  },
  {
    title: '20. 手付金等保全措置',
    jsonPath: 'contract',
    fields: [
      { key: 'deposit_protection', label: '保全措置', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '講じません', label: '講じません' }, { value: '講じます', label: '講じます' },
      ], hint: 'デフォルト' },
      { key: 'deposit_protection_incomplete', label: '未完成物件の場合', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '有', label: '有' },
      ], hint: 'デフォルト' },
      { key: 'installment_sale', label: '割賦販売', type: 'select', options: YES_NO, hint: 'デフォルト' },
      { key: 'land_survey_settlement', label: '土地の測量清算', type: 'select', options: YES_NO, hint: 'デフォルト' },
      { key: 'payment_protection', label: '支払金保全措置', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '講じる', label: '講じる' }, { value: '講じない', label: '講じない' },
      ], hint: 'デフォルト' },
      { key: 'long_term_product', label: '長期使用製品', type: 'select', options: APPLICABLE, hint: 'デフォルト' },
    ],
  },
  {
    title: '21. 建物検査',
    jsonPath: 'building_inspection',
    fields: [
      { key: 'confirmation_status', label: '建築確認', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '受検済', label: '受検済' }, { value: '受検予定', label: '受検予定' },
      ], hint: '確認済証' },
      { key: 'confirmation_number', label: '建築確認番号', hint: '確認済証' },
      { key: 'confirmation_date', label: '建築確認日', hint: '確認済証' },
      { key: 'interim1_status', label: '中間検査(基礎)', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '受検済', label: '受検済' }, { value: '受検予定', label: '受検予定' },
      ], hint: '中間検査合格証' },
      { key: 'interim_inspection_number', label: '中間検査(基礎) 番号', hint: '中間検査合格証' },
      { key: 'interim2_status', label: '中間検査(建方)', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '受検済', label: '受検済' }, { value: '受検予定', label: '受検予定' },
      ], hint: '中間検査合格証' },
      { key: 'interim2_number', label: '中間検査(建方) 番号', hint: '中間検査合格証' },
      { key: 'completion_status', label: '完了検査', type: 'select', options: [
        { value: '', label: '（未設定）' }, { value: '受検済', label: '受検済' }, { value: '受検予定', label: '受検予定' },
      ], hint: 'デフォルト' },
    ],
  },
  {
    title: '24. 添付書類',
    jsonPath: 'attachments',
    fields: [
      { key: 'item1', label: '添付書類 1', hint: 'デフォルト' },
      { key: 'item2', label: '添付書類 2', hint: 'デフォルト' },
      { key: 'item3', label: '添付書類 3', hint: 'デフォルト' },
      { key: 'item4', label: '添付書類 4', hint: 'デフォルト' },
      { key: 'item5', label: '添付書類 5', hint: 'デフォルト' },
      { key: 'item6', label: '添付書類 6', hint: 'デフォルト' },
      { key: 'item7', label: '添付書類 7', hint: 'デフォルト' },
      { key: 'item8', label: '添付書類 8', hint: 'デフォルト' },
      { key: 'item9', label: '添付書類 9', hint: 'デフォルト' },
      { key: 'item10', label: '添付書類 10', hint: 'デフォルト' },
    ],
  },
];

// ============================================================
// Helpers
// ============================================================

/** Count filled fields for a section */
function getSectionCompletion(
  editJson: Record<string, Record<string, string>>,
  section: SectionDef
): { filled: number; total: number } {
  const total = section.fields.length;
  let filled = 0;
  for (const field of section.fields) {
    const val = editJson[section.jsonPath]?.[field.key];
    if (val && val.trim() !== '') filled++;
  }
  return { filled, total };
}

/** Completion percentage color */
function completionColor(pct: number): string {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-400';
}

// ============================================================
// Main component
// ============================================================
export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const [property, setProperty] = useState<Property | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [processingDoc, setProcessingDoc] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [ocrAll, setOcrAll] = useState(false);

  // Progress tracking
  const [progress, setProgress] = useState<{
    active: boolean;
    label: string;
    current: number;
    total: number;
    detail: string;
  } | null>(null);

  // Edit state (always active)
  const [editJson, setEditJson] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [propRes, docsRes] = await Promise.all([
        fetch(`/api/properties/${propertyId}`),
        fetch(`/api/documents?property_id=${propertyId}`),
      ]);
      const propData = await propRes.json();
      const docsData = await docsRes.json();
      setProperty(propData);
      setDocuments(Array.isArray(docsData) ? docsData : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize editJson from property_json whenever property loads/updates
  useEffect(() => {
    if (property?.property_json) {
      const flat: Record<string, Record<string, string>> = {};
      for (const [section, data] of Object.entries(property.property_json)) {
        if (section === 'ownership' && Array.isArray(data) && data.length > 0) {
          flat['ownership_0'] = {};
          for (const [k, v] of Object.entries(data[0] as Record<string, unknown>)) {
            flat['ownership_0'][k] = String(v ?? '');
          }
        } else if (section === 'mortgage' && Array.isArray(data)) {
          // skip array for now
        } else if (typeof data === 'object' && data && !Array.isArray(data)) {
          flat[section] = {};
          for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
            flat[section][k] = String(v ?? '');
          }
        }
      }
      setEditJson(flat);

      // Open sections with defaultOpen on first load
      setOpenSections(prev => {
        if (prev.size > 0) return prev; // preserve user's open/close state
        const initialOpen = new Set<string>();
        for (const section of SECTIONS) {
          if (section.defaultOpen) initialOpen.add(section.title);
        }
        return initialOpen;
      });
    }
  }, [property]);

  const getFieldValue = (sectionPath: string, fieldKey: string): string => {
    return editJson[sectionPath]?.[fieldKey] ?? '';
  };

  const setFieldValue = (sectionPath: string, fieldKey: string, value: string) => {
    setEditJson(prev => ({
      ...prev,
      [sectionPath]: {
        ...(prev[sectionPath] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const expandAllSections = () => {
    setOpenSections(new Set(SECTIONS.map(s => s.title)));
  };

  const collapseAllSections = () => {
    setOpenSections(new Set());
  };

  const handleSave = async () => {
    if (!property) return;
    setSaving(true);
    try {
      const pj: Record<string, unknown> = { ...property.property_json };

      // Track which sections map to the same jsonPath (e.g. multiple sections → "contract")
      // Merge all fields from all sections for each jsonPath
      const sectionsByPath: Record<string, Record<string, string>> = {};
      for (const [section, data] of Object.entries(editJson)) {
        if (section === 'ownership_0') continue; // handled separately
        if (!sectionsByPath[section]) sectionsByPath[section] = {};
        for (const [k, v] of Object.entries(data)) {
          if (v) sectionsByPath[section][k] = v;
        }
      }

      // Apply merged sections
      for (const [section, cleaned] of Object.entries(sectionsByPath)) {
        const existing = (pj[section] as Record<string, unknown>) || {};
        pj[section] = { ...existing, ...cleaned };
      }

      // Handle ownership_0
      if (editJson['ownership_0']) {
        const ownership = Array.isArray(pj.ownership) ? [...pj.ownership] : [];
        const cleaned: Record<string, string> = {};
        for (const [k, v] of Object.entries(editJson['ownership_0'])) {
          if (v) cleaned[k] = v;
        }
        if (ownership.length > 0) {
          ownership[0] = { ...(ownership[0] as Record<string, unknown>), ...cleaned };
        } else {
          ownership.push(cleaned);
        }
        pj.ownership = ownership;
      }

      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_json: pj }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || '保存に失敗しました');
      }
    } catch {
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('property_id', propertyId);
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
      }
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setSelectedFiles(null);
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        await fetchData();
      } else {
        alert(data.error || 'アップロードに失敗しました');
      }
    } catch {
      alert('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleDocTypeChange = async (documentId: string, newType: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_type: newType }),
      });
      if (res.ok) {
        setDocuments(prev =>
          prev.map(d => d.id === documentId ? { ...d, document_type: newType } : d)
        );
      } else {
        const data = await res.json();
        alert(data.error || '種別の変更に失敗しました');
      }
    } catch {
      alert('種別の変更に失敗しました');
    }
  };

  const handleOcr = async (documentId: string) => {
    setProcessingDoc(documentId);
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchData();
      } else {
        alert(data.error || 'OCR処理に失敗しました');
      }
    } catch {
      alert('OCR処理に失敗しました');
    } finally {
      setProcessingDoc(null);
    }
  };

  const handleParse = async (documentId: string) => {
    setProcessingDoc(documentId);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchData();
      } else {
        alert(data.error || '解析に失敗しました');
      }
    } catch {
      alert('解析に失敗しました');
    } finally {
      setProcessingDoc(null);
    }
  };

  const handleOcrAll = async () => {
    if (!confirm('全ドキュメントのOCRを一括実行します。よろしいですか？')) return;
    setOcrAll(true);
    const targets = documents.filter(d => d.document_type !== 'other');
    const total = targets.length;
    let processed = 0;
    let failed = 0;

    for (const doc of targets) {
      processed++;
      setProgress({
        active: true,
        label: 'OCR一括処理',
        current: processed,
        total,
        detail: `${doc.file_name} を処理中...`,
      });
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: doc.id }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    setProgress({
      active: false,
      label: 'OCR一括処理',
      current: total,
      total,
      detail: `完了: ${total - failed}件成功${failed > 0 ? `, ${failed}件失敗` : ''}`,
    });
    await fetchData();
    setTimeout(() => setProgress(null), 3000);
    setOcrAll(false);
  };

  const handleReparse = async () => {
    if (!confirm('改善されたパーサーで全ドキュメントを再解析します。よろしいですか？')) return;
    setReparsing(true);
    const targets = documents.filter(d => d.ocr_status === 'completed' && d.document_type !== 'other');

    // Process in priority order: registry → contract → permit → others
    // This ensures authoritative sources are merged first (first-value-wins)
    const DOC_TYPE_PRIORITY: Record<string, number> = {
      registry: 0, contract: 1, permit: 2, drawing: 3, hazard: 4,
    };
    targets.sort((a, b) =>
      (DOC_TYPE_PRIORITY[a.document_type] ?? 9) - (DOC_TYPE_PRIORITY[b.document_type] ?? 9)
    );

    const total = targets.length;
    let processed = 0;
    let failed = 0;

    // Clear property_json before re-merging to remove stale data
    try {
      await fetch(`/api/properties/${propertyId}/reset-json`, { method: 'POST' });
    } catch { /* ignore — will still work with merge */ }

    for (const doc of targets) {
      processed++;
      setProgress({
        active: true,
        label: '再解析',
        current: processed,
        total,
        detail: `${doc.file_name} を解析中...`,
      });
      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: doc.id }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    setProgress({
      active: false,
      label: '再解析',
      current: total,
      total,
      detail: `完了: ${total - failed}件成功${failed > 0 ? `, ${failed}件失敗` : ''}`,
    });
    await fetchData();
    setTimeout(() => setProgress(null), 3000);
    setReparsing(false);
  };

  const handleAiParse = async () => {
    if (!confirm('正規表現で取得できなかった項目をAI(Gemini)で補完します。よろしいですか？')) return;
    setAiParsing(true);
    setProgress({
      active: true,
      label: 'AI補完',
      current: 0,
      total: 1,
      detail: 'Geminiで不足項目を補完中...',
    });
    try {
      const res = await fetch('/api/ai-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const data = await res.json();
      if (res.ok) {
        setProgress({
          active: false,
          label: 'AI補完',
          current: 1,
          total: 1,
          detail: data.filled_count > 0
            ? `完了: ${data.gaps_found}件中${data.filled_count}件を補完`
            : '補完対象なし（全項目取得済み）',
        });
        await fetchData();
      } else {
        setProgress({
          active: false,
          label: 'AI補完',
          current: 1,
          total: 1,
          detail: `エラー: ${data.error || '失敗'}`,
        });
      }
    } catch {
      setProgress({
        active: false,
        label: 'AI補完',
        current: 1,
        total: 1,
        detail: 'エラー: 通信に失敗しました',
      });
    } finally {
      setTimeout(() => setProgress(null), 3000);
      setAiParsing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jyusetsu_${propertyId}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Excel生成に失敗しました');
      }
    } catch {
      alert('Excel生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  // ============================================================
  // Compute overall completion stats from editJson
  // ============================================================
  const getOverallStats = () => {
    let filled = 0;
    let total = 0;
    for (const section of SECTIONS) {
      const { filled: f, total: t } = getSectionCompletion(editJson, section);
      filled += f;
      total += t;
    }
    return { filled, total };
  };

  if (loading) {
    return <div className="text-center text-stone-500 py-12">読み込み中...</div>;
  }

  if (!property) {
    return <div className="text-center text-red-500 py-12">物件が見つかりません</div>;
  }

  const stats = getOverallStats();
  const overallPct = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            {property.address || '新規物件'}
          </h1>
          <p className="text-sm text-stone-500 mt-1">ID: {property.id}</p>
        </div>
        <div className="flex space-x-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            property.status === 'generated' || property.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : property.status === 'parsed'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-stone-100 text-stone-700'
          }`}>
            {STATUS_LABELS[property.status] || property.status}
          </span>
          <button
            onClick={handleOcrAll}
            disabled={!!progress?.active || ocrAll}
            className="bg-stone-600 text-white px-4 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50 text-sm"
          >
            {ocrAll ? 'OCR中...' : 'OCR一括'}
          </button>
          <button
            onClick={handleReparse}
            disabled={!!progress?.active || reparsing}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            {reparsing ? '再解析中...' : '再解析'}
          </button>
          <button
            onClick={handleAiParse}
            disabled={!!progress?.active || aiParsing}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm"
          >
            {aiParsing ? 'AI補完中...' : 'AI補完'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={!!progress?.active || generating}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {generating ? '生成中...' : 'Excel生成'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-stone-700">
                {progress.label}
                {progress.active && (
                  <span className="ml-2 inline-block w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                )}
              </span>
              <span className="text-sm text-stone-500">
                {progress.total > 1 ? `${progress.current} / ${progress.total}` : ''}
              </span>
            </div>
            <div className="w-full bg-stone-200 rounded-full h-2 mb-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  progress.active ? 'bg-brand-600' : 'bg-green-500'
                }`}
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-stone-500 truncate">{progress.detail}</p>
          </div>
        </div>
      )}

      {/* Property Data — always editable */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-stone-900">重説データ</h2>
            {/* Overall completion badge */}
            <div className="flex items-center space-x-2">
              <div className="w-24 bg-stone-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${completionColor(overallPct)}`}
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <span className="text-xs text-stone-500 font-medium">
                {stats.filled}/{stats.total} ({overallPct}%)
              </span>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={collapseAllSections}
              className="text-xs text-stone-500 hover:text-stone-700 px-2 py-1"
            >
              全て閉じる
            </button>
            <button
              onClick={expandAllSections}
              className="text-xs text-stone-500 hover:text-stone-700 px-2 py-1"
            >
              全て開く
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm text-white bg-brand-600 hover:bg-brand-700 px-4 py-1.5 rounded-lg disabled:opacity-50 font-medium"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* Collapsible sectioned form */}
        <div className="divide-y divide-stone-100">
            {SECTIONS.map((section) => {
              const isOpen = openSections.has(section.title);
              const { filled, total } = getSectionCompletion(editJson, section);
              const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

              return (
                <div key={section.title}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="w-full px-6 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <svg
                        className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm font-bold text-stone-700">{section.title}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-stone-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${completionColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-stone-500 w-12 text-right">{filled}/{total}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5 pt-1">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        {section.fields.map((field) => (
                          <div
                            key={`${section.jsonPath}.${field.key}`}
                            className={field.colSpan === 2 ? 'col-span-2' : ''}
                          >
                            <label className="flex items-center space-x-1 text-xs font-medium text-stone-500 mb-1">
                              <span>{field.label}</span>
                              {field.hint && (
                                <span className={`px-1 py-0 rounded text-[10px] ${
                                  field.hint === 'デフォルト'
                                    ? 'bg-green-50 text-green-600'
                                    : 'bg-blue-50 text-blue-600'
                                }`}>
                                  {field.hint}
                                </span>
                              )}
                            </label>
                            {field.type === 'select' ? (
                              <select
                                value={getFieldValue(section.jsonPath, field.key)}
                                onChange={(e) => setFieldValue(section.jsonPath, field.key, e.target.value)}
                                className={`block w-full text-sm rounded-md shadow-sm py-1.5 px-2 border focus:border-brand-500 focus:ring-brand-500 ${
                                  getFieldValue(section.jsonPath, field.key) ? 'border-stone-300' : 'border-amber-300 bg-amber-50'
                                }`}
                              >
                                {field.options?.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            ) : field.type === 'textarea' ? (
                              <textarea
                                value={getFieldValue(section.jsonPath, field.key)}
                                onChange={(e) => setFieldValue(section.jsonPath, field.key, e.target.value)}
                                rows={3}
                                className={`block w-full text-sm rounded-md shadow-sm py-1.5 px-2 border focus:border-brand-500 focus:ring-brand-500 ${
                                  getFieldValue(section.jsonPath, field.key) ? 'border-stone-300' : 'border-amber-300 bg-amber-50'
                                }`}
                                placeholder="（未設定）"
                              />
                            ) : (
                              <input
                                type="text"
                                value={getFieldValue(section.jsonPath, field.key)}
                                onChange={(e) => setFieldValue(section.jsonPath, field.key, e.target.value)}
                                className={`block w-full text-sm rounded-md shadow-sm py-1.5 px-2 border focus:border-brand-500 focus:ring-brand-500 ${
                                  getFieldValue(section.jsonPath, field.key) ? 'border-stone-300' : 'border-amber-300 bg-amber-50'
                                }`}
                                placeholder="（未設定）"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      </div>

      {/* Property JSON (collapsible) */}
      {property.property_json && Object.keys(property.property_json).length > 0 && (
        <details className="bg-white rounded-lg shadow">
          <summary className="px-6 py-4 border-b border-stone-200 cursor-pointer">
            <h2 className="text-lg font-semibold text-stone-900 inline">Property JSON</h2>
          </summary>
          <div className="p-6">
            <pre className="bg-stone-50 p-4 rounded text-sm overflow-x-auto text-stone-800">
              {JSON.stringify(property.property_json, null, 2)}
            </pre>
          </div>
        </details>
      )}

      {/* Document Upload */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">資料アップロード</h2>
        </div>
        <div className="p-6">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                ファイル選択（複数可）
              </label>
              <input
                id="file-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                onChange={(e) => setSelectedFiles(e.target.files)}
                className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFiles || selectedFiles.length === 0}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {uploading ? 'アップロード中...' : `アップロード${selectedFiles && selectedFiles.length > 0 ? `（${selectedFiles.length}件）` : ''}`}
            </button>
          </div>
          {selectedFiles && selectedFiles.length > 0 && (
            <div className="mt-3 text-sm text-stone-600">
              {Array.from(selectedFiles).map((f, i) => (
                <div key={i} className="truncate">{f.name}</div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-stone-400">
            アップロード後、下の一覧から資料種別を設定してください
          </p>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">アップロード済み資料</h2>
        </div>
        {documents.length === 0 ? (
          <div className="p-6 text-center text-stone-500">資料がありません</div>
        ) : (
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">ファイル名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">種別</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">OCRステータス</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">解析</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {documents.map(doc => (
                <tr key={doc.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 text-sm text-stone-900">{doc.file_name}</td>
                  <td className="px-6 py-4">
                    <select
                      value={doc.document_type}
                      onChange={(e) => handleDocTypeChange(doc.id, e.target.value)}
                      className={`text-sm rounded-md border py-1 px-2 ${
                        doc.document_type === 'other'
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-stone-300 bg-white text-stone-700'
                      }`}
                    >
                      {DOC_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      doc.ocr_status === 'completed' ? 'bg-green-100 text-green-700' :
                      doc.ocr_status === 'failed' ? 'bg-red-100 text-red-700' :
                      doc.ocr_status === 'processing' ? 'bg-brand-100 text-brand-700' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {OCR_STATUS_LABELS[doc.ocr_status] || doc.ocr_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">
                    {doc.parsed_data ? `${Object.keys(doc.parsed_data).length}項目` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center space-x-2 whitespace-nowrap">
                      {doc.ocr_status === 'pending' && (
                        <button
                          onClick={() => handleOcr(doc.id)}
                          disabled={processingDoc === doc.id}
                          className="shrink-0 px-3 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50 text-xs font-medium"
                        >
                          {processingDoc === doc.id ? '処理中...' : 'OCR実行'}
                        </button>
                      )}
                      {doc.ocr_status === 'completed' && doc.document_type !== 'other' && (
                        <button
                          onClick={() => handleParse(doc.id)}
                          disabled={processingDoc === doc.id}
                          className="shrink-0 px-3 py-1 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50 text-xs font-medium"
                        >
                          {processingDoc === doc.id ? '解析中...' : doc.parsed_data ? '再解析' : '解析実行'}
                        </button>
                      )}
                      {doc.parsed_data && (
                        <button
                          onClick={() => window.location.href = `/documents/${doc.id}`}
                          className="shrink-0 px-3 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium"
                        >
                          結果確認
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
