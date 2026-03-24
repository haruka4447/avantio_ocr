import { GoogleAuth } from 'google-auth-library';
import { request as undiciRequest } from 'undici';
import type {
  OcrResult, OcrPage, OcrBlock, OcrParagraph, OcrToken, BoundingBox,
  FormField, FormTable, TableCell, FormParserMeta,
} from '../models/types';

const projectId = process.env.GCP_PROJECT_ID!;
const location = process.env.DOCUMENT_AI_LOCATION || 'us';

/** モードに応じてプロセッサIDを切り替える */
function getProcessorId(): string {
  const mode = process.env.DOCUMENT_AI_MODE ?? 'form';
  const processorId = mode === 'ocr'
    ? process.env.DOCUMENT_AI_OCR_PROCESSOR_ID
    : process.env.DOCUMENT_AI_PROCESSOR_ID;

  if (!processorId) {
    throw new Error(`プロセッサIDが未設定です (DOCUMENT_AI_MODE=${mode})`);
  }
  return processorId;
}

function isOcrMode(): boolean {
  return (process.env.DOCUMENT_AI_MODE ?? 'form') === 'ocr';
}

let authClient: Awaited<ReturnType<GoogleAuth['getClient']>> | null = null;
async function getAccessToken(): Promise<string> {
  if (!authClient) {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    authClient = await auth.getClient();
  }
  return (await authClient.getAccessToken()).token || '';
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractBBox(vertices: Array<{ x?: number | null; y?: number | null }> | null | undefined): BoundingBox {
  if (!vertices || vertices.length < 4) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = vertices.map(v => v.x || 0);
  const ys = vertices.map(v => v.y || 0);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function normVerts(vertices: any, w: number, h: number): Array<{ x: number; y: number }> {
  if (!vertices) return [];
  return Array.from(vertices).map((v: any) => ({ x: (v.x || 0) * w, y: (v.y || 0) * h }));
}

function getText(fullText: string, textAnchor: any): string {
  if (!textAnchor?.textSegments) return '';
  const segs = Array.isArray(textAnchor.textSegments)
    ? textAnchor.textSegments
    : Array.from(textAnchor.textSegments);
  return segs
    .map((seg: any) => fullText.substring(Number(seg.startIndex || 0), Number(seg.endIndex || 0)))
    .join('').trim();
}

function isIn(inner: BoundingBox, outer: BoundingBox): boolean {
  const cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
  return cx >= outer.x && cx <= outer.x + outer.width && cy >= outer.y && cy <= outer.y + outer.height;
}

/**
 * Process document via REST API (undici) to get all data in a single call:
 * - OCR tokens, paragraphs, blocks
 * - Form Parser formFields + tables
 *
 * Previously used gRPC + REST dual calls; unified to REST-only for efficiency.
 * undici is used because Next.js patched fetch drops formFields/tables from the response.
 */
export async function processDocument(fileBuffer: Buffer, mimeType: string = 'application/pdf'): Promise<OcrResult> {
  const token = await getAccessToken();
  const processorId = getProcessorId();
  const mode = process.env.DOCUMENT_AI_MODE ?? 'form';
  const url = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

  const { statusCode, body } = await undiciRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: { content: fileBuffer.toString('base64'), mimeType },
      processOptions: {
        ocrConfig: {
          enableNativePdfParsing: true,
          hints: { languageHints: ['ja'] },
        },
      },
    }),
  });

  if (statusCode !== 200) {
    const errText = await body.text();
    throw new Error(`Document AI API error: ${statusCode} ${errText.substring(0, 300)}`);
  }

  const responseText = await body.text();
  const data = JSON.parse(responseText);
  const doc = data.document;
  if (!doc) throw new Error('Document AI returned no document');

  // Debug: log what the API actually returned for form parsing
  const page0 = doc.pages?.[0];
  console.log(`[DocumentAI] Processor: ${processorId} (mode=${mode})`);
  console.log(`[DocumentAI] Response keys: ${Object.keys(doc).join(', ')}`);
  console.log(`[DocumentAI] Page 0 keys: ${page0 ? Object.keys(page0).join(', ') : 'N/A'}`);
  console.log(`[DocumentAI] Page 0 formFields count: ${page0?.formFields?.length ?? 'undefined'}`);
  console.log(`[DocumentAI] Page 0 tables count: ${page0?.tables?.length ?? 'undefined'}`);

  const fullText = doc.text || '';
  const pages: OcrPage[] = [];
  const formFields: FormField[] = [];
  const tables: FormTable[] = [];

  for (const page of doc.pages || []) {
    const pn = page.pageNumber || 1;
    const pw = page.dimension?.width || 1;
    const ph = page.dimension?.height || 1;

    // --- Tokens ---
    const tokens: OcrToken[] = [];
    for (const t of page.tokens || []) {
      if (!t.layout) continue;
      tokens.push({
        text: getText(fullText, t.layout.textAnchor),
        boundingBox: extractBBox(normVerts(t.layout.boundingPoly?.normalizedVertices, pw, ph)),
        confidence: t.layout.confidence || 0,
      });
    }

    // --- Paragraphs ---
    const paragraphs: OcrParagraph[] = [];
    for (const para of page.paragraphs || []) {
      if (!para.layout) continue;
      const bb = extractBBox(normVerts(para.layout.boundingPoly?.normalizedVertices, pw, ph));
      paragraphs.push({ text: getText(fullText, para.layout.textAnchor), boundingBox: bb, tokens: tokens.filter(t => isIn(t.boundingBox, bb)) });
    }

    // --- Blocks ---
    const blocks: OcrBlock[] = [];
    for (const block of page.blocks || []) {
      if (!block.layout) continue;
      const bb = extractBBox(normVerts(block.layout.boundingPoly?.normalizedVertices, pw, ph));
      blocks.push({ text: getText(fullText, block.layout.textAnchor), boundingBox: bb, paragraphs: paragraphs.filter(p => isIn(p.boundingBox, bb)) });
    }

    pages.push({ pageNumber: pn, width: pw, height: ph, text: tokens.map(t => t.text).join(''), blocks, paragraphs, tokens });

    // --- FormFields / Tables (Form Parserモードのみ) ---
    if (!isOcrMode()) {
      for (const ff of page.formFields || []) {
        const fieldName = getText(fullText, ff.fieldName?.textAnchor);
        const fieldValue = getText(fullText, ff.fieldValue?.textAnchor);
        const confidence = ff.fieldName?.confidence || ff.fieldValue?.confidence || 0;
        let boundingBox: BoundingBox | undefined;
        if (ff.fieldValue?.boundingPoly?.normalizedVertices?.length >= 4) {
          boundingBox = extractBBox(normVerts(ff.fieldValue.boundingPoly.normalizedVertices, pw, ph));
        }
        if (fieldName || fieldValue) formFields.push({ fieldName, fieldValue, confidence, boundingBox });
      }

      for (const table of page.tables || []) {
        const headerRows: TableCell[][] = (table.headerRows || []).map((hr: any) =>
          (hr.cells || []).map((c: any, ci: number) => ({
            text: getText(fullText, c.layout?.textAnchor), rowIndex: 0, colIndex: ci, rowSpan: c.rowSpan || 1, colSpan: c.colSpan || 1,
          }))
        );
        const bodyRows: TableCell[][] = (table.bodyRows || []).map((br: any, ri: number) =>
          (br.cells || []).map((c: any, ci: number) => ({
            text: getText(fullText, c.layout?.textAnchor), rowIndex: ri, colIndex: ci, rowSpan: c.rowSpan || 1, colSpan: c.colSpan || 1,
          }))
        );
        if (headerRows.length > 0 || bodyRows.length > 0) {
          tables.push({ headerRows, bodyRows, pageNumber: page.pageNumber || 1 });
        }
      }
    }
  }

  const formParserMeta: FormParserMeta = {
    status: formFields.length > 0 || tables.length > 0 ? 'success' : 'empty',
    formFieldCount: formFields.length,
    tableCount: tables.length,
  };

  console.log(`[DocumentAI] Processed: ${pages.length} pages, ${formFields.length} formFields, ${tables.length} tables`);

  return { pages, fullText, formFields, tables, formParserMeta };
}
