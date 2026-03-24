# タスク2: OCRキャッシュの実装

## 背景

同一のPDFファイルを再アップロードするたびに Document AI を呼び出しており、
再処理・差し替えアップのたびにOCRコストが発生している。
PDFのSHA-256ハッシュをキーにSupabaseへ結果をキャッシュすることで、2回目以降のコストをゼロにする。

**改善効果**: 再処理時のOCR費用ゼロ・処理時間大幅短縮

---

## 前提確認

作業開始前に以下を確認すること。

- `app/src/services/` 配下の既存サービスファイルの命名規則を確認する
- Supabase クライアントの生成方法（`app/src/lib/supabase/` 配下）を確認する
- `properties` テーブルのスキーマを確認する（外部キー制約のため）

---

## 実装手順

### Step 1: Supabase にキャッシュテーブルを作成

Supabase ダッシュボード → SQL Editor で以下を実行する。

```sql
create table ocr_cache (
  id          uuid primary key default gen_random_uuid(),
  pdf_hash    text unique not null,
  property_id uuid references properties(id) on delete cascade,
  doc_type    text not null,
  ocr_result  jsonb not null,
  source      text not null default 'document_ai', -- 'document_ai' | 'text_pdf'
  created_at  timestamptz default now()
);

create index ocr_cache_hash_idx on ocr_cache(pdf_hash);
create index ocr_cache_property_idx on ocr_cache(property_id);
```

### Step 2: キャッシュサービスの作成

`app/src/services/ocrCache.ts` を新規作成する。

```typescript
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server' // 既存のサーバークライアントに合わせること

/**
 * PDFバッファのSHA-256ハッシュを生成する
 * ファイル名ではなく内容で一意性を保証する
 */
export function hashPdf(pdfBuffer: Buffer): string {
  return createHash('sha256').update(pdfBuffer).digest('hex')
}

/**
 * キャッシュからOCR結果を取得する
 * ヒットしなければ null を返す
 */
export async function getCachedOcr(pdfHash: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('ocr_cache')
    .select('ocr_result, source')
    .eq('pdf_hash', pdfHash)
    .single()
  return data ?? null
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
  const supabase = createClient()
  const { error } = await supabase.from('ocr_cache').upsert(
    {
      pdf_hash: pdfHash,
      property_id: propertyId,
      doc_type: docType,
      ocr_result: ocrResult,
      source,
    },
    { onConflict: 'pdf_hash' }
  )
  if (error) {
    console.error('[OCR Cache] 保存失敗:', error.message)
  }
}
```

### Step 3: OCR処理へのキャッシュ組み込み

タスク1で修正した OCR 処理関数（`app/src/ocr/` 配下）をさらに修正し、
キャッシュ参照・保存を追加する。

```typescript
import { hashPdf, getCachedOcr, setCachedOcr } from '@/services/ocrCache'

export async function processDocumentWithCache(
  pdfBuffer: Buffer,
  propertyId: string,
  docType: string
) {
  const hash = hashPdf(pdfBuffer)

  // キャッシュ確認
  const cached = await getCachedOcr(hash)
  if (cached) {
    console.log(`[OCR] Cache HIT: ${hash.slice(0, 8)}... (${docType})`)
    return cached.ocr_result
  }

  // キャッシュなし → 実処理（タスク1のprocessDocumentを呼ぶ）
  console.log(`[OCR] Cache MISS: ${hash.slice(0, 8)}... (${docType})`)
  const result = await processDocument(pdfBuffer, docType)

  // 結果を保存（失敗してもOCR処理は続行する）
  await setCachedOcr(hash, propertyId, docType, result, result.source)

  return result
}
```

> **注意**: `/api/ocr` および `/api/ocr-all` のエンドポイントで
> `processDocument` を呼んでいる箇所を `processDocumentWithCache` に置き換えること。
> `propertyId` が取得できる前提で実装すること（ルートパラメータまたはリクエストボディから取得）。

### Step 4: 動作確認

```bash
cd app && npm run dev -- -p 3007
```

以下を確認すること。

- 同一PDFを2回アップロードして、2回目のログに `Cache HIT` が出る
- Supabase の `ocr_cache` テーブルにレコードが作成されている
- キャッシュヒット時も `/api/parse` が正常に動作する

### Step 5: ビルド・lint確認

```bash
cd app
npm run lint
npm run build
```

エラーがないことを確認して完了。

---

## 注意事項

- キャッシュキーはファイル名ではなくPDF内容のハッシュ値。ファイル名が変わっても同一内容ならキャッシュが使われる
- `setCachedOcr` の失敗はログに出すだけでエラーをthrowしないこと。キャッシュ保存の失敗でOCR処理全体が止まるのを防ぐため
- キャッシュの有効期限は現時点では設定しない。法改正等でテンプレートが変わった場合は `ocr_cache` テーブルを手動でクリアする運用とする
