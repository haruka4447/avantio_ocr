import { BaseParser } from './base';
import type { LayoutTemplate } from '../models/types';
import hazardTemplate from '../../layoutTemplates/hazard.json';

export class HazardParser extends BaseParser {
  constructor() {
    super(hazardTemplate as LayoutTemplate);
  }

  protected postProcess(rawMap: Record<string, string>): Record<string, string> {
    const result = { ...super.postProcess(rawMap) };

    // Normalize flood depth
    if (result['hazard.flood_depth']) {
      result['hazard.flood_depth'] = result['hazard.flood_depth']
        .replace(/m/g, '')
        .replace(/\s/g, '')
        .trim() + 'm';
    }

    return result;
  }
}
