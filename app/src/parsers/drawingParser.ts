import { BaseParser } from './base';
import type { LayoutTemplate } from '../models/types';
import drawingTemplate from '../../layoutTemplates/drawing.json';

export class DrawingParser extends BaseParser {
  constructor() {
    super(drawingTemplate as LayoutTemplate);
  }

  protected postProcess(rawMap: Record<string, string>): Record<string, string> {
    const result = { ...super.postProcess(rawMap) };

    // Normalize areas
    for (const key of ['building.area', 'property.building_area']) {
      if (result[key]) {
        const cleaned = result[key].replace(/㎡/g, '').replace(/\s/g, '').trim();
        result[key] = cleaned ? cleaned + '㎡' : '';
      }
    }

    return result;
  }
}
