import { NextRequest, NextResponse } from 'next/server';
import { createDocument, uploadFile } from '@/services/documentService';
import type { DocumentType } from '@/models/types';

const CLASSIFICATION_RULES: { keywords: string[]; type: DocumentType }[] = [
  { keywords: ['登記', '謄本', '全部事項'], type: 'registry' },
  { keywords: ['売買契約', '契約書'], type: 'contract' },
  { keywords: ['図面', '意匠図', '配置図', '平面図', '立面図', '位置図', '地図'], type: 'drawing' },
  { keywords: ['ハザード', '洪水', '浸水', '内水', '津波', '土砂'], type: 'hazard' },
  { keywords: ['確認済証', '確認申請', '検査合格証', '検査済証', '建築確認'], type: 'permit' },
];

function classifyByFileName(fileName: string): DocumentType {
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.keywords.some(kw => fileName.includes(kw))) {
      return rule.type;
    }
  }
  return 'other';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const propertyId = formData.get('property_id') as string | null;

    if (!propertyId || files.length === 0) {
      return NextResponse.json(
        { error: 'property_id and at least one file are required' },
        { status: 400 }
      );
    }

    const results = [];
    for (const file of files) {
      const docType = classifyByFileName(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = await uploadFile(propertyId, docType, file.name, buffer, file.type);
      const documentId = await createDocument(propertyId, docType, file.name, filePath);
      results.push({
        document_id: documentId,
        file_path: filePath,
        file_name: file.name,
        document_type: docType,
      });
    }

    return NextResponse.json({ uploaded: results }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
