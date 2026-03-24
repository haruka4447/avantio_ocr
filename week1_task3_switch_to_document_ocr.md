# タスク3: Form Parser → Document OCR への切り替え

## 背景

現在 Form Parser を使用しているが、登記簿謄本のような公文書には適していない。
Document OCR に切り替えることでコストが約97%削減され、縦書き認識精度も向上する。

| プロセッサ | 費用 |
|---|---|
| Form Parser（現状） | $65 / 1,000ページ |
| Document OCR（切替後） | $1.50 / 1,000ページ |

**切替のトレードオフ**: Document OCR は `fields`・`tables` を返さない。
現在の4段階パースのStep 2（FormParser KV）・Step 3（FormParser Tables）が
`fields` / `tables` に依存している場合は修正が必要。

---

## 前提確認

作業開始前に以下を確認すること。

- GCPコンソール → Document AI → プロセッサ一覧から Document OCR のプロセッサIDを取得する
- `app/src/parsers/base.ts` で `fields` / `tables` を参照している箇所を洗い出す
- `app/src/ocr/` 配下でプロセッサ名を組み立てている箇所を特定する

---

## 実装手順

### Step 1: GCPコンソールで Document OCR プロセッサを作成・確認

GCPコンソール → Document AI → プロセッサ一覧 →「Document OCR」を選択して作成（または既存のIDを確認）。
プロセッサIDをメモしておく。

### Step 2: 環境変数にフラグを追加

`.env.local` に以下を追加する。

```bash
# 追加: Document OCR のプロセッサID
DOCUMENT_AI_OCR_PROCESSOR_ID=ここにDocument_OCRのプロセッサIDを入力

# 追加: 切り替えフラグ（"ocr" でDocument OCR使用、"form" でForm Parser使用）
DOCUMENT_AI_MODE=ocr
```

> `DOCUMENT_AI_MODE=form` に戻すだけで即座にロールバックできる設計にすること。

### Step 3: Document AIクライアントにモード切替を追加

`app/src/ocr/` 配下のプロセッサ名を組み立てている箇所を修正する。

```typescript
// 修正前（プロセッサIDが固定）
const processorName = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.DOCUMENT_AI_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`

// 修正後（モードで切り替え）
function getProcessorName(): string {
  const mode = process.env.DOCUMENT_AI_MODE ?? 'form'
  const processorId = mode === 'ocr'
    ? process.env.DOCUMENT_AI_OCR_PROCESSOR_ID
    : process.env.DOCUMENT_AI_PROCESSOR_ID

  if (!processorId) {
    throw new Error(`プロセッサIDが未設定です (DOCUMENT_AI_MODE=${mode})`)
  }

  return `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.DOCUMENT_AI_LOCATION}/processors/${processorId}`
}
```

### Step 4: パーサーの fields / tables 依存を修正

`app/src/parsers/base.ts` を確認し、以下の方針で修正する。

**Document OCR では `fields` と `tables` が空配列になる**ため、
nullチェックを追加して Step 2・Step 3 がフォールスルーするようにする。

```typescript
// 修正前（FormParser前提でfieldsが必ずある想定）
const kv = result.fields.find(f => fuzzyMatch(f.fieldName, key))
if (kv) return kv.fieldValue

// 修正後（fieldsが空でも止まらない）
const kv = result.fields?.find(f => fuzzyMatch(f.fieldName, key)) ?? null
if (kv) return kv.fieldValue
// fieldsが空の場合は次のStepへフォールスルー
```

同様に `tables` を参照している箇所も `?.` でnullチェックを追加すること。

### Step 5: 並行検証（切り替え前に必ず実施）

同一のスキャンPDFを `DOCUMENT_AI_MODE=form` と `DOCUMENT_AI_MODE=ocr` それぞれで処理し、
抽出結果を比較する。

確認すべき書類種別:
- 登記簿謄本（土地全部事項）
- 売買契約書
- 確認申請書

確認観点:
- 所在・地番・地積が正しく取れているか
- 所有者・抵当権者が正しく取れているか
- 以前と比べて欠落が増えていないか

問題がなければ `DOCUMENT_AI_MODE=ocr` のまま本番環境に適用する。

### Step 6: ビルド・lint確認

```bash
cd app
npm run lint
npm run build
```

エラーがないことを確認して完了。

---

## ロールバック手順

問題が発生した場合は `.env.local` の1行を変更するだけで戻せる。

```bash
# Form Parserに戻す
DOCUMENT_AI_MODE=form
```

開発サーバーを再起動すれば即座に反映される。

---

## 注意事項

- **必ず検証環境で先に試すこと**。本番環境への適用は精度確認後
- Document OCR はフィールド・テーブル構造を返さないため、Step 2・Step 3 の寄与が下がる。その分 Step 1（正規表現）と Step 4（Layout Engine）の精度が重要になる
- 切り替え後に Gemini フォールバック（`/api/ai-parse`）の呼び出し率が上がる場合は、正規表現パターン（`app/src/parsers/`）の強化を検討する
