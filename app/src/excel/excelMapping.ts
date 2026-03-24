import type { ExcelMapping } from '../models/types';

/**
 * Excel cell mapping for 重要事項説明書 template.
 * Maps cell references to PropertyJson field paths.
 *
 * Template: templates/jyusetsu_template.xlsx (sheet: 重説)
 * Cells are merged — write to top-left cell of each merged range.
 *
 * Sections follow the completed 重説 format (TioRuhe):
 *   1. 不動産の表示 (rows 63-110)
 *   2. 売主の表示と占有 (rows 111-124)
 *   3. 登記記録 (rows 125-148)
 *   4. 法令に基づく制限 (rows 150-310)
 *   5. 敷地と道路 (rows 311-352)
 *   6. 私道負担 (rows 353-372)
 *   7. インフラ (rows 373-398)
 *   8-9. 災害区域 (rows 399-412)
 *   13. 売買代金 (rows 441-454)
 *   15. 違約金 (rows 484-493)
 *   16. 金銭貸借 (rows 497-523)
 *   19. 契約不適合責任 (rows 546-556)
 */
export const excelMapping: ExcelMapping = {
  // ====================================================
  // 1. 不動産の表示 — 土地① (rows 68-69)
  // ====================================================
  // 所在 (merged B68:J69)
  'B68': 'property.address',
  // 地番 (merged K68:N69)
  'K68': 'property.land_number',
  // 地目・現況 (merged O68:R69)
  'O68': 'property.land_type',
  // 地積 (merged S68:V69)
  'S68': 'property.land_area',
  // 持分 (merged W68:X69)
  'W68': 'ownership[0].share',
  // 権利の種類 (merged Y68:Z69)
  'Y68': 'ownership[0].right_type',

  // 取引対象面積合計 (merged T78:Z79)
  'T78': 'property.total_trading_area',

  // ====================================================
  // 1. 不動産の表示 — 建物 (rows 96-110)
  // ====================================================
  // 所在 (merged E97:R98)
  'E97': 'building.address',
  // 家屋番号 (merged V97:Z98)
  'V97': 'building.building_number',
  // 住居表示 (merged E99:R100)
  'E99': 'building.residential_address',
  // 種類 (merged E101:K102)
  'E101': 'building.usage',
  // 構造 (merged P101:Z102)
  'P101': 'building.structure',
  // 床面積 1階 (merged F103:H104)
  'F103': 'building.floor_area_1f',
  // 床面積 2階 (merged K103:M104)
  'K103': 'building.floor_area_2f',
  // 床面積 3階 (merged P103:R104)
  'P103': 'building.floor_area_3f',
  // 床面積 合計 (merged V103:Y104)
  'V103': 'building.area',
  // 特記事項 (merged D105:Z110)
  'D105': 'building.note',

  // ====================================================
  // 2. 売主の表示と占有に関する事項 (rows 111-124)
  // ====================================================
  // 売主 住所氏名 (merged E115:Z116)
  'E115': 'contract.seller_name',
  'E116': 'contract.seller_address',
  // 備考 (merged E117:Z118)
  'E117': 'contract.seller_note',
  // 第三者による占有 — 備考 (merged E122:Z123)
  'E122': 'contract.third_party_occupation_note',

  // ====================================================
  // 3. 登記記録 (rows 125-148)
  // ====================================================
  // 土地 甲区 名義人 住所 (merged K128:Z129)
  'K128': 'ownership[0].address',
  // 土地 甲区 名義人 氏名 (merged K130:Z131)
  'K130': 'ownership[0].name',
  // 建物 甲区 名義人 住所 (merged K138:Z139)
  'K138': 'building.registry_owner_address',
  // 建物 甲区 名義人 氏名 (merged K140:Z141)
  'K140': 'building.registry_owner_name',

  // ====================================================
  // 4-1. 都市計画法 (rows 150-186)
  // ====================================================
  // 区域区分 (merged G153:K157) — pre-filled as 市街化区域
  'G153': 'zoning.area_classification',
  // 都市計画道路等 名称 (merged L167:Z173)
  'L167': 'zoning.city_plan_road_name',

  // ====================================================
  // 4-2. 建築基準法 (rows 187-248)
  // ====================================================
  // 指定建ぺい率 (merged M223:O224) — value like "80"
  'M223': 'zoning.building_coverage_ratio',
  // 指定容積率 (merged M229:O230) — value like "200"
  'M229': 'zoning.floor_area_ratio',
  // 道路幅員制限 — 幅員 (merged M231:N232)
  'M232': 'road.width',
  // 建ぺい率の緩和 — 制限の概要
  'B215': 'zoning.fire_zone_note',

  // ====================================================
  // 5. 敷地と道路との関係 (rows 311-352)
  // ====================================================
  // 接道 1行目: 方向 (C314)
  'C314': 'road.direction',
  // 道路の種類 (merged M314:R314) — value like "道路の種類 42 条 2項"
  'M314': 'road.road_category_display',
  // 幅員 (merged S314:U314)
  'S314': 'road.width',
  // 接道長さ (merged W314:Y314)
  'W314': 'road.frontage_length',
  // 備考 (merged C327:Z330)

  // ====================================================
  // 6. 私道負担等に関する事項 (rows 353-372)
  // ====================================================
  // 負担面積 (merged E359:I360)
  'E359': 'private_road.burden_area',
  // 持分 (merged L359:T360)
  'L359': 'private_road.burden_share',
  // 負担金 (merged E361:Z362)
  'E361': 'private_road.burden_cost',
  // セットバック面積 (merged T363:V364)
  'T363': 'private_road.setback_area',
  // 備考 (merged E365:Z366)
  'E365': 'private_road.note',

  // ====================================================
  // 7. インフラ (rows 373-398)
  // ====================================================
  // 飲用水 — 種別は checkbox だがテキストでも対応
  // ガス — 種別
  // 電気 — 供給者
  'C382': 'infrastructure.electricity',
  // (checkboxes for water/gas/sewage types are pre-filled in template)

  // ====================================================
  // 9. 災害区域 (rows 404-412)
  // ====================================================
  // (checkboxes — 造成宅地防災, 土砂災害, 津波 are handled via checkbox fields)

  // ====================================================
  // 13. 売買代金及び代金以外に授受される金額 (rows 441-454)
  // ====================================================
  // 売買代金 (merged R443:Y443)
  'R443': 'contract.price',
  // 手付金 (merged R444:Y444)
  'R444': 'contract.deposit_amount',

  // ====================================================
  // 15. 違約金 (rows 484-493)
  // ====================================================
  // 売買代金の _% (L486 — value as decimal: 10% → 0.1, 20% → 0.2)
  'L486': 'contract.penalty_rate_decimal',

  // ====================================================
  // 16. 金銭貸借の斡旋 (rows 497-523)
  // ====================================================
  // 融資利用の特約の期限 (merged T499:Z500)
  'T499': 'loan.loan_deadline',
  // 金融機関名 (merged A503:E504)
  'A503': 'loan.bank_name',
  // 融資額 (merged F503:I504)
  'F503': 'loan.loan_amount',
  // 金利 (merged J503:L504)
  'J503': 'loan.interest_rate',
  // 借入期間 (merged M503:O504)
  'M503': 'loan.loan_period',
  // 返済方法 (merged P503:R504)
  'P503': 'loan.repayment_method',
  // 保証料 (merged S503:V504)
  'S503': 'loan.guarantee_fee',
  // ローン事務手数料 (merged W503:Z504)
  'W503': 'loan.loan_fee',

  // ====================================================
  // 19. 契約不適合責任 (rows 546-556)
  // ====================================================
  // 措置の内容 (merged L550:Z555)
  'L550': 'contract.warranty_content',

  // ====================================================
  // 14. 契約の解除 — 条文番号 (rows 457-474)
  // ====================================================
  'T457': 'contract.cancel_deposit_article',
  'T459': 'contract.cancel_loss_article',
  'T461': 'contract.cancel_breach_article',
  'T463': 'contract.cancel_loan_article',
  'T467': 'contract.cancel_defect_article',

  // ====================================================
  // 21. 建物検査 (rows 577-584)
  // ====================================================
  // 建築確認申請
  'A577': 'building_inspection.confirmation_label',
  'H577': 'building_inspection.confirmation_status',
  'L577': 'building_inspection.confirmation_detail',
  'S577': 'building_inspection.confirmation_number',
  // 中間検査(基礎)
  'A579': 'building_inspection.interim1_label',
  'H579': 'building_inspection.interim1_status',
  'L579': 'building_inspection.interim1_detail',
  'S579': 'building_inspection.interim_inspection_number',
  // 中間検査(建方)
  'A581': 'building_inspection.interim2_label',
  'H581': 'building_inspection.interim2_status',
  'L581': 'building_inspection.interim2_detail',
  'S581': 'building_inspection.interim2_number',
  // 完了検査
  'A583': 'building_inspection.completion_label',
  'H583': 'building_inspection.completion_status',

  // ====================================================
  // 24. 添付書類 (rows 623-629)
  // ====================================================
  'B623': 'attachments.item1',
  'O623': 'attachments.item8',
  'B624': 'attachments.item2',
  'O624': 'attachments.item9',
  'B625': 'attachments.item3',
  'O625': 'attachments.item10',
  'B626': 'attachments.item4',
  'B627': 'attachments.item5',
  'B628': 'attachments.item6',
  'B629': 'attachments.item7',

  // ====================================================
  // 接道方向 側 (row 317)
  // ====================================================
  'K317': 'road.direction',

};
