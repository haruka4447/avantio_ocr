# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Avantio OCR — 日本の不動産書類（登記簿謄本、売買契約書、建築図面、ハザードマップ、確認申請書）からOCRで構造化データを抽出し、重要事項説明書（Excel）を自動生成するシステム。

## Commands

```bash
cd app
npm run dev -- -p 3007   # 開発サーバー（ポート3007）
npm run build             # プロダクションビルド
npm run start             # プロダクションサーバー起動
npm run lint              # ESLint
```

## Tech Stack

- **Framework:** Next.js 16 (App Router) / React 19 / TypeScript 5
- **UI:** Tailwind CSS 4
- **OCR:** Google Cloud Document AI (REST API via undici)
- **DB:** Supabase (PostgreSQL) + Supabase Storage
- **Excel:** ExcelJS
- **LLM:** Gemini 2.5 Flash（フォールバック専用）

## Architecture

### 処理パイプライン

```
ファイルアップロード → ファイル名による書類分類 → Document AI OCR →
4段階パース（Strategy Cascade） → PropertyJson生成 → Excel出力
```

### 4段階パース戦略（優先度順）

1. **Text Regex** — fullTextに対する正規表現（最も信頼性が高い）
2. **FormParser Key-Value** — Document AIの抽出フィールド + ファジーマッチング
3. **FormParser Tables** — テーブルヘッダー/セルのキーワードマッチング
4. **Layout Template Engine** — 空間的キーワード検索（方向ベクトル）、FormParser失敗時は検索半径1.5倍

高優先度の結果が低優先度を上書きするマージロジック。

### データモデル

**PropertyJson**（JSONB、単一の情報源）: property, building, ownership[], mortgage[], contract, hazard, zoning, road, infrastructure, disaster_zone, loan, building_inspection, attachments

型定義は `app/src/models/types.ts` に集約（400行超）。

### 主要ディレクトリ

- `app/src/ocr/` — Document AI REST クライアント（undici使用）、PDF抽出、画像前処理
- `app/src/parsers/` — 書類種別ごとのパーサー。`base.ts`に4段階カスケードロジック
- `app/src/layout/engine.ts` — 空間キーワード抽出エンジン
- `app/src/excel/` — Excel生成（テンプレート埋め込み、チェックボックス、図形）
- `app/src/services/` — Supabase CRUD操作
- `app/src/utils/textNormalizer.ts` — 全角半角変換、ファジーマッチング
- `app/layoutTemplates/` — 書類種別ごとのフィールド定義JSON
- `templates/` — Excelテンプレートファイル

### API エンドポイント

| パス | 概要 |
|------|------|
| `/api/upload` | アップロード + ファイル名による書類分類 |
| `/api/ocr` | Document AI実行 |
| `/api/ocr-all` | 一括OCR |
| `/api/parse` | 4段階カスケードパース → property_jsonマージ |
| `/api/reparse` | テンプレート更新後の再パース |
| `/api/generate` | PropertyJsonからExcel生成 |
| `/api/ai-parse` | Geminiフォールバックパース |
| `/api/properties/[id]` | 物件CRUD |
| `/api/documents/[id]` | 書類CRUD |

### 書類分類（ファイル名キーワード）

- `registry`: 登記, 謄本, 全部事項
- `contract`: 売買契約, 契約書
- `drawing`: 図面, 意匠図, 配置図, 平面図, 立面図, 位置図, 地図
- `hazard`: ハザード, 洪水, 浸水, 内水, 津波, 土砂
- `permit`: 確認済証, 確認申請, 検査合格証, 検査済証, 建築確認

### 物件ステータス

`draft → ocr_processing → parsed → generated → completed`

## Key Technical Decisions

- Document AI はREST API + **undici**（Next.jsのパッチ済みfetchを回避するため）
- PropertyJsonをJSONBで保存（スキーマ柔軟性）
- LLMは最小限（フォールバックのみ、コアロジックには不使用）
- レイアウトテンプレートはJSON定義（コード変更なしで更新可能）

## Path Alias

`@/*` → `./src/*` (tsconfig.json)

## Environment Variables (.env.local)

`GCP_PROJECT_ID`, `DOCUMENT_AI_LOCATION`, `DOCUMENT_AI_PROCESSOR_ID`, `GCS_INPUT_BUCKET`, `GCS_OUTPUT_BUCKET`, `GEMINI_MODEL`, `GEMINI_API_KEY`, `TEMPLATE_PATH`
