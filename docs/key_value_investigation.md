# キーバリュー取得不可に関する調査結果

## 1. システム概要

本プロジェクトでは、Document AI の Form Parser からキーバリューを取得する仕組みが4段階の優先度で実装されている。

| 優先度 | 戦略 | ファイル |
|--------|------|----------|
| 1（最高）| テキスト正規表現 | `app/src/parsers/textExtractor.ts` |
| 2 | Form Parser キーバリュー | `app/src/parsers/base.ts` (L44-83) |
| 3 | Form Parser テーブル | `app/src/parsers/base.ts` (L89-134) |
| 4（最低）| レイアウトエンジン | `app/src/layout/engine.ts` |

マージ順は `layoutMap < tableMap < formMap < textMap` であり、上位の結果が下位を上書きする。

---

## 2. 特定された問題点

### 2.1 Next.js の fetch パッチ問題（根本原因の可能性が高い）

`app/src/ocr/documentai.ts` L56-58 のコメントに明記されている：

> Next.js patched fetch drops these fields, but undici returns the full response.

Next.js が `fetch` をパッチしており、Document AI REST API のレスポンスから **formFields や tables が欠落する**問題がある。これに対して `undici` を使った `getFormParserDataViaRest()` が既に実装されているが、以下の点が懸念される：

- **gRPC クライアント**（L131-143）はOCRトークン取得に使用
- **REST API**（undici経由、L59-127）はForm Parserデータ取得に使用
- つまり**同じPDFを2回処理**している（gRPC + REST）

### 2.2 Form Parser キーバリューのマッチング精度

`app/src/parsers/base.ts` L57-58：

```typescript
if (!field.fieldName || !field.fieldValue) continue;
```

- `fieldName` または `fieldValue` が空の場合、そのペアは完全にスキップされる
- Document AI が日本語文書でフィールド名を正しく認識できない場合、すべてのキーバリューが無視される

### 2.3 キーワードマッチングの制約

`app/src/parsers/base.ts` L62：直接一致 → 部分一致の順でマッチするが：

- テンプレートに定義されたキーワードと、Document AI が返すフィールド名が**表記揺れ**で一致しないケースがある
- 例：テンプレートは「所在」だが Document AI が「土地の所在」や「所 在」を返す場合

### 2.4 REST API のサイレント失敗

`app/src/ocr/documentai.ts` L75-79：REST API がエラーを返した場合、**空の formFields/tables を返してサイレントに失敗**する：

```typescript
if (statusCode !== 200) {
  console.error(`[DocumentAI REST] Error: ${statusCode} ${errText.substring(0, 200)}`);
  return { formFields: [], tables: [] };  // 空で返す → パース側は気づかない
}
```

catch節（L123-126）も同様に空配列を返すため、呼び出し側からはエラーの発生を検知できない。

### 2.5 デジタルPDFのテキスト不整合

`app/src/app/api/ocr/route.ts` L27-39：デジタルPDFの場合：

- `fullText` は `digitalResult.text` で上書きされる
- しかし `formFields` と `tables` は Document AI の結果をそのまま使用
- テキスト正規表現（Strategy 1）が `digitalResult.text` に対して実行されるが、このテキストとDocument AI のテキストでは**改行位置や空白が異なる**ため、正規表現がマッチしない可能性がある

---

## 3. 結論

**最も可能性の高い原因**は、Document AI REST API からのキーバリュー取得が空で返ってきていること（認証エラー、プロセッサーの設定、またはレスポンス形式の問題）である。REST API が `formFields: []` を返した場合でも、エラーがコンソールログに出るだけで処理は続行されるため、表面上は正常に動作しているように見える。

---

## 4. 推奨される確認・対応事項

1. `/api/ocr` のレスポンスで `form_fields` の数を確認する（0であれば REST API 側の問題）
2. Document AI プロセッサーが **Form Parser** タイプであることを確認する（OCR プロセッサーだけでは formFields は返らない）
3. コンソールログに `[DocumentAI REST] Error` が出ていないか確認する
4. REST API のエラーハンドリングを改善し、エラー時にレスポンスへ警告を含めることを検討する
5. デジタルPDF時の `fullText` 上書きによる正規表現不一致の検証を行う
