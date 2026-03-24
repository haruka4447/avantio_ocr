import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * PDFバッファのSHA-256ハッシュを生成する
 * ファイル名ではなく内容で一意性を保証する
 */
export function hashPdf(pdfBuffer: Buffer): string {
  return createHash('sha256').update(pdfBuffer).digest('hex');
}

/**
 * キャッシュからOCR結果を取得する
 * ヒットしなければ null を返す
 */
export async function getCachedOcr(pdfHash: string) {
  const { data } = await supabaseAdmin
    .from('ocr_cache')
    .select('ocr_result, source')
    .eq('pdf_hash', pdfHash)
    .single();
  return data ?? null;
}

/**
 * OCR結果をキャッシュに保存する
 * 同一ハッシュが存在する場合は上書き（upsert）する
 */
export async function setCachedOcr(
  pdfHash: string,
  propertyId: string,
  docType: string,
  ocrResult: unknown,
  source: 'document_ai' | 'text_pdf'
) {
  const { error } = await supabaseAdmin.from('ocr_cache').upsert(
    {
      pdf_hash: pdfHash,
      property_id: propertyId,
      doc_type: docType,
      ocr_result: ocrResult,
      source,
    },
    { onConflict: 'pdf_hash' }
  );
  if (error) {
    console.error('[OCR Cache] 保存失敗:', error.message);
  }
}
