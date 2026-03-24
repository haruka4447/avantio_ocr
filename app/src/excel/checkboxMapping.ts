import type { CheckboxMapping } from '../models/types';

/**
 * Checkbox mappings for 重要事項説明書 template.
 *
 * Each entry maps a PropertyJson field path to cell positions.
 * When the field value matches an option's value, that cell is set to "■".
 * Non-matching option cells remain "□" (pre-filled in template).
 */
export const checkboxMappings: CheckboxMapping[] = [
  // ====================================================
  // 1. 不動産の表示 — 土地売買の対象面積 (row 87)
  // ====================================================
  {
    fieldPath: 'property.land_area_basis',
    options: [
      { value: '公簿', cell: 'F87' },    // 登記簿（公簿）面積による
      { value: '実測', cell: 'N87' },     // 実測面積による
    ],
  },
  // 実測 済/未済 (row 89)
  {
    fieldPath: 'property.survey_status',
    options: [
      { value: '済', cell: 'F89' },
      { value: '未済', cell: 'I89' },
    ],
  },
  // 実測清算 有/無 (row 89)
  {
    fieldPath: 'property.survey_settlement',
    options: [
      { value: '有', cell: 'P89' },
      { value: '無', cell: 'S89' },
    ],
  },
  // 測量面積 (row 93)
  {
    fieldPath: 'property.survey_type',
    options: [
      { value: '現況平面図', cell: 'A93' },
      { value: '確定測量図', cell: 'I93' },
      { value: '地積測量図', cell: 'R93' },
    ],
  },

  // ====================================================
  // 2. 売主の表示 (row 114)
  // ====================================================
  {
    fieldPath: 'contract.seller_same_as_registry',
    options: [
      { value: '同じ', cell: 'E114' },    // 登記名義人と同じ
      { value: '異なる', cell: 'L114' },   // 登記名義人と異なる
    ],
  },
  // 第三者による占有 (row 120)
  {
    fieldPath: 'contract.third_party_occupation',
    options: [
      { value: '有', cell: 'E120' },
      { value: '無', cell: 'H120' },
    ],
  },

  // ====================================================
  // 3. 登記記録 (rows 134-147)
  // ====================================================
  // 土地 甲区 所有権にかかる権利（所有権以外）
  {
    fieldPath: 'ownership[0].right_type',
    options: [
      { value: '所有権', cell: 'G134' },   // 所有権のみ → 他の権利は「無」
    ],
  },
  // 土地 乙区 担保権等
  {
    fieldPath: 'mortgage[0].mortgage_type',
    options: [
      { value: '抵当権', cell: 'E137' },
      { value: '根抵当権', cell: 'E137' },
    ],
  },

  // ====================================================
  // 4-1. 都市計画法 (rows 167-185)
  // ====================================================
  // 都市計画道路等
  {
    fieldPath: 'zoning.city_plan_road',
    options: [
      { value: '無', cell: 'G167' },
      { value: '有', cell: 'I167' },
    ],
  },
  // 土地区画整理法に基づく制限
  {
    fieldPath: 'zoning.land_readjustment',
    options: [
      { value: '有', cell: 'K174' },
      { value: '無', cell: 'N174' },
    ],
  },

  // ====================================================
  // 4-2. 建築基準法 — 用途地域 (rows 190-202)
  // ====================================================
  {
    fieldPath: 'zoning.use_district',
    options: [
      { value: '第一種低層住居専用地域', cell: 'B190' },
      { value: '第二種低層住居専用地域', cell: 'B191' },
      { value: '第一種中高層住居専用地域', cell: 'B192' },
      { value: '第二種中高層住居専用地域', cell: 'B193' },
      { value: '第一種住居地域', cell: 'B194' },
      { value: '第二種住居地域', cell: 'B195' },
      { value: '準住居地域', cell: 'B196' },
      { value: '準工業地域', cell: 'B197' },
      { value: '近隣商業地域', cell: 'B198' },
      { value: '商業地域', cell: 'B199' },
      { value: '工業地域', cell: 'B200' },
      { value: '工業専用地域', cell: 'B201' },
      { value: '用途地域の指定無し', cell: 'B202' },
    ],
  },

  // ====================================================
  // 4-2. 建築基準法 — 地域地区 (rows 208-213)
  // ====================================================
  {
    fieldPath: 'zoning.fire_zone',
    options: [
      { value: '防火地域', cell: 'L208' },
      { value: '準防火地域', cell: 'L209' },
    ],
  },
  // 建築協定
  {
    fieldPath: 'zoning.building_agreement',
    options: [
      { value: '無', cell: 'G221' },
      { value: '有', cell: 'I221' },
    ],
  },
  // 建ぺい率の緩和
  {
    fieldPath: 'zoning.building_coverage_relaxation',
    options: [
      { value: '無', cell: 'E227' },
      { value: '有', cell: 'G227' },
    ],
  },

  // ====================================================
  // 建物の高さの制限 (rows 235-237)
  // ====================================================
  {
    fieldPath: 'zoning.road_setline',
    options: [
      { value: '有', cell: 'L235' },
      { value: '無', cell: 'N235' },
    ],
  },
  {
    fieldPath: 'zoning.adjacent_setline',
    options: [
      { value: '有', cell: 'V235' },
      { value: '無', cell: 'X235' },
    ],
  },
  {
    fieldPath: 'zoning.north_setline',
    options: [
      { value: '有', cell: 'L236' },
      { value: '無', cell: 'N236' },
    ],
  },
  {
    fieldPath: 'zoning.shadow_regulation',
    options: [
      { value: '有', cell: 'V236' },
      { value: '無', cell: 'X236' },
    ],
  },
  {
    fieldPath: 'zoning.absolute_height',
    options: [
      { value: '有', cell: 'L237' },
      { value: '無', cell: 'N237' },
    ],
  },
  // 条例等による制限
  {
    fieldPath: 'zoning.ordinance_restrictions',
    options: [
      { value: '有', cell: 'H245' },
      { value: '無', cell: 'J245' },
    ],
  },

  // ====================================================
  // 5. 敷地と道路 (rows 314-332)
  // ====================================================
  {
    fieldPath: 'road.road_type',
    options: [
      { value: '公道', cell: 'G314' },
      { value: '私道', cell: 'J314' },
    ],
  },
  // セットバック
  {
    fieldPath: 'road.setback',
    options: [
      { value: '無', cell: 'L322' },
      { value: '有', cell: 'N322' },
    ],
  },
  // 路地状敷地の制限
  {
    fieldPath: 'road.flag_lot_restriction',
    options: [
      { value: '有', cell: 'I331' },
      { value: '無', cell: 'K331' },
    ],
  },

  // ====================================================
  // 6. 私道負担 (row 355)
  // ====================================================
  {
    fieldPath: 'private_road.has_burden',
    options: [
      { value: '有', cell: 'H355' },
      { value: '無', cell: 'L355' },
    ],
  },

  // ====================================================
  // 7. インフラ (rows 376-393)
  // ====================================================
  // 飲用水
  {
    fieldPath: 'infrastructure.water_type',
    options: [
      { value: '公営水道', cell: 'C376' },
      { value: '私営水道', cell: 'C377' },
      { value: '井戸', cell: 'C378' },
    ],
  },
  {
    fieldPath: 'infrastructure.water_road_pipe',
    options: [
      { value: '有', cell: 'L376' },
      { value: '無', cell: 'N376' },
    ],
  },
  {
    fieldPath: 'infrastructure.water_site_pipe',
    options: [
      { value: '有', cell: 'L377' },
      { value: '無', cell: 'N377' },
    ],
  },
  // ガス
  {
    fieldPath: 'infrastructure.gas_type',
    options: [
      { value: '都市ガス', cell: 'C379' },
      { value: 'プロパン', cell: 'C380' },
    ],
  },
  {
    fieldPath: 'infrastructure.gas_road_pipe',
    options: [
      { value: '有', cell: 'L379' },
      { value: '無', cell: 'N379' },
    ],
  },
  {
    fieldPath: 'infrastructure.gas_site_pipe',
    options: [
      { value: '有', cell: 'L380' },
      { value: '無', cell: 'N380' },
    ],
  },
  // 汚水
  {
    fieldPath: 'infrastructure.sewage_type',
    options: [
      { value: '公共下水', cell: 'C385' },
      { value: '個別浄化槽', cell: 'C386' },
      { value: '集中浄化槽', cell: 'C387' },
    ],
  },
  {
    fieldPath: 'infrastructure.sewage_road_pipe',
    options: [
      { value: '有', cell: 'L385' },
      { value: '無', cell: 'N385' },
    ],
  },
  // 雑排水
  {
    fieldPath: 'infrastructure.drainage_type',
    options: [
      { value: '公共下水', cell: 'C388' },
      { value: '集中浄化槽', cell: 'C389' },
      { value: '個別浄化槽', cell: 'C390' },
    ],
  },
  // 雨水
  {
    fieldPath: 'infrastructure.rainwater_type',
    options: [
      { value: '公共下水', cell: 'C391' },
      { value: '側溝等', cell: 'C392' },
      { value: '浸透式', cell: 'C393' },
    ],
  },

  // ====================================================
  // 9. 災害区域 (rows 406-409)
  // ====================================================
  {
    fieldPath: 'disaster_zone.development_disaster_zone',
    options: [
      { value: '内', cell: 'H406' },
      { value: '外', cell: 'K406' },
    ],
  },
  {
    fieldPath: 'disaster_zone.landslide_zone',
    options: [
      { value: '内', cell: 'R406' },
      { value: '外', cell: 'U406' },
    ],
  },
  {
    fieldPath: 'disaster_zone.tsunami_zone',
    options: [
      { value: '内', cell: 'H408' },
      { value: '外', cell: 'K408' },
      { value: '未指定', cell: 'H409' },
    ],
  },

  // ====================================================
  // 15. 違約金 (row 486)
  // ====================================================
  {
    fieldPath: 'contract.penalty_type',
    options: [
      { value: '手付金の額', cell: 'D486' },
      { value: '売買代金', cell: 'H486' },
    ],
  },

  // ====================================================
  // 16. 金銭貸借の斡旋 (row 499)
  // ====================================================
  {
    fieldPath: 'loan.has_mediation',
    options: [
      { value: '有', cell: 'H499' },
      { value: '無', cell: 'J499' },
    ],
  },

  // ====================================================
  // 17. 割賦販売 (row 526)
  // ====================================================
  {
    fieldPath: 'contract.installment_sale',
    options: [
      { value: '有', cell: 'H526' },
      { value: '無', cell: 'K526' },
    ],
  },

  // ====================================================
  // 18. 土地の測量清算 (row 537)
  // ====================================================
  {
    fieldPath: 'contract.land_survey_settlement',
    options: [
      { value: '有', cell: 'U537' },
      { value: '無', cell: 'X537' },
    ],
  },

  // ====================================================
  // 19. 契約不適合責任 (row 548-549)
  // ====================================================
  {
    fieldPath: 'contract.warranty_measure',
    options: [
      { value: '講ずる', cell: 'M548' },
      { value: '講じない', cell: 'M549' },
    ],
  },

  // ====================================================
  // 23. 支払金保全措置 (row 609)
  // ====================================================
  {
    fieldPath: 'contract.payment_protection',
    options: [
      { value: '講じる', cell: 'G609' },
      { value: '講じない', cell: 'K609' },
    ],
  },

  // ====================================================
  // 追加: 宅建業者 — 取引態様 (row 30) ※セル内テキスト置換
  // ====================================================

  // 追加: 宅建業者 — 供託所 (row 34-38)
  {
    fieldPath: 'contract.deposit_guarantee_type',
    options: [
      { value: '保証協会', cell: 'G34' },
    ],
  },

  // 追加: 登記 土地甲区 (row 134) — 完成形では G134=■
  // Note: 重複エントリーあり（元のmappingを上書き）
  {
    fieldPath: 'registry.land_kou_rights2',
    options: [
      { value: '無', cell: 'G134' },
    ],
  },

  // 追加: 都市計画 土地区画整理事業 (row 176)
  {
    fieldPath: 'zoning.land_readjustment_project',
    options: [
      { value: '有', cell: 'I176' },
      { value: '無', cell: 'K176' },
    ],
  },

  // 追加: 法令制限 — 航空法 (row 253)
  {
    fieldPath: 'zoning.aviation_law',
    options: [
      { value: '有', cell: 'Q253' },
    ],
  },
  // 追加: 法令制限 — 宅地造成及び特定盛土等規制法 (row 254)
  {
    fieldPath: 'zoning.land_development_law',
    options: [
      { value: '有', cell: 'I254' },
    ],
  },
  // 追加: 法令制限 — 景観法 (row 255)
  {
    fieldPath: 'zoning.landscape_law',
    options: [
      { value: '有', cell: 'Q255' },
    ],
  },

  // 追加: 敷地道路 — 私道変更制限 (row 317)
  {
    fieldPath: 'road.private_road_change',
    options: [
      { value: '有', cell: 'Q317' },
      { value: '無', cell: 'S317' },
    ],
  },
  // 追加: 敷地道路 — 法43条 (row 321)
  {
    fieldPath: 'road.article43',
    options: [
      { value: '無', cell: 'L321' },
      { value: '有', cell: 'N321' },
    ],
  },
  // 追加: 敷地道路 — 概略図 (row 334)
  {
    fieldPath: 'road.diagram_type',
    options: [
      { value: '別紙', cell: 'E334' },
    ],
  },

  // 追加: インフラ — 汚水 敷地内配管 (row 386)
  {
    fieldPath: 'infrastructure.sewage_site_pipe',
    options: [
      { value: '有', cell: 'L386' },
      { value: '無', cell: 'N386' },
    ],
  },
  // 追加: インフラ — 雑排水 前面道路配管 (row 388)
  {
    fieldPath: 'infrastructure.drainage_road_pipe',
    options: [
      { value: '有', cell: 'L388' },
      { value: '無', cell: 'N388' },
    ],
  },
  // 追加: インフラ — 雑排水 敷地内配管 (row 389)
  {
    fieldPath: 'infrastructure.drainage_site_pipe',
    options: [
      { value: '有', cell: 'L389' },
      { value: '無', cell: 'N389' },
    ],
  },
  // インフラ — 飲用水 整備予定 (row 376)
  {
    fieldPath: 'infrastructure.water_整備予定',
    options: [
      { value: '有', cell: 'W376' },
    ],
  },
  // インフラ — 飲用水 私設管有無 (row 378)
  {
    fieldPath: 'infrastructure.water_private_pipe',
    options: [
      { value: '有', cell: 'L378' },
      { value: '無', cell: 'N378' },
    ],
  },
  // インフラ — ガス 整備予定 (row 379)
  {
    fieldPath: 'infrastructure.gas_整備予定',
    options: [
      { value: '有', cell: 'W379' },
    ],
  },
  // インフラ — 電気 整備予定 (row 382)
  {
    fieldPath: 'infrastructure.electricity_整備予定',
    options: [
      { value: '有', cell: 'W382' },
    ],
  },
  // インフラ — 汚水 整備予定 (row 385)
  {
    fieldPath: 'infrastructure.sewage_整備予定',
    options: [
      { value: '有', cell: 'W385' },
    ],
  },
  // インフラ — 雑排水 整備予定 (row 388)
  {
    fieldPath: 'infrastructure.drainage_整備予定',
    options: [
      { value: '有', cell: 'W388' },
    ],
  },
  // インフラ — 雑排水 私設管有無 (row 390)
  {
    fieldPath: 'infrastructure.drainage_private_pipe',
    options: [
      { value: '有', cell: 'L390' },
      { value: '無', cell: 'N390' },
    ],
  },
  // インフラ — 雨水 整備予定 (row 391)
  {
    fieldPath: 'infrastructure.rainwater_整備予定',
    options: [
      { value: '有', cell: 'W391' },
    ],
  },

  // 追加: 災害区域 — 土砂災害 (row 406 右側)
  // Note: R406/U406 in the earlier mapping may be offset. Using correct cells.

  // 災害区域 — 洪水ハザードマップ (row 407)
  {
    fieldPath: 'disaster_zone.flood_hazard_map',
    options: [
      { value: '内', cell: 'H407' },
      { value: '外', cell: 'K407' },
    ],
  },
  // 災害区域 — 内水ハザードマップ (row 407 right side)
  {
    fieldPath: 'disaster_zone.rainwater_hazard_map',
    options: [
      { value: '内', cell: 'R407' },
      { value: '外', cell: 'U407' },
    ],
  },
  // 災害区域 — 高潮ハザードマップ (row 406 right side)
  {
    fieldPath: 'disaster_zone.storm_surge_hazard_map',
    options: [
      { value: '内', cell: 'U406' },
      { value: '外', cell: 'X406' },
    ],
  },
  // 災害区域 — 津波 (rows 408-409) — 追加セル
  {
    fieldPath: 'disaster_zone.tsunami_alert_zone',
    options: [
      { value: '有', cell: 'U408' },
      { value: '無', cell: 'W408' },
    ],
  },
  {
    fieldPath: 'disaster_zone.tsunami_special_zone',
    options: [
      { value: '有', cell: 'U409' },
      { value: '無', cell: 'W409' },
    ],
  },

  // 追加: 8. 未完成物件 (row 401)
  {
    fieldPath: 'property.incomplete_property',
    options: [
      { value: '該当', cell: 'F401' },
      { value: '非該当', cell: 'F402' },
    ],
  },

  // 追加: 12. 住宅性能評価 (row 435)
  {
    fieldPath: 'building.performance_evaluation',
    options: [
      { value: '該当', cell: 'U435' },
      { value: '非該当', cell: 'X435' },
    ],
  },
  {
    fieldPath: 'building.performance_cert',
    options: [
      { value: '有', cell: 'Q437' },
      { value: '無', cell: 'V437' },
    ],
  },
  {
    fieldPath: 'building.design_performance',
    options: [
      { value: '有', cell: 'Q438' },
    ],
  },
  {
    fieldPath: 'building.construction_performance',
    options: [
      { value: '有', cell: 'Q439' },
    ],
  },

  // 追加: 14. 契約の解除 (rows 457-474)
  {
    fieldPath: 'contract.cancel_deposit',
    options: [{ value: '有', cell: 'A457' }],
  },
  {
    fieldPath: 'contract.cancel_loss',
    options: [{ value: '有', cell: 'A459' }],
  },
  {
    fieldPath: 'contract.cancel_breach',
    options: [{ value: '有', cell: 'A461' }],
  },
  {
    fieldPath: 'contract.cancel_loan',
    options: [{ value: '有', cell: 'A463' }],
  },
  {
    fieldPath: 'contract.cancel_building_condition',
    options: [{ value: '有', cell: 'A465' }],
  },
  {
    fieldPath: 'contract.cancel_defect',
    options: [{ value: '有', cell: 'A467' }],
  },
  {
    fieldPath: 'contract.cancel_replacement',
    options: [{ value: '有', cell: 'A469' }],
  },
  {
    fieldPath: 'contract.cancel_antisocial',
    options: [{ value: '有', cell: 'A471' }],
  },

  // 追加: 20. 手付金等保全措置 (rows 563-567)
  {
    fieldPath: 'contract.deposit_protection',
    options: [
      { value: '講じません', cell: 'A563' },
      { value: '講じます', cell: 'P563' },
    ],
  },
  {
    fieldPath: 'contract.deposit_protection_incomplete',
    options: [
      { value: '有', cell: 'A565' },
    ],
  },

  // 追加: 21. 建物検査 (rows 585-588)
  {
    fieldPath: 'building_inspection.inspection_sticker',
    options: [
      { value: '有', cell: 'A585' },
    ],
  },

  // 追加: 22. 長期使用製品 (row 594)
  {
    fieldPath: 'contract.long_term_product',
    options: [
      { value: '該当', cell: 'K594' },
      { value: '非該当', cell: 'N594' },
    ],
  },

  // 追加: 法令制限 — 密集市街地整備法 (row 267)
  {
    fieldPath: 'zoning.dense_area_law',
    options: [
      { value: '有', cell: 'A267' },
    ],
  },

  // 追加: 容積率 前面道路幅員12m未満 (row 233)
  {
    fieldPath: 'zoning.floor_area_ratio_type',
    options: [
      { value: '12m未満', cell: 'G233' },
      { value: '12m以上', cell: 'G234' },
    ],
  },
];
