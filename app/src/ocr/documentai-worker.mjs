/**
 * Document AI worker using REST API directly (not gRPC).
 * Usage: node documentai-worker.mjs <processorName> <mimeType> <inputFile> <outputFile>
 */
import { readFileSync, writeFileSync } from 'fs';
import { GoogleAuth } from 'google-auth-library';

const processorName = process.argv[2];
const mimeType = process.argv[3] || 'application/pdf';
const inputFile = process.argv[4];
const outputFile = process.argv[5];

if (!processorName || !inputFile || !outputFile) {
  console.error('Usage: node documentai-worker.mjs <processorName> <mimeType> <inputFile> <outputFile>');
  process.exit(1);
}

const base64Content = readFileSync(inputFile, 'utf-8').trim();

// Get access token
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const client = await auth.getClient();
const tokenRes = await client.getAccessToken();
const token = tokenRes.token;

// Extract project/location/processor from processor name
// format: projects/{project}/locations/{location}/processors/{processor}
const parts = processorName.split('/');
const project = parts[1];
const location = parts[3];
const processor = parts[5];

const url = `https://${location}-documentai.googleapis.com/v1/projects/${project}/locations/${location}/processors/${processor}:process`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    rawDocument: { content: base64Content, mimeType },
  }),
});

if (!res.ok) {
  const errText = await res.text();
  console.error(`API error: ${res.status} ${errText.substring(0, 300)}`);
  process.exit(1);
}

const data = await res.json();
const doc = data.document;
if (!doc) {
  console.error('No document returned');
  process.exit(1);
}

const fullText = doc.text || '';

function extractText(textAnchor) {
  if (!textAnchor?.textSegments) return '';
  return textAnchor.textSegments
    .map(seg => fullText.substring(Number(seg.startIndex || 0), Number(seg.endIndex || 0)))
    .join('').trim();
}

const output = { text: fullText, pages: [] };

for (const page of doc.pages || []) {
  const pageData = {
    pageNumber: page.pageNumber || 1,
    dimension: { width: page.dimension?.width || 1, height: page.dimension?.height || 1 },
    tokens: [], paragraphs: [], blocks: [], formFields: [], tables: [],
  };

  for (const t of page.tokens || []) {
    if (!t.layout) continue;
    pageData.tokens.push({
      text: extractText(t.layout.textAnchor),
      confidence: t.layout.confidence || 0,
      normalizedVertices: t.layout.boundingPoly?.normalizedVertices?.map(v => ({ x: v.x || 0, y: v.y || 0 })) || [],
    });
  }

  for (const p of page.paragraphs || []) {
    if (!p.layout) continue;
    pageData.paragraphs.push({
      text: extractText(p.layout.textAnchor),
      confidence: p.layout.confidence || 0,
      normalizedVertices: p.layout.boundingPoly?.normalizedVertices?.map(v => ({ x: v.x || 0, y: v.y || 0 })) || [],
    });
  }

  for (const b of page.blocks || []) {
    if (!b.layout) continue;
    pageData.blocks.push({
      text: extractText(b.layout.textAnchor),
      confidence: b.layout.confidence || 0,
      normalizedVertices: b.layout.boundingPoly?.normalizedVertices?.map(v => ({ x: v.x || 0, y: v.y || 0 })) || [],
    });
  }

  for (const ff of page.formFields || []) {
    pageData.formFields.push({
      fieldName: extractText(ff.fieldName?.textAnchor),
      fieldValue: extractText(ff.fieldValue?.textAnchor),
      confidence: ff.fieldName?.confidence || ff.fieldValue?.confidence || 0,
      valueVertices: ff.fieldValue?.boundingPoly?.normalizedVertices?.map(v => ({ x: v.x || 0, y: v.y || 0 })) || [],
    });
  }

  for (const table of page.tables || []) {
    const headerRows = (table.headerRows || []).map(hr =>
      (hr.cells || []).map(c => ({ text: extractText(c.layout?.textAnchor), rowSpan: c.rowSpan || 1, colSpan: c.colSpan || 1 }))
    );
    const bodyRows = (table.bodyRows || []).map(br =>
      (br.cells || []).map(c => ({ text: extractText(c.layout?.textAnchor), rowSpan: c.rowSpan || 1, colSpan: c.colSpan || 1 }))
    );
    pageData.tables.push({ headerRows, bodyRows });
  }

  output.pages.push(pageData);
}

writeFileSync(outputFile, JSON.stringify(output));
console.log('OK');
