import { NextRequest, NextResponse } from 'next/server';
import { getDocument, updateDocumentType } from '@/services/documentService';
import type { DocumentType } from '@/models/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await getDocument(id);
    return NextResponse.json(document);
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
    const { document_type } = body as { document_type: DocumentType };

    const validTypes: DocumentType[] = ['registry', 'contract', 'drawing', 'hazard', 'permit', 'other'];
    if (!document_type || !validTypes.includes(document_type)) {
      return NextResponse.json(
        { error: `Invalid document_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    await updateDocumentType(id, document_type);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
