import { BaseParser } from './base';
import type { LayoutTemplate } from '../models/types';
import registryTemplate from '../../layoutTemplates/registry.json';

export class RegistryParser extends BaseParser {
  protected documentType = 'registry';

  constructor() {
    super(registryTemplate as LayoutTemplate);
  }

  protected postProcess(rawMap: Record<string, string>): Record<string, string> {
    const result = { ...super.postProcess(rawMap) };

    // Normalize land area: ensure consistent ㎡ format
    if (result['property.land_area']) {
      result['property.land_area'] = this.normalizeArea(result['property.land_area']);
    }

    // Normalize building area
    if (result['building.area']) {
      result['building.area'] = this.normalizeArea(result['building.area']);
    }

    // Normalize floor areas
    for (const key of ['building.floor_area_1f', 'building.floor_area_2f', 'building.floor_area_3f']) {
      if (result[key]) {
        result[key] = this.normalizeArea(result[key]);
      }
    }

    // Normalize mortgage amount: ensure yen format
    if (result['mortgage.amount']) {
      result['mortgage.amount'] = this.normalizeYen(result['mortgage.amount']);
    }

    // Normalize dates to consistent format
    for (const key of ['ownership.registration_date', 'building.built_date']) {
      if (result[key]) {
        result[key] = this.normalizeDate(result[key]);
      }
    }

    // Normalize address: remove extra spaces and separate land_number if mixed in
    if (result['property.address']) {
      result['property.address'] = this.separateAddressAndLandNumber(result, result['property.address']);
    }

    // Normalize share format (e.g. "1/1", "持分2分の1" -> "1/2")
    if (result['ownership.share']) {
      result['ownership.share'] = this.normalizeShare(result['ownership.share']);
    }

    // Default right_type to 所有権 if we have ownership data but no type
    if (result['ownership.name'] && !result['ownership.right_type']) {
      result['ownership.right_type'] = '所有権';
    }

    return result;
  }

  private normalizeArea(value: string): string {
    const cleaned = value
      .replace(/[㎡m²]/g, '')
      .replace(/\s/g, '')
      .replace(/約/g, '')
      .trim();
    return cleaned ? cleaned + '㎡' : '';
  }

  private normalizeYen(value: string): string {
    return value
      .replace(/[円金]/g, '')
      .replace(/\s/g, '')
      .trim() + '円';
  }

  private normalizeDate(value: string): string {
    // Keep Japanese era format as-is, just trim
    return value
      .replace(/\s+/g, '')
      .trim();
  }

  /**
   * Separate land_number from address if mixed in.
   * e.g. "大阪市東住吉区住道矢田1丁目25番19" → address="大阪市東住吉区住道矢田一丁目", land_number="25番19"
   */
  private separateAddressAndLandNumber(result: Record<string, string>, address: string): string {
    let cleaned = address.replace(/\s{2,}/g, '').replace(/　/g, '').trim();

    // If address contains "丁目" followed by digits (land number), split them
    const match = cleaned.match(/^(.+?[丁目])(\d+番.*)$/);
    if (match) {
      cleaned = match[1];
      // Set land_number if not already extracted
      if (!result['property.land_number']) {
        result['property.land_number'] = match[2];
      }
    }

    // Convert numeric 丁目 to kanji (1丁目 → 一丁目) for formal documents
    cleaned = cleaned.replace(/(\d+)丁目/, (_, num) => {
      const kanjiNums = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
      const n = parseInt(num, 10);
      return (n <= 10 ? kanjiNums[n] : num) + '丁目';
    });

    return cleaned;
  }

  private normalizeShare(value: string): string {
    // "持分2分の1" -> "1/2"
    const match = value.match(/(\d+)\s*分\s*の\s*(\d+)/);
    if (match) {
      return `${match[2]}/${match[1]}`;
    }
    // Already in fraction format
    return value.replace(/\s/g, '').trim();
  }
}
