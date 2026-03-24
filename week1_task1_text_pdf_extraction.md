# タスク1: テキストPDF直接抽出の実装

## 背景

登記簿謄本（土地・建物全部事項証明書）・意匠図・位置図はテキストレイヤーを持つPDFであり、
Document AI を呼ばずにテキスト抽出できる。
現状はスキャンPDFと同様に Document AI を呼んでいるため、コストと処理時間が無駄になっている。

**改善効果**: 対象書類のOCRコストゼロ・処理時間1/5以下

---

## 前提確認

作業開始前に以下を確認すること。

- `app/src/ocr/` 配下のファイル構成を把握する
- Document AI を呼び出している関数を特定する
- 現在のOCR結果の型定義（`app/src/models/types.ts`）を確認する

---

## 実装手順

### Step 1: pdfjs-dist のインストール

```bash
cd app
npm install pdfjs-dist
```

### Step 2: テキストPDF判定・抽出ユーティリティの作成

`app/src/utils/pdfTextExtractor.ts` を新規作成する。

```typescript
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf'

/**
 * PDFがテキストレイヤーを持つか判定する
 * 先頭3ページで100文字以上のテキストがあればテキストPDFと判断
 */
export async function isTextPdf(pdfBuffer: Buffer): Promise<boolean> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise
  let totalChars = 0
  for (let i = 1; i <= Math.min(3, doc.numPages); i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    totalChars += content.items.reduce((n, item) => n + (item as any).str.length, 0)
  }
  return totalChars > 100
}

/**
 * テキストPDFから全ページのテキストを抽出する
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise
  let fullText = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => (item as any).str).join(' ')
    fullText += pageText + '\n'
  }
  return fullText
}
```

### Step 3: OCRクライアントに分岐処理を追加

`app/src/ocr/` 配下の Document AI 呼び出し関数を修正する。
既存の処理関数に以下の分岐を追加すること。

```typescript
import { isTextPdf, extractTextFromPdf } from '@/utils/pdfTextExtractor'

export async function processDocument(pdfBuffer: Buffer, docType: string) {
  const textPdf = await isTextPdf(pdfBuffer)

  if (textPdf) {
    // Document AI を呼ばずに直接抽出
    const fullText = await extractTextFromPdf(pdfBuffer)
    console.log(`[PDF] テキストPDF検出 - Document AI スキップ (docType: ${docType})`)
    return {
      fullText,
      fields: [],   // テキストPDFにはフィールド抽出なし
      tables: [],
      pages: [],
      source: 'text_pdf' as const,
    }
  }

  // スキャンPDFのみ Document AI へ（既存処理をそのまま呼ぶ）
  return callDocumentAI(pdfBuffer)
}
```

> **注意**: `callDocumentAI` の関数名は既存コードに合わせること。
> 既存の返り値の型定義（`types.ts`）に `source` フィールドがなければ追加する。

### Step 4: 動作確認

```bash
cd app && npm run dev -- -p 3007
```

以下を確認すること。

- 登記簿謄本PDFをアップロードしてログに `テキストPDF検出` が出る
- GCPコンソールの Document AI リクエスト数が増えていない
- `/api/parse` のレスポンスで所在・地番・地積・所有者が正しく抽出されている

### Step 5: ビルド・lint確認

```bash
cd app
npm run lint
npm run build
```

エラーがないことを確認して完了。

---

## 注意事項

- `pdfjs-dist` はサーバーサイド（Node.js）専用。クライアントコンポーネントから直接呼ばないこと
- Next.js App Router では Server Component または API Route 内でのみ使用すること
- テキスト抽出結果は全角スペース・改行が多く含まれる。既存の `textNormalizer.ts` を通してからパースすること
