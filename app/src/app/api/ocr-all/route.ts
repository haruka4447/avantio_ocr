import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getProperty, updatePropertyStatus } from '@/services/propertyService';
import { downloadFile, updateOcrResult } from '@/services/documentService';
import { hashPdf, getCachedOcr, setCachedOcr } from '@/services/ocrCache';
import { processDocument } from '@/ocr/documentai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { property_id } = body;

    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 });
    }

    await getProperty(property_id);
    await updatePropertyStatus(property_id, 'ocr_processing');

    const { data: documents, error } = await supabaseAdmin
      .from('re_documents')
      .select('*')
      .eq('property_id', property_id);

    if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'No documents found' }, { status: 404 });
    }

    let processedCount = 0;
    let failedCount = 0;

    for (const doc of documents) {
      try {
        const fileBuffer = await downloadFile(doc.file_path);
        const pdfHash = hashPdf(fileBuffer);

        // キャッシュ確認
        const cached = await getCachedOcr(pdfHash);
        if (cached) {
          console.log(`[OCR] Cache HIT: ${pdfHash.slice(0, 8)}... (${doc.document_type})`);
          await updateOcrResult(doc.id, 'completed', cached.ocr_result);
          processedCount++;
          continue;
        }

        console.log(`[OCR] Cache MISS: ${pdfHash.slice(0, 8)}... (${doc.document_type})`);
        const mimeType = doc.file_name.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'image/png';

        const ocrResult = await processDocument(fileBuffer, mimeType);
        await updateOcrResult(doc.id, 'completed', ocrResult);

        // キャッシュに保存（失敗してもOCR処理は続行）
        const source = (ocrResult.source || 'document_ai') as 'document_ai' | 'text_pdf';
        await setCachedOcr(pdfHash, property_id, doc.document_type, ocrResult, source);
        processedCount++;
      } catch {
        await updateOcrResult(doc.id, 'failed', null);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      total: documents.length,
      processed: processedCount,
      failed: failedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
