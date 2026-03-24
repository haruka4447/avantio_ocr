import { supabaseAdmin } from '../lib/supabase';
import type { DocumentRecord, DocumentType, OcrResult } from '../models/types';

/**
 * Create a document record.
 */
export async function createDocument(
  propertyId: string,
  documentType: DocumentType,
  fileName: string,
  filePath: string
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('re_documents')
    .insert({
      property_id: propertyId,
      document_type: documentType,
      file_name: fileName,
      file_path: filePath,
      ocr_status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create document: ${error.message}`);
  return data.id;
}

/**
 * Get a document by ID.
 */
export async function getDocument(id: string): Promise<DocumentRecord> {
  const { data, error } = await supabaseAdmin
    .from('re_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Failed to get document: ${error.message}`);
  return data as DocumentRecord;
}

/**
 * List documents for a property.
 */
export async function listDocuments(propertyId: string): Promise<DocumentRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('re_documents')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list documents: ${error.message}`);
  return (data || []) as DocumentRecord[];
}

/**
 * Update OCR status and result.
 */
export async function updateOcrResult(
  documentId: string,
  ocrStatus: 'completed' | 'failed',
  ocrResult: OcrResult | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('re_documents')
    .update({
      ocr_status: ocrStatus,
      ocr_result: ocrResult,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (error) throw new Error(`Failed to update OCR result: ${error.message}`);
}

/**
 * Update parsed data.
 */
export async function updateParsedData(
  documentId: string,
  parsedData: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('re_documents')
    .update({
      parsed_data: parsedData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (error) throw new Error(`Failed to update parsed data: ${error.message}`);
}

/**
 * Update document type.
 */
export async function updateDocumentType(
  documentId: string,
  documentType: DocumentType
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('re_documents')
    .update({
      document_type: documentType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (error) throw new Error(`Failed to update document type: ${error.message}`);
}

/**
 * Upload file to Supabase Storage.
 */
export async function uploadFile(
  propertyId: string,
  documentType: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext.toLowerCase()}`;
  const filePath = `${propertyId}/${documentType}_${safeName}`;

  const { error } = await supabaseAdmin
    .storage
    .from('documents')
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Failed to upload file: ${error.message}`);
  return filePath;
}

/**
 * Download file from Supabase Storage.
 */
export async function downloadFile(filePath: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin
    .storage
    .from('documents')
    .download(filePath);

  if (error) throw new Error(`Failed to download file: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Delete a document record and its file.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const doc = await getDocument(documentId);

  // Delete file from storage
  await supabaseAdmin.storage.from('documents').remove([doc.file_path]);

  // Delete record
  const { error } = await supabaseAdmin
    .from('re_documents')
    .delete()
    .eq('id', documentId);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}
