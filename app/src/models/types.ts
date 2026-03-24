// ============================================================
// BoundingBox from Document AI
// ============================================================
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrToken {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
}

export interface OcrBlock {
  text: string;
  boundingBox: BoundingBox;
  paragraphs: OcrParagraph[];
}

export interface OcrParagraph {
  text: string;
  boundingBox: BoundingBox;
  tokens: OcrToken[];
}

export interface OcrPage {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
  blocks: OcrBlock[];
  paragraphs: OcrParagraph[];
  tokens: OcrToken[];
}

// ============================================================
// Form Parser: Key-Value pairs and Tables
// ============================================================
export interface FormField {
  fieldName: string;
  fieldValue: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface TableCell {
  text: string;
  rowIndex: number;
  colIndex: number;
  rowSpan: number;
  colSpan: number;
}

export interface FormTable {
  headerRows: TableCell[][];
  bodyRows: TableCell[][];
  pageNumber: number;
}

export interface FormParserMeta {
  status: 'success' | 'error' | 'empty';
  errorMessage?: string;
  formFieldCount: number;
  tableCount: number;
}

export interface OcrResult {
  pages: OcrPage[];
  fullText: string;
  formFields?: FormField[];  // Form Parser key-value pairs
  tables?: FormTable[];       // Form Parser table data
  formParserMeta?: FormParserMeta;
  source?: 'document_ai' | 'text_pdf';
}

// ============================================================
// Layout Template
// ============================================================
export type Direction = 'right' | 'below' | 'left' | 'above';

export interface LayoutFieldDef {
  keyword: string;
  direction: Direction;
  maxDistance?: number;
  pattern?: string; // regex pattern to validate extracted value
  multiline?: boolean;
  alternateKeywords?: string[]; // fallback keywords if primary not found
}

export interface LayoutTemplate {
  [fieldPath: string]: LayoutFieldDef;
}

// ============================================================
// Document types
// ============================================================
export type DocumentType = 'registry' | 'contract' | 'drawing' | 'hazard' | 'permit' | 'other';

export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PropertyStatus = 'draft' | 'ocr_processing' | 'parsed' | 'generated' | 'completed';

export interface DocumentRecord {
  id: string;
  property_id: string;
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  ocr_status: OcrStatus;
  ocr_result: OcrResult | null;
  parsed_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Property JSON (single source of truth)
// ============================================================
export interface PropertyData {
  address?: string;
  land_number?: string;
  land_type?: string;
  land_area?: string;
  total_trading_area?: string; // 取引対象面積合計
  land_area_basis?: string; // 公簿/実測
  survey_status?: string; // 済/未済
  survey_settlement?: string; // 実測清算 有/無
  survey_type?: string; // 現況平面図/確定測量図/地積測量図
  incomplete_property?: string; // 未完成物件 該当/非該当
  building_name?: string;
  building_structure?: string;
  building_area?: string;
  building_date?: string;
  floors?: string;
  usage_type?: string;
}

export interface BuildingData {
  building_number?: string;
  address?: string; // 建物の所在
  residential_address?: string; // 住居表示
  structure?: string;
  floors?: string;
  area?: string; // 合計床面積
  floor_area_1f?: string;
  floor_area_2f?: string;
  floor_area_3f?: string;
  built_date?: string;
  usage?: string;
  note?: string; // 特記事項
  registry_owner_address?: string; // 建物登記 名義人住所
  registry_owner_name?: string; // 建物登記 名義人氏名
  performance_evaluation?: string; // 住宅性能評価 該当/非該当
  performance_cert?: string; // 評価書交付 有/無
  design_performance?: string; // 設計住宅性能評価書 有
  construction_performance?: string; // 建設住宅性能評価書 有
}

export interface OwnerData {
  name?: string;
  address?: string;
  share?: string;
  right_type?: string; // 権利の種類 (所有権 etc.)
  registration_date?: string;
  cause?: string;
}

export interface MortgageData {
  mortgage_type?: string;
  amount?: string;
  interest_rate?: string;
  debtor?: string;
  creditor?: string;
  registration_date?: string;
  cause?: string;
}

export interface ContractData {
  seller_name?: string;
  seller_address?: string;
  seller_same_as_registry?: string; // 登記名義人と同じ / 異なる
  buyer_name?: string;
  buyer_address?: string;
  price?: string;
  contract_date?: string;
  delivery_date?: string;
  deposit_amount?: string; // 手付金
  fixed_asset_tax?: string; // 固定資産税精算金
  tax_base_date?: string; // 公租公課の起算日
  registration_cost?: string; // 登記費用
  penalty_type?: string; // 違約金の種類
  penalty_rate?: string; // 売買代金の _%
  penalty_rate_decimal?: string; // 小数形式 (10% → 0.1)
  payment_terms?: PaymentTerm[];
  special_conditions?: string;
  third_party_occupation?: string; // 第三者による占有 有/無
  third_party_occupation_note?: string;
  // 契約解除
  cancel_deposit?: string;
  cancel_deposit_article?: string;
  cancel_loss?: string;
  cancel_loss_article?: string;
  cancel_breach?: string;
  cancel_breach_article?: string;
  cancel_loan?: string;
  cancel_loan_article?: string;
  cancel_building_condition?: string;
  cancel_defect?: string;
  cancel_defect_article?: string;
  cancel_replacement?: string;
  cancel_antisocial?: string;
  // 保全措置
  deposit_protection?: string; // 講じません/講じます
  deposit_protection_incomplete?: string; // 未完成物件 有
  warranty_measure?: string; // 講ずる/講じない
  warranty_content?: string;
  installment_sale?: string; // 割賦販売 有/無
  land_survey_settlement?: string; // 土地測量清算 有/無
  payment_protection?: string; // 支払金保全 講じる/講じない
  deposit_guarantee_type?: string; // 保証協会
  long_term_product?: string; // 該当/非該当
  seller_note?: string;
}

export interface PaymentTerm {
  type: string;
  amount: string;
  due_date: string;
}

export interface HazardData {
  hazard_type?: string;
  risk_level?: string;
  zone_name?: string;
  flood_depth?: string;
  details?: Record<string, unknown>;
}

// ============================================================
// 都市計画法・建築基準法
// ============================================================
export interface ZoningData {
  area_classification?: string; // 区域区分: 市街化区域 etc.
  use_district?: string; // 用途地域: 第一種住居地域 etc.
  fire_zone?: string; // 防火地域/準防火地域
  building_coverage_ratio?: string; // 指定建ぺい率 %
  building_coverage_relaxation?: string; // 建ぺい率の緩和 有/無
  floor_area_ratio?: string; // 指定容積率 %
  road_setline?: string; // 道路斜線制限 有/無
  adjacent_setline?: string; // 隣地斜線制限 有/無
  north_setline?: string; // 北側斜線制限 有/無
  shadow_regulation?: string; // 日影規制 有/無
  absolute_height?: string; // 絶対高さ制限 有/無
  building_agreement?: string; // 建築協定 有/無
  development_permit?: string; // 開発行為の許可
  city_plan_road?: string; // 都市計画道路等 有/無
  land_readjustment?: string; // 土地区画整理法に基づく制限 有/無
  other_restrictions?: string; // その他の建築制限
  ordinance_restrictions?: string; // 条例等による制限 有/無
  floor_area_ratio_type?: string; // 12m未満/12m以上
  land_readjustment_project?: string; // 土地区画整理事業 有/無
  aviation_law?: string; // 航空法 有
  land_development_law?: string; // 宅地造成及び特定盛土等規制法 有
  landscape_law?: string; // 景観法 有
  dense_area_law?: string; // 密集市街地整備法 有
}

// ============================================================
// 敷地と道路との関係
// ============================================================
export interface RoadData {
  direction?: string; // 接道方向: 北/南/東/西
  road_type?: string; // 公道/私道
  road_category?: string; // 道路の種類: 42条2項 etc.
  road_category_display?: string; // 表示用: "道路の種類 42 条 2項"
  width?: string; // 幅員 m
  frontage_length?: string; // 接道長さ m
  setback?: string; // セットバック 有/無
  setback_area?: string; // セットバック面積
  private_road_change?: string; // 私道変更制限 有/無
  article43?: string; // 法43条2項2号 有/無
  flag_lot_restriction?: string; // 路地状敷地の制限 有/無
  diagram_type?: string; // 概略図: 別紙
}

// ============================================================
// 私道負担
// ============================================================
export interface PrivateRoadData {
  has_burden?: string; // 有/無
  burden_area?: string; // 負担面積
  burden_share?: string; // 持分
  burden_cost?: string; // 負担金
  setback_area?: string; // セットバック部分の面積
  note?: string;
}

// ============================================================
// インフラ
// ============================================================
export interface InfrastructureData {
  water_type?: string; // 公営水道/私営水道/井戸
  water_road_pipe?: string; // 前面道路配管 有/無
  water_site_pipe?: string; // 敷地内配管 有/無
  water_private_pipe?: string; // 私設管 有/無
  water_整備予定?: string; // 整備予定 有
  gas_type?: string; // 都市ガス/プロパン
  gas_road_pipe?: string; // 前面道路配管 有/無
  gas_site_pipe?: string; // 敷地内配管 有/無
  gas_整備予定?: string; // 整備予定 有
  electricity?: string; // 電気供給者
  electricity_整備予定?: string; // 整備予定 有
  sewage_type?: string; // 公共下水/個別浄化槽
  sewage_road_pipe?: string; // 前面道路配管 有/無
  sewage_site_pipe?: string; // 敷地内配管 有/無
  sewage_整備予定?: string; // 整備予定 有
  drainage_type?: string; // 雑排水
  drainage_road_pipe?: string;
  drainage_site_pipe?: string;
  drainage_private_pipe?: string; // 私設管 有/無
  drainage_整備予定?: string; // 整備予定 有
  rainwater_type?: string; // 雨水
  rainwater_整備予定?: string; // 整備予定 有
}

// ============================================================
// 災害区域
// ============================================================
export interface DisasterZoneData {
  development_disaster_zone?: string; // 造成宅地防災区域 内/外
  landslide_zone?: string; // 土砂災害警戒区域 内/外
  tsunami_zone?: string; // 津波災害警戒区域 内/外/未指定
  tsunami_alert_zone?: string; // 津波災害警戒区域指定 有/無
  tsunami_special_zone?: string; // 津波災害特別警戒区域指定 有/無
  flood_hazard_map?: string; // 洪水ハザードマップ 内/外
  rainwater_hazard_map?: string; // 内水ハザードマップ 内/外
  storm_surge_hazard_map?: string; // 高潮ハザードマップ 内/外
}

// ============================================================
// 金銭貸借
// ============================================================
export interface LoanData {
  has_mediation?: string; // 斡旋の有無
  loan_deadline?: string; // 融資利用の特約の期限
  bank_name?: string; // 金融機関名
  loan_amount?: string; // 融資額
  interest_rate?: string; // 金利
  loan_period?: string; // 借入期間
  repayment_method?: string; // 返済方法
  guarantee_fee?: string; // 保証料
  loan_fee?: string; // ローン事務手数料
}

// ============================================================
// 建物検査
// ============================================================
export interface BuildingInspectionData {
  confirmation_number?: string;
  confirmation_date?: string;
  confirmation_label?: string; // "建築確認申請"
  confirmation_status?: string; // "受検済"
  confirmation_detail?: string; // "受検（■有・□無）\n令和7年8月18日"
  interim_inspection_date?: string;
  interim_inspection_number?: string;
  interim1_label?: string; // "中 間 検 査　(基礎)"
  interim1_status?: string;
  interim1_detail?: string;
  interim2_label?: string; // "中 間 検 査　(建方)"
  interim2_status?: string;
  interim2_detail?: string;
  interim2_number?: string;
  completion_inspection_date?: string;
  completion_inspection_number?: string;
  completion_label?: string; // "完 了 検 査"
  completion_status?: string; // "受検予定"
  inspection_sticker?: string; // 有 (row 585)
}

export interface AttachmentsData {
  item1?: string;
  item2?: string;
  item3?: string;
  item4?: string;
  item5?: string;
  item6?: string;
  item7?: string;
  item8?: string;
  item9?: string;
  item10?: string;
}

export interface PropertyJson {
  property: PropertyData;
  building: BuildingData;
  ownership: OwnerData[];
  mortgage: MortgageData[];
  contract: ContractData;
  hazard: HazardData;
  zoning: ZoningData;
  road: RoadData;
  private_road: PrivateRoadData;
  infrastructure: InfrastructureData;
  disaster_zone: DisasterZoneData;
  loan: LoanData;
  building_inspection: BuildingInspectionData;
  attachments: AttachmentsData;
}

// ============================================================
// Property DB record
// ============================================================
export interface PropertyRecord {
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
  property_json: PropertyJson;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Excel Mapping
// ============================================================
export interface ExcelMapping {
  [cellRef: string]: string; // e.g. "B2": "property.address"
}

/**
 * Checkbox mapping: maps a PropertyJson field path to checkbox cell positions.
 * The field value determines which cell gets "■".
 * All other options remain "□" (already pre-filled in template).
 */
export interface CheckboxOption {
  value: string;   // matched value (e.g. "有", "無", "第一種住居地域")
  cell: string;    // cell ref to write "■" when matched
}

export interface CheckboxMapping {
  fieldPath: string;        // PropertyJson field path
  options: CheckboxOption[];
}

// ============================================================
// Parser interface
// ============================================================
export interface DocumentParser {
  parse(ocrResult: OcrResult): Record<string, string>;
}
