import { NextRequest, NextResponse } from 'next/server';
import { getProperty, updatePropertyStatus } from '@/services/propertyService';
import { generateExcel } from '@/excel/generator';
import type { PropertyJson } from '@/models/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { property_id } = body;

    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 });
    }

    const property = await getProperty(property_id);
    const propertyJson = property.property_json as PropertyJson;

    if (!propertyJson || !propertyJson.property) {
      return NextResponse.json(
        { error: 'Property has no parsed data. Run OCR and parse first.' },
        { status: 400 }
      );
    }

    // Generate Excel
    const excelBuffer = await generateExcel(propertyJson);

    // Update status
    await updatePropertyStatus(property_id, 'generated');

    // Return as downloadable file
    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="jyusetsu_${property_id}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
