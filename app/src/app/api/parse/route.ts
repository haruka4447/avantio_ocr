import { NextRequest, NextResponse } from 'next/server';
import { getDocument, updateParsedData } from '@/services/documentService';
import { mergePropertyData, updatePropertyStatus } from '@/services/propertyService';
import { getParser } from '@/parsers';
import type { DocumentType } from '@/models/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document_id } = body;

    if (!document_id) {
      return NextResponse.json({ error: 'document_id is required' }, { status: 400 });
    }

    const doc = await getDocument(document_id);

    if (!doc.ocr_result) {
      return NextResponse.json({ error: 'OCR has not been run on this document' }, { status: 400 });
    }

    if (doc.document_type === 'other') {
      return NextResponse.json({ error: 'Cannot parse documents of type "other"' }, { status: 400 });
    }

    // Get the appropriate parser
    const parser = getParser(doc.document_type as DocumentType);

    // Parse OCR result
    const parsedData = parser.parse(doc.ocr_result);

    // Save parsed data to document
    await updateParsedData(document_id, parsedData);

    // Merge into property JSON
    const propertyJson = await mergePropertyData(doc.property_id, parsedData);

    // Update status
    await updatePropertyStatus(doc.property_id, 'parsed');

    return NextResponse.json({
      success: true,
      parsed_fields: Object.keys(parsedData).length,
      parsed_data: parsedData,
      property_json: propertyJson,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
