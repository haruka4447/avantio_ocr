import { BaseParser } from './base';
import type { LayoutTemplate } from '../models/types';
import permitTemplate from '../../layoutTemplates/permit.json';

export class PermitParser extends BaseParser {
  protected documentType = 'permit';

  constructor() {
    super(permitTemplate as LayoutTemplate);
  }

  protected postProcess(rawMap: Record<string, string>): Record<string, string> {
    const result = { ...super.postProcess(rawMap) };

    // Map permit.* fields to building_inspection.* and building.* paths
    // that the Excel generator expects
    this.mapField(result, 'permit.confirmation_number', 'building_inspection.confirmation_number');
    this.mapField(result, 'permit.confirmation_date', 'building_inspection.confirmation_date');
    this.mapField(result, 'permit.inspection_date', 'building_inspection.interim_inspection_date');
    this.mapField(result, 'permit.inspection_result', 'building_inspection.interim1_status');

    // Map building fields from permit documents
    this.mapField(result, 'permit.building_usage', 'building.usage');
    this.mapField(result, 'permit.building_structure', 'building.structure');
    this.mapField(result, 'permit.building_floors', 'building.floors');
    this.mapField(result, 'permit.building_area', 'building.area');
    this.mapField(result, 'permit.building_location', 'building.address');

    // Format confirmation number with 第...号 wrapper if not already present
    if (result['building_inspection.confirmation_number']) {
      let num = result['building_inspection.confirmation_number'].trim();
      if (!num.startsWith('第')) num = '第 ' + num;
      if (!num.endsWith('号')) num = num + ' 号';
      result['building_inspection.confirmation_number'] = num;
    }

    // Set confirmation status to 受検済 if we have a confirmation date
    if (result['building_inspection.confirmation_date'] && !result['building_inspection.confirmation_status']) {
      result['building_inspection.confirmation_status'] = '受検済';
    }

    // Normalize area values
    for (const key of ['building.area']) {
      if (result[key]) {
        result[key] = this.normalizeArea(result[key]);
      }
    }

    // Extract floor areas from permit text if available
    this.extractFloorAreas(result);

    return result;
  }

  private mapField(result: Record<string, string>, from: string, to: string) {
    if (result[from] && !result[to]) {
      result[to] = result[from];
    }
  }

  private normalizeArea(value: string): string {
    const cleaned = value
      .replace(/[㎡m²]/g, '')
      .replace(/\s/g, '')
      .replace(/約/g, '')
      .trim();
    return cleaned ? cleaned + '㎡' : '';
  }

  private extractFloorAreas(result: Record<string, string>) {
    // If we have individual floor areas from permit, map them
    if (result['permit.floor_area_1f']) {
      result['building.floor_area_1f'] = this.normalizeArea(result['permit.floor_area_1f']);
    }
    if (result['permit.floor_area_2f']) {
      result['building.floor_area_2f'] = this.normalizeArea(result['permit.floor_area_2f']);
    }
    if (result['permit.floor_area_3f']) {
      result['building.floor_area_3f'] = this.normalizeArea(result['permit.floor_area_3f']);
    }
  }
}
