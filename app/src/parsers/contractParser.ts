import { BaseParser } from './base';
import type { LayoutTemplate } from '../models/types';
import contractTemplate from '../../layoutTemplates/contract.json';

export class ContractParser extends BaseParser {
  protected documentType = 'contract';

  constructor() {
    super(contractTemplate as LayoutTemplate);
  }

  protected postProcess(rawMap: Record<string, string>): Record<string, string> {
    const result = { ...super.postProcess(rawMap) };

    // Normalize prices (売買代金, 手付金, 融資額)
    for (const key of ['contract.price', 'contract.deposit_amount', 'loan.loan_amount']) {
      if (result[key]) {
        result[key] = this.normalizePrice(result[key]);
      }
    }

    // Normalize dates
    for (const key of ['contract.contract_date', 'contract.delivery_date']) {
      if (result[key]) {
        result[key] = result[key].replace(/\s+/g, '').trim();
      }
    }

    // Normalize seller/buyer names: remove OCR artifacts
    for (const key of ['contract.seller_name', 'contract.buyer_name']) {
      if (result[key]) {
        result[key] = this.normalizeCompanyName(result[key]);
      }
    }

    // Normalize addresses: formal format for 重要事項説明書
    for (const key of ['contract.seller_address', 'contract.buyer_address']) {
      if (result[key]) {
        result[key] = this.normalizeJapaneseAddress(result[key]);
      }
    }

    // Normalize penalty rate (e.g. "10%" -> "0.1", or "売買代金の10%" -> "10")
    if (result['contract.penalty_rate']) {
      const match = result['contract.penalty_rate'].match(/(\d+)\s*[%％]/);
      if (match) {
        result['contract.penalty_rate'] = match[1];
      }
    }

    // Normalize interest rate
    if (result['loan.interest_rate']) {
      result['loan.interest_rate'] = result['loan.interest_rate']
        .replace(/\s/g, '')
        .trim();
    }

    // Normalize loan period
    if (result['loan.loan_period']) {
      result['loan.loan_period'] = result['loan.loan_period']
        .replace(/\s/g, '')
        .trim();
    }

    return result;
  }

  /**
   * Normalize company names: remove OCR artifacts.
   * e.g. "株式会社 アバンティオー" → "株式会社アバンティオ"
   */
  private normalizeCompanyName(name: string): string {
    return name
      // Remove space between 株式会社 and company name
      .replace(/(株式会社|有限会社|合同会社|一般社団法人)\s+/g, '$1')
      // Remove trailing OCR artifacts: long vowel mark at end of company name
      .replace(/ー$/, '')
      .replace(/\s{2,}/g, '')
      .replace(/　/g, '')
      .trim();
  }

  /**
   * Normalize Japanese address to formal format for 重要事項説明書.
   * Removes postal code, converts "2F"→"2階", "25-1"→"25番1号", numeric 丁目→kanji 丁目
   */
  private normalizeJapaneseAddress(address: string): string {
    let result = address
      // Remove postal code (〒XXX-XXXX)
      .replace(/〒?\s*\d{3}-?\d{4}\s*/g, '')
      // Remove extra spaces
      .replace(/\s{2,}/g, '')
      .replace(/　/g, '')
      .trim();

    // Convert "2F" / "3F" → "2階" / "3階"
    result = result.replace(/(\d+)\s*[FＦ](?:\s|$)/g, '$1階');

    // Convert "25-1" after 丁目/番 to "25番1号" format
    result = result.replace(/(\d+)[-ー](\d+)(?!丁目|番|号|階)/g, '$1番$2号');

    // Convert numeric 丁目 to kanji (1丁目 → 一丁目)
    const kanjiNums = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    result = result.replace(/(\d+)丁目/g, (_, num) => {
      const n = parseInt(num, 10);
      return (n <= 10 ? kanjiNums[n] : num) + '丁目';
    });

    return result;
  }

  private normalizePrice(value: string): string {
    // Remove 金, 円, spaces; keep the number with commas
    let cleaned = value
      .replace(/[金円￥\\]/g, '')
      .replace(/\s/g, '')
      .trim();

    // If it's a plain number, add commas for readability
    const numMatch = cleaned.match(/^(\d+)$/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      cleaned = num.toLocaleString('ja-JP');
    }

    return cleaned + '円';
  }
}
