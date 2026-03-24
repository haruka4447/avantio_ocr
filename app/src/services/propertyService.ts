import { supabaseAdmin } from '../lib/supabase';
import type { PropertyJson, PropertyRecord, OwnerData, MortgageData } from '../models/types';

const EMPTY_PROPERTY_JSON: PropertyJson = {
  property: {},
  building: {},
  ownership: [],
  mortgage: [],
  contract: {},
  hazard: {},
  zoning: {},
  road: {},
  private_road: {},
  infrastructure: {},
  disaster_zone: {},
  loan: {},
  building_inspection: {},
  attachments: {},
};

/**
 * Reset property_json to empty state (used before reparse to clear stale data).
 */
export async function resetPropertyJson(propertyId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('properties')
    .update({ property_json: EMPTY_PROPERTY_JSON, updated_at: new Date().toISOString() })
    .eq('id', propertyId);
  if (error) throw new Error(`Failed to reset property_json: ${error.message}`);
}

/**
 * Creates an empty property and returns its ID.
 */
export async function createProperty(): Promise<string> {
  const emptyJson: PropertyJson = {
    property: {},
    building: {},
    ownership: [],
    mortgage: [],
    contract: {},
    hazard: {},
    zoning: {},
    road: {},
    private_road: {},
    infrastructure: {},
    disaster_zone: {},
    loan: {},
    building_inspection: {},
    attachments: {},
  };

  const { data, error } = await supabaseAdmin
    .from('properties')
    .insert({ property_json: emptyJson, status: 'draft' })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create property: ${error.message}`);
  return data.id;
}

/**
 * Get a property by ID.
 */
export async function getProperty(id: string): Promise<PropertyRecord> {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Failed to get property: ${error.message}`);
  return data as PropertyRecord;
}

/**
 * List all properties.
 */
export async function listProperties(): Promise<PropertyRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list properties: ${error.message}`);
  return (data || []) as PropertyRecord[];
}

// All sections in PropertyJson that are simple objects (not arrays)
const OBJECT_SECTIONS = [
  'property', 'building', 'contract', 'hazard',
  'zoning', 'road', 'private_road', 'infrastructure',
  'disaster_zone', 'loan', 'building_inspection', 'attachments',
] as const;

// Array sections
const ARRAY_SECTIONS = ['ownership', 'mortgage'] as const;

/**
 * Merge parsed data into the property JSON.
 * Uses a deep merge strategy: new values overwrite existing ones,
 * arrays (ownership, mortgage) are appended.
 */
export async function mergePropertyData(
  propertyId: string,
  parsedMap: Record<string, string>
): Promise<PropertyJson> {
  const property = await getProperty(propertyId);
  const json = (property.property_json || {
    property: {},
    building: {},
    ownership: [],
    mortgage: [],
    contract: {},
    hazard: {},
    zoning: {},
    road: {},
    private_road: {},
    infrastructure: {},
    disaster_zone: {},
    loan: {},
    building_inspection: {},
  }) as PropertyJson;

  // Ensure all sections exist
  const jsonAny = json as unknown as Record<string, unknown>;
  for (const section of OBJECT_SECTIONS) {
    if (!jsonAny[section]) jsonAny[section] = {};
  }
  for (const section of ARRAY_SECTIONS) {
    if (!jsonAny[section]) jsonAny[section] = [];
  }

  // Temporary collectors for array items
  const ownerFields: Record<string, string> = {};
  const mortgageFields: Record<string, string> = {};

  for (const [fieldPath, value] of Object.entries(parsedMap)) {
    const parts = fieldPath.split('.');
    if (parts.length < 2) continue;

    const [section, field] = parts;

    // Check if it's an object section
    if (OBJECT_SECTIONS.includes(section as typeof OBJECT_SECTIONS[number])) {
      const obj = (json as unknown as Record<string, unknown>)[section];
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const existing = (obj as Record<string, string>)[field];
        // Don't overwrite existing values — first extracted value wins
        if (!existing) {
          (obj as Record<string, string>)[field] = value;
        }
      }
    }
    // Array sections: collect fields then push as new entry
    else if (section === 'ownership') {
      ownerFields[field] = value;
    } else if (section === 'mortgage') {
      mortgageFields[field] = value;
    }
  }

  // Merge owner fields: update existing entry if name matches, otherwise append
  if (Object.keys(ownerFields).length > 0) {
    const newOwner = ownerFields as unknown as OwnerData;
    const existingIdx = json.ownership.findIndex(o =>
      o.name && newOwner.name && o.name === newOwner.name
    );
    if (existingIdx >= 0) {
      // Update existing entry (fill in missing fields only)
      const existing = json.ownership[existingIdx];
      for (const [k, v] of Object.entries(newOwner)) {
        if (v && !(existing as unknown as Record<string, string>)[k]) {
          (existing as unknown as Record<string, string>)[k] = v;
        }
      }
    } else if (json.ownership.length === 0) {
      // First entry: always add
      json.ownership.push(newOwner);
    } else if (newOwner.name) {
      // New distinct owner: append
      json.ownership.push(newOwner);
    } else {
      // No name: merge into first entry (fill missing fields)
      const existing = json.ownership[0];
      for (const [k, v] of Object.entries(newOwner)) {
        if (v && !(existing as unknown as Record<string, string>)[k]) {
          (existing as unknown as Record<string, string>)[k] = v;
        }
      }
    }
  }

  // Merge mortgage fields: update existing if creditor matches, otherwise append
  if (Object.keys(mortgageFields).length > 0) {
    const newMortgage = mortgageFields as unknown as MortgageData;
    const existingIdx = json.mortgage.findIndex(m =>
      m.creditor && newMortgage.creditor && m.creditor === newMortgage.creditor
    );
    if (existingIdx >= 0) {
      const existing = json.mortgage[existingIdx];
      for (const [k, v] of Object.entries(newMortgage)) {
        if (v && !(existing as unknown as Record<string, string>)[k]) {
          (existing as unknown as Record<string, string>)[k] = v;
        }
      }
    } else {
      json.mortgage.push(newMortgage);
    }
  }

  // Update the property record
  const updateData: Record<string, unknown> = {
    property_json: json,
    updated_at: new Date().toISOString(),
  };

  // Also update top-level columns from property section
  if (json.property.address) updateData.address = json.property.address;
  if (json.property.land_number) updateData.land_number = json.property.land_number;
  if (json.property.land_type) updateData.land_type = json.property.land_type;
  if (json.property.land_area) updateData.land_area = json.property.land_area;
  if (json.property.building_name) updateData.building_name = json.property.building_name;
  if (json.property.building_structure) updateData.building_structure = json.property.building_structure;
  if (json.property.building_area) updateData.building_area = json.property.building_area;
  if (json.property.building_date) updateData.building_date = json.property.building_date;
  if (json.property.floors) updateData.floors = json.property.floors;
  if (json.property.usage_type) updateData.usage_type = json.property.usage_type;

  const { error } = await supabaseAdmin
    .from('properties')
    .update(updateData)
    .eq('id', propertyId);

  if (error) throw new Error(`Failed to update property: ${error.message}`);

  return json;
}

/**
 * Update property status.
 */
export async function updatePropertyStatus(
  propertyId: string,
  status: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('properties')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', propertyId);

  if (error) throw new Error(`Failed to update property status: ${error.message}`);
}

/**
 * Delete a property and all related records.
 */
export async function deleteProperty(propertyId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('properties')
    .delete()
    .eq('id', propertyId);

  if (error) throw new Error(`Failed to delete property: ${error.message}`);
}
