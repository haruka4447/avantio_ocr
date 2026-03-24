import { NextRequest, NextResponse } from 'next/server';
import { listDocuments } from '@/services/documentService';

export async function GET(request: NextRequest) {
  try {
    const propertyId = request.nextUrl.searchParams.get('property_id');
    if (!propertyId) {
      return NextResponse.json({ error: 'property_id query parameter is required' }, { status: 400 });
    }
    const documents = await listDocuments(propertyId);
    return NextResponse.json(documents);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
