import { NextRequest, NextResponse } from 'next/server';
import { getProperty, deleteProperty } from '@/services/propertyService';
import { supabaseAdmin } from '@/lib/supabase';
import type { PropertyJson } from '@/models/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const property = await getProperty(id);
    return NextResponse.json(property);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteProperty(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { property_json } = body as { property_json: PropertyJson };

    if (!property_json) {
      return NextResponse.json({ error: 'property_json is required' }, { status: 400 });
    }

    // Build update data with property_json and top-level columns
    const updateData: Record<string, unknown> = {
      property_json,
      updated_at: new Date().toISOString(),
    };

    // Also update top-level columns from property_json.property
    if (property_json.property) {
      const p = property_json.property;
      if (p.address !== undefined) updateData.address = p.address;
      if (p.land_number !== undefined) updateData.land_number = p.land_number;
      if (p.land_type !== undefined) updateData.land_type = p.land_type;
      if (p.land_area !== undefined) updateData.land_area = p.land_area;
      if (p.building_name !== undefined) updateData.building_name = p.building_name;
      if (p.building_structure !== undefined) updateData.building_structure = p.building_structure;
      if (p.building_area !== undefined) updateData.building_area = p.building_area;
      if (p.building_date !== undefined) updateData.building_date = p.building_date;
      if (p.floors !== undefined) updateData.floors = p.floors;
      if (p.usage_type !== undefined) updateData.usage_type = p.usage_type;
    }

    const { error } = await supabaseAdmin
      .from('properties')
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update property: ${error.message}`);
    }

    // Return the updated property
    const updated = await getProperty(id);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
