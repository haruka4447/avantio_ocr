# Avantio OCR - System Architecture

## FigJam Diagrams

- [System Architecture](https://www.figma.com/online-whiteboard/create-diagram/a93a990e-8df2-49a6-97c6-964277a7ef29?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=8531a051-238f-4ae5-92de-71f8fa2d7fac)
- [Processing Pipeline](https://www.figma.com/online-whiteboard/create-diagram/c7d2166f-4aae-4863-9c85-2b1ccfe308b2?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=4ed30651-02ce-4e8d-85fe-f11c69fd61d0)
- [Text Normalization Flow](https://www.figma.com/online-whiteboard/create-diagram/751307ad-d0a4-44ea-9535-77dfeddc9e6c?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=6e1311d1-f08e-41ce-80db-df92b4e4f3ad)

---

## 1. Overview

不動産書類（登記簿謄本・売買契約書・確認申請書・ハザードマップ・建築図面）をOCR処理し、
構造化データ（PropertyJSON）に変換してExcel帳票を生成するシステム。

```
[File Upload] → [OCR Engine] → [Parse Engine] → [PropertyJSON] → [Excel Generator]
                     ↕                ↕                ↕
              [Document AI]   [Layout Templates]  [Supabase DB]
```

---

## 2. Tech Stack

| Layer        | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Next.js 16 (App Router)             |
| Backend     | Next.js API Routes (Route Handlers) |
| OCR         | Google Document AI (REST API)       |
| HTTP Client | undici (bypasses Next.js patched fetch) |
| Image Proc  | sharp                               |
| PDF Parse   | pdf-parse                           |
| Database    | Supabase (PostgreSQL)               |
| Storage     | Supabase Storage                    |
| Excel       | ExcelJS                             |
| Language    | TypeScript                          |

---

## 3. Directory Structure

```
app/src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── ocr/route.ts          # OCR API endpoint
│   │   ├── parse/route.ts        # Parse API endpoint
│   │   ├── generate/route.ts     # Excel generation endpoint
│   │   ├── upload/route.ts       # File upload endpoint
│   │   ├── ocr-all/route.ts      # Batch OCR endpoint
│   │   └── reparse/route.ts      # Batch re-parse endpoint
│   ├── documents/[id]/page.tsx
│   └── properties/[id]/page.tsx
│
├── ocr/                          # OCR Engine
│   ├── documentai.ts             # Document AI REST API (unified)
│   ├── pdfExtractor.ts           # Digital PDF text layer detection
│   └── preprocessor.ts           # Image DPI check (sharp)
│
├── parsers/                      # Parse Engine
│   ├── base.ts                   # BaseParser (4-strategy cascade)
│   ├── textExtractor.ts          # Strategy 1: Regex patterns
│   ├── registryParser.ts         # 登記簿謄本 parser
│   ├── contractParser.ts         # 売買契約書 parser
│   ├── drawingParser.ts          # 建築図面 parser
│   ├── hazardParser.ts           # ハザードマップ parser
│   └── permitParser.ts           # 確認申請書 parser
│
├── layout/                       # Strategy 4: Layout Template Engine
│   └── engine.ts                 # Spatial keyword→direction extraction
│
├── utils/                        # Shared Utilities
│   └── textNormalizer.ts         # Japanese text normalization + fuzzy match
│
├── models/
│   └── types.ts                  # All TypeScript interfaces
│
├── services/
│   ├── documentService.ts        # Document CRUD (Supabase)
│   └── propertyService.ts        # Property CRUD + merge logic
│
├── excel/
│   └── generator.ts              # Excel template fill + checkbox mapping
│
└── lib/
    └── supabase.ts               # Supabase client

layoutTemplates/                  # Layout Template definitions (JSON)
├── registry.json                 # 登記簿 (50+ fields)
├── contract.json                 # 契約書 (95 fields)
├── drawing.json                  # 建築図面 (7 fields)
├── hazard.json                   # ハザード (4 fields)
└── permit.json                   # 確認申請 (5 fields)
```

---

## 4. Processing Pipeline

### 4.1 OCR Phase (`/api/ocr`)

```
Input: document_id
  │
  ├─ Download file from Supabase Storage
  │
  ├─ PDF? ──Yes──→ PDF Extractor: isDigital?
  │    │              ├─ Digital → extract text layer + Document AI
  │    │              └─ Scanned → Document AI only
  │    │
  │    No
  │    └─ Preprocessor (DPI check via sharp) → Document AI
  │
  ├─ Document AI REST API (single call, undici)
  │   Returns: tokens, paragraphs, blocks, formFields, tables
  │
  ├─ Build OcrResult + FormParserMeta
  │   FormParserMeta.status: 'success' | 'error' | 'empty'
  │
  └─ Save to Supabase → document.ocr_result
```

### 4.2 Parse Phase (`/api/parse`)

```
Input: document_id (with ocr_result already saved)
  │
  ├─ Select parser by document_type:
  │   registry → RegistryParser
  │   contract → ContractParser
  │   drawing  → DrawingParser
  │   hazard   → HazardParser
  │   permit   → PermitParser
  │
  ├─ BaseParser.parse(ocrResult):
  │   │
  │   │  ┌──────────────────────────────────────────────┐
  │   │  │  4-Strategy Cascade (low → high priority)    │
  │   │  │                                              │
  │   │  │  4. Layout Engine (spatial keyword search)   │
  │   │  │     - If FormParser error: maxDistance x1.5   │
  │   │  │                                              │
  │   │  │  3. Tables (header/cell keyword match)       │
  │   │  │                                              │
  │   │  │  2. FormFields (keyword → value pairs)       │
  │   │  │     - Direct match → fuzzy match fallback    │
  │   │  │     - Skipped if FormParser status='error'   │
  │   │  │                                              │
  │   │  │  1. Text Regex (highest priority)            │
  │   │  │     - Try original text first                │
  │   │  │     - Fall back to normalized text           │
  │   │  └──────────────────────────────────────────────┘
  │   │
  │   └─ Merge: { ...layout, ...tables, ...formFields, ...text }
  │
  ├─ PostProcess (document-type-specific normalization)
  │   - Areas → "XXX.XX㎡"
  │   - Prices → "X,XXX,XXX円"
  │   - Dates → trimmed
  │   - Shares → "X/Y" format
  │
  └─ Save to PropertyJSON → Supabase
```

---

## 5. Key Design Decisions

### 5.1 REST API Unified (gRPC廃止)

**Before**: gRPC (tokens) + REST API (formFields/tables) の二重呼び出し
**After**: REST API (undici) 一本化。1回のAPIコールで全データ取得

**理由**:
- Next.js の patched fetch が formFields/tables を落とすため undici を使用
- gRPC SDK も同じ Document AI プロセッサを叩くため、REST一本で同じ結果が取れる
- APIコスト半減、レイテンシ改善

### 5.2 FormParserMeta

`OcrResult.formParserMeta` でREST APIの成功/失敗をパース層に伝播。

| status    | 意味                          | パース層の挙動                       |
|-----------|-------------------------------|--------------------------------------|
| `success` | formFields/tables取得成功     | 通常のパース                         |
| `empty`   | APIは成功したがデータなし     | 通常のパース（Layout Engineで補完）  |
| `error`   | API呼び出し自体が失敗         | FormFields skip + Layout Engine拡大探索 |

### 5.3 Normalization Strategy

3箇所に分散していた正規化ロジックを `textNormalizer.ts` に統合:

| 関数 | 用途 | 使用箇所 |
|------|------|----------|
| `normalizeJapanese()` | キーワードマッチ用（全角→半角、スペース除去、記号統一） | base.ts, engine.ts |
| `normalizeFullText()` | 正規表現マッチ用（改行→スペース、連続スペース圧縮） | textExtractor.ts |
| `fuzzyMatch()` | 表記揺れ対応（Levenshtein距離 ≤ 30%） | base.ts (FormFields) |
| `levenshteinDistance()` | 編集距離計算 | fuzzyMatch内部 |

### 5.4 Layout Template Engine

OCRトークンの座標情報を使った空間的なフィールド抽出:

```json
{
  "property.address": {
    "keyword": "所在",
    "direction": "right",
    "maxDistance": 200,
    "alternateKeywords": ["土地の所在", "所　在"]
  }
}
```

**キーワード検索の優先順位**:
1. 完全一致（単一トークン）
2. 正規化一致（スペース/全角無視）
3. 隣接トークン結合（2-3トークン）

---

## 6. Data Flow

```
                    ┌─────────────┐
                    │  Supabase   │
                    │  Storage    │
                    └──────┬──────┘
                           │ file download
                           ▼
┌──────────┐    ┌─────────────────┐    ┌──────────────┐
│  Upload  │───→│   OCR Engine    │───→│  OcrResult   │
│  (file)  │    │  (Document AI)  │    │  + Meta      │
└──────────┘    └─────────────────┘    └──────┬───────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │  Parse Engine    │
                                     │  (4 strategies)  │
                                     └──────┬──────────┘
                                            │
                                            ▼
                                    ┌───────────────┐
                                    │ PropertyJSON  │
                                    └───┬───────┬───┘
                                        │       │
                                        ▼       ▼
                                ┌────────┐  ┌────────┐
                                │Supabase│  │  Excel  │
                                │  DB    │  │ Output  │
                                └────────┘  └────────┘
```

---

## 7. Document Types

| Type | Japanese | Parser | Template Fields | Text Patterns |
|------|----------|--------|-----------------|---------------|
| `registry` | 登記簿謄本 | RegistryParser | 50+ | 12 |
| `contract` | 売買契約書 | ContractParser | 95 | 9 |
| `drawing` | 建築図面 | DrawingParser | 7 | - |
| `hazard` | ハザードマップ | HazardParser | 4 | - |
| `permit` | 確認申請書 | PermitParser | 5 | 5 |

---

## 8. Error Handling

| Layer | Error | Handling |
|-------|-------|----------|
| Document AI API | HTTP error | Throw → catch in route → status='failed' |
| Document AI API | No document in response | Throw |
| Form Parser | Empty formFields/tables | `FormParserMeta.status='empty'` → Layout Engine補完 |
| Parse | Field not found | Skip (partial result is acceptable) |
| OCR Route | Any exception | Update document status to 'failed', return 500 |
| Parse Route | Any exception | Return 500 (no status rollback) |
