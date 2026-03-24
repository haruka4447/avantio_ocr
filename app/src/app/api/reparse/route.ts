import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getParser } from '@/parsers';
import { mergePropertyData, updatePropertyStatus, createProperty, getProperty, resetPropertyJson } from '@/services/propertyService';
import { updateParsedData } from '@/services/documentService';
import type { DocumentType, OcrResult } from '@/models/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { property_id } = body;

    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 });
    }

    // Verify property exists
    await getProperty(property_id);

    // Fetch all documents for the property
    const { data: documents, error } = await supabaseAdmin
      .from('re_documents')
      .select('*')
      .eq('property_id', property_id);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'No documents found for this property' }, { status: 404 });
    }

    let reparsedCount = 0;

    // Re-parse each eligible document
    for (const doc of documents) {
      if (!doc.ocr_result || doc.document_type === 'other') {
        continue;
      }

      const parser = getParser(doc.document_type as DocumentType);
      const parsedData = parser.parse(doc.ocr_result as OcrResult);

      // Update the document's parsed_data
      await updateParsedData(doc.id, parsedData);
      reparsedCount++;
    }

    // Clear existing property_json before re-merging to remove stale data
    await resetPropertyJson(property_id);

    // After all documents are re-parsed, merge all parsed data into the property JSON
    // Re-fetch documents to get updated parsed_data
    const { data: updatedDocs, error: refetchError } = await supabaseAdmin
      .from('re_documents')
      .select('*')
      .eq('property_id', property_id);

    if (refetchError) {
      throw new Error(`Failed to re-fetch documents: ${refetchError.message}`);
    }

    // Sort by document type priority: registry → contract → permit → others
    const DOC_TYPE_PRIORITY: Record<string, number> = {
      registry: 0, contract: 1, permit: 2, drawing: 3, hazard: 4,
    };
    const sortedDocs = (updatedDocs || []).sort((a, b) =>
      (DOC_TYPE_PRIORITY[a.document_type] ?? 9) - (DOC_TYPE_PRIORITY[b.document_type] ?? 9)
    );

    // Merge all parsed data sequentially (first-value-wins)
    let propertyJson;
    for (const doc of sortedDocs) {
      if (doc.parsed_data && doc.document_type !== 'other') {
        propertyJson = await mergePropertyData(property_id, doc.parsed_data as Record<string, string>);
      }
    }

    // Update status
    await updatePropertyStatus(property_id, 'parsed');

    // If no documents were merged, just get the current property JSON
    if (!propertyJson) {
      const property = await getProperty(property_id);
      propertyJson = property.property_json;
    }

    return NextResponse.json({
      success: true,
      reparsed_count: reparsedCount,
      property_json: propertyJson,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
