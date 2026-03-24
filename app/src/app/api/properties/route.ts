import { NextRequest, NextResponse } from 'next/server';
import { createProperty, listProperties } from '@/services/propertyService';

export async function GET() {
  try {
    const properties = await listProperties();
    return NextResponse.json(properties);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const id = await createProperty();
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
