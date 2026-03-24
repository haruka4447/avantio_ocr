import { NextRequest, NextResponse } from 'next/server';
import { getDocument, updateOcrResult, downloadFile } from '@/services/documentService';
import { updatePropertyStatus } from '@/services/propertyService';
import { hashPdf, getCachedOcr, setCachedOcr } from '@/services/ocrCache';
import { processDocument } from '@/ocr/documentai';
import { isTextPdf, extractTextFromPdf } from '@/utils/pdfTextExtractor';
import { preprocessDocument } from '@/ocr/preprocessor';
import type { OcrResult } from '@/models/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document_id } = body;

    if (!document_id) {
      return NextResponse.json({ error: 'document_id is required' }, { status: 400 });
    }

    const doc = await getDocument(document_id);
    await updatePropertyStatus(doc.property_id, 'ocr_processing');

    const fileBuffer = await downloadFile(doc.file_path);
    const pdfHash = hashPdf(fileBuffer);

    // キャッシュ確認
    const cached = await getCachedOcr(pdfHash);
    if (cached) {
      console.log(`[OCR] Cache HIT: ${pdfHash.slice(0, 8)}... (${doc.document_type})`);
      const ocrResult = cached.ocr_result as OcrResult;
      await updateOcrResult(document_id, 'completed', ocrResult);
      return NextResponse.json({
        success: true,
        method: 'cache',
        pages: ocrResult.pages?.length || 0,
        total_tokens: ocrResult.pages?.reduce((sum, p) => sum + p.tokens.length, 0) || 0,
        form_fields: ocrResult.formFields?.length || 0,
        tables: ocrResult.tables?.length || 0,
        form_parser_status: ocrResult.formParserMeta?.status || 'unknown',
      });
    }

    console.log(`[OCR] Cache MISS: ${pdfHash.slice(0, 8)}... (${doc.document_type})`);
    const isPdf = doc.file_name.toLowerCase().endsWith('.pdf');
    let ocrResult: OcrResult;
    let method = 'document_ai';

    if (isPdf && await isTextPdf(fileBuffer)) {
      const fullText = await extractTextFromPdf(fileBuffer);
      console.log(`[PDF] テキストPDF検出 - Document AI スキップ (docType: ${doc.document_type})`);
      method = 'text_pdf';
      ocrResult = {
        fullText,
        pages: [],
        formFields: [],
        tables: [],
        formParserMeta: { status: 'empty', formFieldCount: 0, tableCount: 0 },
        source: 'text_pdf',
      };
    } else if (isPdf) {
      ocrResult = await processDocument(fileBuffer, 'application/pdf');
    } else {
      const processedBuffer = await preprocessDocument(fileBuffer);
      ocrResult = await processDocument(processedBuffer, 'image/png');
    }

    await updateOcrResult(document_id, 'completed', ocrResult);

    // キャッシュに保存（失敗してもOCR処理は続行）
    const source = (ocrResult.source || method) as 'document_ai' | 'text_pdf';
    await setCachedOcr(pdfHash, doc.property_id, doc.document_type, ocrResult, source);

    return NextResponse.json({
      success: true,
      method,
      pages: ocrResult.pages.length,
      total_tokens: ocrResult.pages.reduce((sum, p) => sum + p.tokens.length, 0),
      form_fields: ocrResult.formFields?.length || 0,
      tables: ocrResult.tables?.length || 0,
      form_parser_status: ocrResult.formParserMeta?.status || 'unknown',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      const body = await request.clone().json();
      if (body.document_id) await updateOcrResult(body.document_id, 'failed', null);
    } catch {}
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
