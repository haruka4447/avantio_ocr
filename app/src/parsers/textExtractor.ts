/**
 * Text-based field extraction using regex patterns on fullText.
 * More reliable than layout engine for structured documents.
 * Runs on the OCR fullText string directly.
 *
 * For digital PDFs, text spacing/newlines may differ from scanned OCR.
 * We try matching against both original and normalized text.
 */

import { normalizeFullText } from '../utils/textNormalizer';

interface TextPattern {
  fieldPath: string;
  patterns: RegExp[];
  transform?: (match: RegExpMatchArray) => string;
}

/**
 * Registry document (登記簿謄本 / 地積測量図) patterns
 */
const REGISTRY_PATTERNS: TextPattern[] = [
  // 土地の所在 (handles: 土地の所在, 土地の 所在, 所在, 所　在)
  // 「丁目」で終わる場合は丁目までを住所とし、続く地番は含めない
  {
    fieldPath: 'property.address',
    patterns: [
      /土地の?\s*所\s*在\s*[：:]?\s*(.+?丁目)/,
      /土地の?\s*所\s*在\s*[：:]?\s*(.+?(?:番地|字\S+))/,
      /所\s*在\s+(.+?丁目)/,
      /所\s*在\s+(.+?(?:番地|字\S+))/,
    ],
  },
  // 地番
  {
    fieldPath: 'property.land_number',
    patterns: [
      /地\s*番\s*[：:]?\s*(\d+番\d*)/,
      /\(A\)\s*(\d+[-ー]\d+)/,
    ],
  },
  // 地目
  {
    fieldPath: 'property.land_type',
    patterns: [
      /地\s*目\s*[：:]?\s*(宅地|田|畑|山林|原野|雑種地)/,
    ],
  },
  // 地積 — カスタム抽出ロジック
  {
    fieldPath: 'property.land_area',
    patterns: [
      // Dummy pattern — actual extraction done in extractLandArea() below
      /____LAND_AREA_PLACEHOLDER____/,
    ],
  },
  // 所有者名 — 登記簿甲区では住所の後に名前が来る
  // パターン: "所有者 [住所]\n[名前]" or "所有者 [住所] [名前]"
  {
    fieldPath: 'ownership.name',
    patterns: [
      // 法人: 住所の後に法人名
      /所\s*有\s*者\s+.+?\n\s*(.+?(?:株式会社|有限会社|合同会社|一般社団法人|医療法人)\S*)/,
      // 共有者パターン
      /共\s*有\s*者\s+.+?\n\s*([^\n]{2,30})/,
      // 個人: 住所行の次の行（都道府県を含まない行＝名前行）
      /所\s*有\s*者\s+.+?[都道府県].+?\n\s*([^\n都道府県]{2,30})/,
      // フォールバック: 権利者
      /権\s*利\s*者\s+.+?\n\s*([^\n]{2,30})/,
    ],
  },
  // 所有者住所 — 「所有者」の直後に住所が来る
  {
    fieldPath: 'ownership.address',
    patterns: [
      // 都道府県から始まる住所
      /所\s*有\s*者\s+(.+?[都道府県].+?(?:\d+|丁目|番地|号))/,
      // 市区町村から始まる住所（政令市等）
      /所\s*有\s*者\s+(.+?[市区町村].+?(?:\d+|丁目|番地|号))/,
      // 共有者
      /共\s*有\s*者\s+(.+?[都道府県市区町村].+?(?:\d+|丁目|番地|号))/,
    ],
  },
  // 原因（売買、相続等）
  {
    fieldPath: 'ownership.cause',
    patterns: [
      /原\s*因\s+(?:令和|平成|昭和)\d+年\d+月\d+日\s*(売買|相続|贈与|交換)/,
    ],
  },
  // 持分
  {
    fieldPath: 'ownership.share',
    patterns: [
      /持\s*分\s*[：:]?\s*([\d/]+|全部)/,
      /(\d+分の\d+)/,
    ],
  },
  // 家屋番号
  {
    fieldPath: 'building.building_number',
    patterns: [
      /家屋番号\s*[：:]?\s*(\S+)/,
    ],
  },
  // 構造
  {
    fieldPath: 'building.structure',
    patterns: [
      /構\s*造\s*[：:]?\s*(木造|鉄骨造|鉄筋コンクリート造|鉄骨鉄筋コンクリート造)\S*/,
    ],
  },
  // 床面積 (handles newline/space between number and unit)
  {
    fieldPath: 'building.area',
    patterns: [
      /床\s*面\s*積\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
      /延\s*べ\s*面\s*積\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  // 抵当権 債権額
  {
    fieldPath: 'mortgage.amount',
    patterns: [
      /(?:債権額|極度額)\s*(?:金)?\s*([\d,]+)\s*円/,
    ],
    transform: (m) => m[1] + '円',
  },
  // 抵当権者
  {
    fieldPath: 'mortgage.creditor',
    patterns: [
      /(?:抵当権者|根抵当権者)\s+(.+?(?:銀行|信用金庫|信用組合|株式会社|公庫))/,
    ],
  },
  // 各階床面積 (登記簿からの抽出)
  {
    fieldPath: 'building.floor_area_1f',
    patterns: [
      /[1１]階\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  {
    fieldPath: 'building.floor_area_2f',
    patterns: [
      /[2２]階\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  {
    fieldPath: 'building.floor_area_3f',
    patterns: [
      /[3３]階\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  // 建物の所在
  {
    fieldPath: 'building.address',
    patterns: [
      /建物の?\s*所\s*在\s*[：:]?\s*(.+?(?:丁目|番地?|の一部))/,
    ],
  },
  // 種類（建物用途）
  {
    fieldPath: 'building.usage',
    patterns: [
      /種\s*類\s*[：:]?\s*(共同住宅|居宅|事務所|店舗|倉庫)/,
    ],
  },
];

/**
 * Contract document (売買契約書) patterns
 */
const CONTRACT_PATTERNS: TextPattern[] = [
  // 地目（契約書の不動産の表示テーブルから）
  // 「宅地」を先にマッチ。単独の「田」「畑」は住所の一部と誤検出するため、
  // 行頭またはスペース直後のみマッチさせる
  {
    fieldPath: 'property.land_type',
    patterns: [
      /地\s*目[\s\S]{0,60}?(宅地|山林|原野|雑種地)/,
      /(?:^|\n)\s*(宅地|田|畑|山林|原野|雑種地)\s*(?:\n|$)/,
    ],
  },
  {
    fieldPath: 'contract.price',
    patterns: [
      /売買代金[\s\S]{0,200}?金([\d,]+)円/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '円',
  },
  // 手付金: テーブル形式ではラベルと値が離れるため、
  // 「手付金」の後に出現する金額のうち、売買代金より小さい額を探す
  {
    fieldPath: 'contract.deposit_amount',
    patterns: [
      /____DEPOSIT_PLACEHOLDER____/,
    ],
  },
  {
    fieldPath: 'contract.seller_name',
    patterns: [
      // 「株式会社XXX」で止める（「と」「の」等の助詞が続く場合を排除）
      /売\s*主[\s\S]{0,100}?((?:株式会社|有限会社|合同会社)\S*?)(?:\s|と|の|が|は|$)/,
    ],
  },
  {
    fieldPath: 'contract.buyer_name',
    patterns: [
      /買\s*主[\s\S]{0,100}?((?:株式会社|有限会社|合同会社)\S*?)(?:\s|と|の|が|は|$)/,
    ],
  },
  {
    fieldPath: 'property.address',
    patterns: [
      /(?:物件)?所\s*在\s*地?\s*[：:]?\s*(.+?(?:丁目|番地|番\d+))/,
      /所\s*在\s+(.+?(?:丁目|番地))/,
    ],
  },
  {
    fieldPath: 'property.land_number',
    patterns: [
      /地\s*番\s*[：:]?\s*(\d+番\S*)/,
      /地\s*番\n(\d+番\S*)/,
    ],
  },
  {
    fieldPath: 'property.land_area',
    patterns: [
      /地積\n([\d,.]+)\s*(?:㎡|m)/,
      /(?:地積|土地面積)\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  // 取引対象面積合計
  {
    fieldPath: 'property.total_trading_area',
    patterns: [
      /地積合計\s*約?\s*([\d,.]+)\s*(?:㎡|m)/,
      /合計\s*\d+\s*筆の地積合計\s*約?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  // 建物情報（契約書の不動産の表示テーブルから）
  {
    fieldPath: 'building.usage',
    patterns: [
      /種\s*類[\s\S]{0,20}?(共同住宅|居宅|事務所|店舗|倉庫|長屋)/,
    ],
  },
  {
    fieldPath: 'building.structure',
    patterns: [
      /構\s*造[\s\S]{0,20}?(木造\S*|鉄骨造\S*|鉄筋コンクリート造\S*|鉄骨鉄筋コンクリート造\S*)/,
    ],
  },
  {
    fieldPath: 'building.floor_area_1f',
    patterns: [
      /[1１]階\s*約?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  {
    fieldPath: 'building.floor_area_2f',
    patterns: [
      /[2２]階\s*約?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  {
    fieldPath: 'building.floor_area_3f',
    patterns: [
      /[3３]階\s*約?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  {
    fieldPath: 'building.area',
    patterns: [
      /延床面積[\s\S]{0,10}?約?\s*([\d,.]+)\s*(?:㎡|m)/,
      /延\s*べ?\s*面\s*積[\s\S]{0,10}?約?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  // 住居表示
  {
    fieldPath: 'building.residential_address',
    patterns: [
      /住居表示[\s]+(.+?(?:丁目|番地?|号)\S*)/,
    ],
  },
  // 家屋番号
  {
    fieldPath: 'building.building_number',
    patterns: [
      /家屋番号[\s]+(\S+)/,
    ],
  },
  // 売買対象面積の根拠（公簿/実測）
  {
    fieldPath: 'property.land_area_basis',
    patterns: [
      /公簿\s*(?:面積|売買|取引)/,        // 「公簿面積による」「公簿売買」「公簿取引」
      /実測\s*(?:面積|売買|取引)/,         // 「実測面積による」「実測売買」「実測取引」
    ],
    transform: (m) => m[0].includes('実測') ? '実測' : '公簿',
  },
  // 実測の済/未済
  {
    fieldPath: 'property.survey_status',
    patterns: [
      /実測\s*[：:]?\s*(済|未済)/,
      /測量\s*[：:]?\s*(済|未済)/,
    ],
  },
  // 実測清算 有/無
  {
    fieldPath: 'property.survey_settlement',
    patterns: [
      /実測\s*清算\s*[：:]?\s*(有|無)/,
      /(?:売買代金の)?\s*増減を請求しない/,
    ],
    transform: (m) => m[0].includes('請求しない') ? '無' : (m[1] || '無'),
  },
  // 測量図の種類
  {
    fieldPath: 'property.survey_type',
    patterns: [
      /(確定測量図|地積測量図|現況平面図|現況測量図)/,
    ],
  },
  // 違約金率
  {
    fieldPath: 'contract.penalty_rate',
    patterns: [
      /違約金\s*(?:は)?\s*売買代金の\s*(\d+)\s*[%％]/,
      /売買代金の\s*(\d+)\s*[%％]\s*(?:相当額|に相当)/,
      /違約金\s*[：:]?\s*(\d+)\s*[%％]/,
    ],
  },
  // 違約金率（小数形式）
  {
    fieldPath: 'contract.penalty_rate_decimal',
    patterns: [
      /違約金\s*(?:は)?\s*売買代金の\s*(\d+)\s*[%％]/,
    ],
    transform: (m) => (parseInt(m[1], 10) / 100).toString(),
  },
  // 融資特約の期限
  {
    fieldPath: 'loan.loan_deadline',
    patterns: [
      /融資利用の特約.+?(?:期限|期日)\s*[：:]?\s*((?:令和|平成)\d+年\d+月\d+日)/,
      /融資\s*(?:承認|利用).+?(?:期限|期日)\s*[：:]?\s*((?:令和|平成)\d+年\d+月\d+日)/,
    ],
  },
  // 金融機関
  {
    fieldPath: 'loan.bank_name',
    patterns: [
      /(?:金融機関|融資先|借入先|申込先)\s*[：:]?\s*(?:■有・無\n)?(.+?(?:銀行|信用金庫|信用組合))/,
      /(?:申込先)\s*\n?\s*(?:■有・無\n)?(.+?(?:銀行|信用金庫|信用組合))/,
    ],
  },
  // 融資額
  {
    fieldPath: 'loan.loan_amount',
    patterns: [
      /融資\n.*?金([\d,]+)円/,
      /融資額?\s*(?:金)?\s*([\d,]+)\s*円/,
      /借入金?\s*(?:金)?\s*([\d,]+)\s*円/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '円',
  },
  // 金利
  {
    fieldPath: 'loan.interest_rate',
    patterns: [
      /金利\s*[：:]?\s*([\d.]+\s*[%％]\s*(?:迄|以内)?)/,
      /利率\s*[：:]?\s*([\d.]+\s*[%％])/,
    ],
  },
  // 借入期間
  {
    fieldPath: 'loan.loan_period',
    patterns: [
      /借入期間\s*[：:]?\s*(\d+\s*年)/,
      /返済期間\s*[：:]?\s*(\d+\s*年)/,
    ],
  },
  // 返済方法
  {
    fieldPath: 'loan.repayment_method',
    patterns: [
      /返済方法\s*[：:]?\s*(元利均等|元金均等)/,
    ],
  },
  // 保証料
  {
    fieldPath: 'loan.guarantee_fee',
    patterns: [
      /保証料\s*(?:金)?\s*([\d,]+)\s*円/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '円',
  },
  // ローン事務手数料
  {
    fieldPath: 'loan.loan_fee',
    patterns: [
      /(?:ローン)?事務手数料\s*(?:金)?\s*([\d,]+)\s*円/,
      /融資手数料\s*(?:金)?\s*([\d,]+)\s*円/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '円',
  },
  // 契約日
  {
    fieldPath: 'contract.contract_date',
    patterns: [
      /契約(?:締結)?日\s*[：:]?\s*((?:令和|平成)\d+年\d+月\d+日)/,
    ],
  },
  // 引渡日
  {
    fieldPath: 'contract.delivery_date',
    patterns: [
      /引渡(?:し)?(?:期日|日|予定日)\s*[：:]?\s*((?:令和|平成)\d+年\d+月\d+日)/,
    ],
  },
];

/**
 * Permit document (確認申請書 / 確認済証 / 中間検査合格証) patterns
 */
const PERMIT_PATTERNS: TextPattern[] = [
  // 建築確認番号
  {
    fieldPath: 'building_inspection.confirmation_number',
    patterns: [
      /確認番号\s*[：:]?\s*第?\s*(R?\d+確認\S+?\d+)\s*号?/,
      /(?:確認番号|第)\s*(R?\d+\S*?\d+\s*号)/,
      /(?:確認番号|第)\s*(.+?号)/,
    ],
    transform: (m) => {
      let num = m[1].trim();
      if (!num.startsWith('第')) num = '第 ' + num;
      if (!num.endsWith('号')) num = num + ' 号';
      return num;
    },
  },
  // 建築確認日
  {
    fieldPath: 'building_inspection.confirmation_date',
    patterns: [
      /確認(?:年月日|済証交付日|日)\s*[：:]?\s*((?:令和|平成)\d+年\d+月\d+日)/,
      /確認済証\s*[：:]?\s*.+?((?:令和|平成)\d+年\d+月\d+日)/,
    ],
  },
  // 中間検査合格証番号(基礎)
  {
    fieldPath: 'building_inspection.interim_inspection_number',
    patterns: [
      /中間検査合格証.+?第?\s*(R?\d+確合\S+?\d+)\s*号?/,
      /合格証番号\s*[：:]?\s*第?\s*(R?\d+確合\S+?\d+)\s*号?/,
    ],
    transform: (m) => {
      let num = m[1].trim();
      if (!num.startsWith('第')) num = '第 ' + num;
      if (!num.endsWith('号')) num = num + ' 号';
      return num;
    },
  },
  // 中間検査日
  {
    fieldPath: 'building_inspection.interim_inspection_date',
    patterns: [
      /中間検査.+?(?:合格|検査)\s*(?:年月日|日)\s*[：:]?\s*((?:令和|平成)\d+年\d+月\d+日)/,
      /検査年月日\s*[：:]?\s*((?:令和|平成)\d+年\d+月\d+日)/,
    ],
  },
  // 構造
  {
    fieldPath: 'building.structure',
    patterns: [
      /構\s*造\s*[：:]?\s*(木造|鉄骨造|鉄筋コンクリート造?|鉄骨鉄筋コンクリート造?)\S*/,
    ],
  },
  // 用途
  {
    fieldPath: 'building.usage',
    patterns: [
      /(?:主要用途|用\s*途)\s*[：:]?\s*(共同住宅|一戸建て?の?住宅|事務所|店舗|倉庫|長屋)\S*/,
    ],
  },
  // 延べ面積
  {
    fieldPath: 'building.area',
    patterns: [
      /延\s*べ\s*面\s*積\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  // 階数
  {
    fieldPath: 'building.floors',
    patterns: [
      /(?:階\s*数|地\s*上)\s*[：:]?\s*(\d+)\s*階/,
      /地\s*上\s*(\d+)\s*階/,
    ],
    transform: (m) => m[1] + '階',
  },
  // 各階床面積
  {
    fieldPath: 'building.floor_area_1f',
    patterns: [
      /[1１]階\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  {
    fieldPath: 'building.floor_area_2f',
    patterns: [
      /[2２]階\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  {
    fieldPath: 'building.floor_area_3f',
    patterns: [
      /[3３]階\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  // 敷地面積 → property.land_area
  {
    fieldPath: 'property.land_area',
    patterns: [
      /敷地面積\s*[：:]?\s*([\d,.]+)\s*(?:㎡|m)/,
    ],
    transform: (m) => m[1].replace(/,/g, '') + '㎡',
  },
  // 建築場所 → building.address
  {
    fieldPath: 'building.address',
    patterns: [
      /建築場所\s*[：:]?\s*(.+?(?:丁目|番地?|号))/,
      /敷地の位置\s*[：:]?\s*(.+?(?:丁目|番地?|号))/,
      /設置場所又は築造場所\s*(.+?(?:丁目|番地?|号))/,
    ],
    // Remove leading prefecture "大阪府" duplicate if present after city
    transform: (m) => {
      let addr = m[1].trim();
      // Remove common OCR prefix garbage like "、" or whitespace
      addr = addr.replace(/^[、,.\s]+/, '');
      return addr;
    },
  },
  // 建築主 → ownership.name (申請者＝売主の可能性)
  {
    fieldPath: 'permit.applicant',
    patterns: [
      /建\s*築\s*主\s*[：:]?\s*(.+?(?:株式会社|有限会社|合同会社)\S*)/,
      /申\s*請\s*者\s*[：:]?\s*(.+?(?:株式会社|有限会社|合同会社)\S*)/,
    ],
  },

  // ================================================================
  // 重要事項説明書（仕入れ用重説）からの抽出パターン
  // ================================================================

  // --- zoning (法令制限) ---
  {
    fieldPath: 'zoning.area_classification',
    patterns: [
      /(?:■\s*)?市街化区域/,
    ],
    transform: () => '市街化区域',
  },
  {
    fieldPath: 'zoning.use_district',
    patterns: [
      /用途地域\s*(第[一二三1-3]種[低中高]層?住居専用地域|第[一二1-2]種住居地域|準住居地域|近隣商業地域|商業地域|準工業地域|工業地域|工業専用地域)/,
    ],
  },
  {
    fieldPath: 'zoning.building_coverage_ratio',
    patterns: [
      /指定建ぺい率[\s\S]{0,10}?(\d+)\s*[%％]/,
    ],
  },
  {
    fieldPath: 'zoning.floor_area_ratio',
    patterns: [
      /指定容積率[\s\S]{0,10}?(\d+)\s*[%％]/,
    ],
  },
  {
    fieldPath: 'zoning.fire_zone',
    patterns: [
      /(準防火地域)/,        // 準防火を先にチェック
      /(?:■\s*)(防火地域)/,  // ■付きの防火地域のみ（質問文を除外）
    ],
  },
  {
    fieldPath: 'zoning.road_setline',
    patterns: [
      /道路斜線制限\s*[：:]?\s*(有|無)/,
    ],
  },
  {
    fieldPath: 'zoning.adjacent_setline',
    patterns: [
      /隣地斜線制限\s*[：:]?\s*(有|無)/,
    ],
  },
  {
    fieldPath: 'zoning.north_setline',
    patterns: [
      /北側斜線制限\s*[：:]?\s*(有|無)/,
    ],
  },
  {
    fieldPath: 'zoning.shadow_regulation',
    patterns: [
      /日影規制\s*[：:]?\s*(有|無)/,
    ],
  },

  // --- road (敷地と道路) ---
  // 接道テーブル行: "北側 公道 カ 3.72 m 13.01 m" のようなパターン
  {
    fieldPath: 'road.direction',
    patterns: [
      /(北側|南側|東側|西側|北東側|北西側|南東側|南西側)\s*(?:公道|私道)/,
    ],
  },
  {
    fieldPath: 'road.road_type',
    patterns: [
      /(?:北側|南側|東側|西側|北東側|北西側|南東側|南西側)\s*(公道|私道)/,
    ],
  },
  {
    fieldPath: 'road.road_category_display',
    patterns: [
      /(?:公道|私道)\s*(ア|イ|ウ|エ|オ|カ|キ)\s/,
    ],
    transform: (m) => {
      const map: Record<string, string> = {
        'ア': '42条1項1号', 'イ': '42条1項2号', 'ウ': '42条1項3号',
        'エ': '42条1項4号', 'オ': '42条1項5号', 'カ': '42条2項', 'キ': '42条外',
      };
      return map[m[1]] || m[1];
    },
  },
  {
    fieldPath: 'road.width',
    patterns: [
      // 接道テーブル内: "カ\n3.72 m" や "カ 3.72 m"
      /(?:ア|イ|ウ|エ|オ|カ|キ)\s+([\d.]+)\s*m/,
    ],
    transform: (m) => m[1] + 'm',
  },
  {
    fieldPath: 'road.frontage_length',
    patterns: [
      // テーブルが1行の場合: "カ 3.72 m 13.01 m"
      /(?:ア|イ|ウ|エ|オ|カ|キ)\s+[\d.]+\s*m\s+([\d.\s]+)\s*m/,
      // テーブルが改行区切りの場合: 幅員行の次の行
      /[\d.]+\s*m\n([\d.\s]+)\s*m/,
    ],
    transform: (m) => m[1].replace(/\s/g, '') + 'm',
  },
  {
    fieldPath: 'road.setback',
    patterns: [
      /セットバック部分約?([\d.]+)\s*㎡/,
    ],
    transform: () => '有',
  },

  // --- disaster_zone (災害区域) ---
  // 回答パターン: "造成宅地防災区域外・口内" (■外 or ■内)
  {
    fieldPath: 'disaster_zone.development_disaster_zone',
    patterns: [
      /造成宅地防災区域(外)・/,    // 外が選択（■外・□内）
      /造成宅地防災区域.+?・.*(内)/,  // 内が選択
    ],
  },
  {
    fieldPath: 'disaster_zone.landslide_zone',
    patterns: [
      /土砂災害警戒区域\n\s*(外)/,
      /土砂災害警戒区域\s+(外)/,
      /土砂災害警戒区域\n\s*(内)/,
      /土砂災害警戒区域\s+(内)/,
    ],
  },
  {
    fieldPath: 'disaster_zone.tsunami_zone',
    patterns: [
      // "ア.津波災害警戒区域" の後、数行先に "外・口内" がある
      /ア.津波災害警戒区域[\s\S]{0,60}?(外)・/,
      /ア.津波災害警戒区域[\s\S]{0,60}?・.*(内)/,
    ],
  },
  {
    fieldPath: 'disaster_zone.flood_hazard_map',
    patterns: [
      /洪水\s*[：:]?\s*(?:■\s*)?(有)/,
      /洪水\s*[：:]?\s*(?:■\s*)?(無)/,
    ],
    transform: (m) => m[0].includes('有') ? '内' : '外',
  },
  {
    fieldPath: 'disaster_zone.rainwater_hazard_map',
    patterns: [
      /(?:雨水出水|内水)\s*[（(]?内水[）)]?\s*[：:]?\s*(?:■\s*)?(有)/,
      /(?:雨水出水|内水)\s*[（(]?内水[）)]?\s*[：:]?\s*(?:■\s*)?(無)/,
    ],
    transform: (m) => m[0].includes('有') ? '内' : '外',
  },

  // --- infrastructure (インフラ) ---
  {
    fieldPath: 'infrastructure.water_type',
    patterns: [
      /飲用水[\s\S]{0,20}?水道\s*[（(]\s*(公営)\s*[）)]/,
    ],
    transform: () => '公営水道',
  },
  {
    fieldPath: 'infrastructure.water_road_pipe',
    patterns: [
      /飲用水[\s\S]{0,60}?前面道路配管\s*[（(]\s*(有|無)\s*[）)]/,
    ],
  },
  {
    fieldPath: 'infrastructure.water_site_pipe',
    patterns: [
      /飲用水[\s\S]{0,120}?敷地内配管\s*[（(]\s*(有|無)\s*[）)]/,
    ],
  },
  {
    fieldPath: 'infrastructure.gas_type',
    patterns: [
      /(都市ガス)/,
    ],
  },
  {
    fieldPath: 'infrastructure.gas_road_pipe',
    patterns: [
      /ガス[\s\S]{0,80}?前面道路配管\s*[（(]\s*(有|無)\s*[）)]/,
    ],
  },
  {
    fieldPath: 'infrastructure.gas_site_pipe',
    patterns: [
      /ガス[\s\S]{0,120}?敷地内配管\s*[（(]\s*(有|無)\s*[）)]/,
    ],
  },
  {
    fieldPath: 'infrastructure.sewage_type',
    patterns: [
      /汚水[\s\S]{0,20}?(公共下水)/,
    ],
  },
  {
    fieldPath: 'infrastructure.sewage_road_pipe',
    patterns: [
      /汚水[\s\S]{0,60}?前面道路配管\s*[（(]\s*(有|無)\s*[）)]/,
    ],
  },
  {
    fieldPath: 'infrastructure.drainage_type',
    patterns: [
      /雑排水[\s\S]{0,20}?(公共下水)/,
    ],
  },
  {
    fieldPath: 'infrastructure.drainage_road_pipe',
    patterns: [
      /雑排水[\s\S]{0,60}?前面道路配管\s*[（(]\s*(有|無)\s*[）)]/,
    ],
  },
  {
    fieldPath: 'infrastructure.rainwater_type',
    patterns: [
      /雨水[\s\S]{0,20}?(公共下水|側溝等|浸透式)/,
    ],
  },

  // --- private_road (私道負担) ---
  {
    fieldPath: 'private_road.burden_area',
    patterns: [
      /負担[\s\S]{0,20}?面積[\s\S]{0,20}?約?([\d.]+)\s*㎡/,
    ],
    transform: (m) => m[1] + '㎡',
  },
];

/**
 * Hazard map (ハザードマップ) patterns
 */
const HAZARD_PATTERNS: TextPattern[] = [
  {
    fieldPath: 'hazard.flood_depth',
    patterns: [
      /浸水想定(?:深さ|区域図)[\s\S]*?([\d.]+[~～][\d.]+m|[\d.]+m未満|[\d.]+m以上)/,
    ],
  },
  {
    fieldPath: 'hazard.hazard_type',
    patterns: [
      /浸水想定区域図\s*[-ー]\s*(.+?(?:氾濫|した場合))/,
    ],
  },
];

const PATTERN_MAP: Record<string, TextPattern[]> = {
  registry: REGISTRY_PATTERNS,
  contract: CONTRACT_PATTERNS,
  permit: PERMIT_PATTERNS,
  hazard: HAZARD_PATTERNS,
};

/**
 * Extract land area from text.
 * Finds all "数値\nm" or "数値㎡" patterns and picks the most likely land area
 * (typically the value that appears as "地積 XXX.XX" in survey data).
 */
function extractLandArea(text: string): string | null {
  // Strategy 1: Look for "面積\n" or "地積" followed by a standalone decimal number on its own line
  // In 地積測量図, the actual area appears as "171.87\nm" standalone
  const areaMatches = [...text.matchAll(/([\d]+\.[\d]{2})\s*\n\s*(?:㎡|m\b)/g)];
  if (areaMatches.length > 0) {
    // Pick the largest value (land area is usually the largest measurement)
    const values = areaMatches.map(m => ({ text: m[1], value: parseFloat(m[1]) }));
    values.sort((a, b) => b.value - a.value);
    return values[0].text + '㎡';
  }

  // Strategy 2: "地積 XXX.XX ㎡" in a single line
  const directMatch = text.match(/地\s*積\s*[：:]?\s*([\d,.]+)\s*㎡/);
  if (directMatch) {
    return directMatch[1].replace(/,/g, '') + '㎡';
  }

  return null;
}

/**
 * Extract deposit amount from contract text.
 * In table-linearized OCR, labels and values are separated. The deposit amount
 * is typically 5-10% of the sale price. We find all `金XXX円` amounts and pick
 * the one that is likely the deposit (not the largest = sale price).
 */
function extractDepositAmount(text: string): string | null {
  // Find all monetary amounts
  const amounts = [...text.matchAll(/金([\d,]+)円/g)]
    .map(m => ({ text: m[1], value: parseInt(m[1].replace(/,/g, ''), 10) }))
    .filter(a => a.value > 0);

  if (amounts.length < 2) return null;

  // Sort by value descending
  amounts.sort((a, b) => b.value - a.value);

  // The largest is likely the sale price. Deposit is typically 5-10% of the price.
  const salePrice = amounts[0].value;
  const depositCandidates = amounts.filter(a =>
    a.value < salePrice && a.value >= salePrice * 0.01 && a.value <= salePrice * 0.15
  );

  if (depositCandidates.length > 0) {
    // Prefer round numbers (deposits are typically round amounts like 5,000,000)
    const roundCandidates = depositCandidates.filter(a => a.value % 1000000 === 0);
    const pool = roundCandidates.length > 0 ? roundCandidates : depositCandidates;
    // Pick the one closest to 5% of sale price
    pool.sort((a, b) =>
      Math.abs(a.value - salePrice * 0.05) - Math.abs(b.value - salePrice * 0.05)
    );
    return pool[0].text.replace(/,/g, '') + '円';
  }

  return null;
}

/**
 * Extract fields from fullText using regex patterns.
 * Returns a map of fieldPath -> extracted value.
 *
 * Tries matching against both original text and normalized text
 * to handle digital PDF vs scanned OCR text differences.
 */
export function extractFromText(
  fullText: string,
  documentType: string
): Record<string, string> {
  const patterns = PATTERN_MAP[documentType];
  if (!patterns) return {};

  const result: Record<string, string> = {};
  // Remove table border characters from registry/permit OCR text
  const cleaned = fullText.replace(/\r\n/g, '\n').replace(/[┃┠┨┣┫┏┓┗┛┝┥│├┤─━┼┤┬┴╋║═╔╗╚╝╠╣╦╩┠┏┓┗┛]+/g, ' ').replace(/ {2,}/g, ' ');
  const original = cleaned;
  const normalized = normalizeFullText(cleaned);

  for (const tp of patterns) {
    if (result[tp.fieldPath]) continue;

    // Special handling for land area
    if (tp.fieldPath === 'property.land_area' && documentType === 'registry') {
      const area = extractLandArea(original) || extractLandArea(normalized);
      if (area) {
        result[tp.fieldPath] = area;
      }
      continue;
    }

    // Special handling for deposit amount (contract table linearization issue)
    if (tp.fieldPath === 'contract.deposit_amount') {
      const deposit = extractDepositAmount(original) || extractDepositAmount(normalized);
      if (deposit) {
        result[tp.fieldPath] = deposit;
      }
      continue;
    }

    for (const pattern of tp.patterns) {
      // Try original first, then normalized (handles digital PDF spacing differences)
      const match = original.match(pattern) || normalized.match(pattern);
      if (match) {
        if (tp.transform) {
          result[tp.fieldPath] = tp.transform(match);
        } else {
          result[tp.fieldPath] = match[1].trim();
        }
        break;
      }
    }
  }

  return result;
}
