# 不動産重要事項説明書 自動生成システム（Document Layout Template対応）

## 概要

不動産関連資料をOCR解析し、重要事項説明書Excelテンプレートを自動生成するシステム。
LLM依存を最小化し、OCR＋レイアウト解析で高精度抽出を実現する。

------------------------------------------------------------------------

# 技術スタック

## Frontend / Backend

-   Next.js 16 (App Router)
-   React 19
-   TypeScript

## UI

-   Tailwind CSS 4

## Database / Storage

-   Supabase

## OCR

-   Google Cloud Document AI

## LLM

-   Gemini（最小使用）

## Excel

-   exceljs

------------------------------------------------------------------------

# システム目的

以下の資料から物件情報を抽出し重要事項説明書Excelテンプレートを自動生成する。

対象資料

-   登記簿謄本
-   売買契約書
-   建物図面
-   ハザードマップ

------------------------------------------------------------------------

# AI使用ポリシー

Geminiは以下の場合のみ使用

1.  ドキュメント分類
2.  Parser失敗時Fallback
3.  不明データ補完

通常処理では使用しない。

------------------------------------------------------------------------

# 全体アーキテクチャ

Next.js Frontend\
↓\
Next.js API\
↓\
Supabase Storage\
↓\
Document AI OCR\
↓\
Document Layout Parser\
↓\
Property JSON\
↓\
Excel Generator\
↓\
重要事項説明書

------------------------------------------------------------------------

# Supabase構成

## Database

tables

-   properties
-   buildings
-   owners
-   contracts
-   mortgages
-   hazards
-   documents

## Storage

bucket

documents

保存パス

documents/{property_id}/{document_type}.pdf

------------------------------------------------------------------------

# OCR前処理

OpenCV使用

-   deskew
-   denoise
-   threshold
-   300dpi変換

------------------------------------------------------------------------

# Document AI出力

以下を使用

-   text
-   blocks
-   paragraphs
-   tokens
-   boundingBox

textのみのOCRは禁止。

------------------------------------------------------------------------

# Document Layout Template

Layout TemplateはJSONで管理する。

例

``` json
{
 "property.address": {
   "keyword": "所在",
   "direction": "right"
 },
 "property.land_number": {
   "keyword": "地番",
   "direction": "right"
 },
 "property.land_type": {
   "keyword": "地目",
   "direction": "right"
 },
 "property.land_area": {
   "keyword": "地積",
   "direction": "right"
 }
}
```

------------------------------------------------------------------------

# Layout Parser

Layout Parserは以下の要素で値を取得する

-   keyword
-   boundingBox
-   direction

処理

tokens\
↓\
keyword検索\
↓\
boundingBox取得\
↓\
direction検索\
↓\
value抽出

------------------------------------------------------------------------

# Parser構成

-   RegistryParser
-   ContractParser
-   DrawingParser
-   HazardParser

共通インターフェース

parse(document) → JSON

------------------------------------------------------------------------

# Property JSON

``` json
{
 "property": {},
 "building": {},
 "ownership": [],
 "mortgage": [],
 "contract": {},
 "hazard": {}
}
```

このJSONを唯一の正データとする。

------------------------------------------------------------------------

# Excel Mapping

excelMapping.ts

例

``` ts
"B2": "property.address"
"B3": "property.land_number"
"B4": "property.land_type"
```

------------------------------------------------------------------------

# Excel生成

exceljs使用

処理

Property JSON\
↓\
Mapping\
↓\
Excel Template\
↓\
重要事項説明書出力

------------------------------------------------------------------------

# API

POST /api/upload\
PDFアップロード

POST /api/ocr\
OCR実行

POST /api/parse\
データ抽出

POST /api/generate\
Excel生成

------------------------------------------------------------------------

# 管理画面

Next.jsで実装

画面

-   物件一覧
-   物件詳細
-   資料アップロード
-   OCR結果確認
-   Excel生成

------------------------------------------------------------------------

# ディレクトリ構成

app/

-   dashboard
-   properties
-   documents

api/

-   upload
-   ocr
-   parse
-   generate

src/

-   ocr
-   layout
-   parsers
-   models
-   services
-   excel

layoutTemplates/

-   registry.json
-   contract.json
-   drawing.json
-   hazard.json

------------------------------------------------------------------------

# 実装要求

以下を実装してください

1.  システムアーキテクチャ
2.  Supabase DB
3.  OCR処理
4.  Layout Parser
5.  Layout Templateエンジン
6.  登記簿Parser実装
7.  Property JSON生成
8.  Excel Generator
9.  Next.js管理画面
10. API実装

拡張可能な設計にしてください。
