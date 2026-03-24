'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface FormField {
  fieldName: string;
  fieldValue: string;
  confidence: number;
}

interface TableCell {
  text: string;
  rowIndex: number;
  colIndex: number;
}

interface FormTable {
  headerRows: TableCell[][];
  bodyRows: TableCell[][];
  pageNumber: number;
}

interface DocumentDetail {
  id: string;
  property_id: string;
  document_type: string;
  file_name: string;
  ocr_status: string;
  ocr_result: {
    pages: Array<{
      pageNumber: number;
      text: string;
      tokens: Array<{ text: string; confidence: number }>;
    }>;
    fullText: string;
    formFields?: FormField[];
    tables?: FormTable[];
  } | null;
  parsed_data: Record<string, string> | null;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  registry: '登記簿謄本',
  contract: '売買契約書',
  drawing: '建物図面',
  hazard: 'ハザードマップ',
  permit: '建築確認関連',
  other: 'その他',
};

export default function DocumentDetailPage() {
  const params = useParams();
  const documentId = params.id as string;
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'parsed' | 'formfields' | 'tables' | 'ocr'>('parsed');

  useEffect(() => {
    fetch(`/api/documents/${documentId}`)
      .then(res => res.json())
      .then(data => {
        setDoc(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [documentId]);

  if (loading) {
    return <div className="text-center text-stone-500 py-12">読み込み中...</div>;
  }

  if (!doc) {
    return <div className="text-center text-red-500 py-12">ドキュメントが見つかりません</div>;
  }

  const formFields = doc.ocr_result?.formFields || [];
  const tables = doc.ocr_result?.tables || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{doc.file_name}</h1>
          <p className="text-sm text-stone-500 mt-1">
            種別: {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
          </p>
        </div>
        <a
          href={`/properties/${doc.property_id}`}
          className="text-brand-600 hover:underline text-sm"
        >
          物件詳細に戻る
        </a>
      </div>

      {/* Summary badges */}
      {doc.ocr_result && (
        <div className="flex space-x-3 text-xs">
          <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded">
            {doc.ocr_result.pages.length} ページ
          </span>
          <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded">
            {doc.ocr_result.fullText.length.toLocaleString()} 文字
          </span>
          {formFields.length > 0 && (
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
              {formFields.length} キーバリュー
            </span>
          )}
          {tables.length > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
              {tables.length} テーブル
            </span>
          )}
          {doc.parsed_data && (
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">
              {Object.keys(doc.parsed_data).length} 解析項目
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <nav className="-mb-px flex space-x-8">
          {([
            { key: 'parsed', label: '解析結果' },
            { key: 'formfields', label: `キーバリュー (${formFields.length})` },
            { key: 'tables', label: `テーブル (${tables.length})` },
            { key: 'ocr', label: 'OCRテキスト' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'parsed' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">解析結果</h2>
          </div>
          {doc.parsed_data && Object.keys(doc.parsed_data).length > 0 ? (
            <div className="p-6">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">フィールド</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">値</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {Object.entries(doc.parsed_data).map(([key, value]) => (
                    <tr key={key}>
                      <td className="px-6 py-3 text-sm font-medium text-stone-900">{key}</td>
                      <td className="px-6 py-3 text-sm text-stone-700">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-stone-500">解析データがありません</div>
          )}
        </div>
      )}

      {activeTab === 'formfields' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">
              Form Parser キーバリューペア
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Document AI (Form Parser) が自動検出したキーと値のペアです
            </p>
          </div>
          {formFields.length > 0 ? (
            <div className="p-6">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">キー</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">値</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">信頼度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {formFields.map((field, i) => (
                    <tr key={i} className={field.confidence < 0.7 ? 'bg-amber-50' : ''}>
                      <td className="px-6 py-3 text-sm font-medium text-stone-900">{field.fieldName || '(なし)'}</td>
                      <td className="px-6 py-3 text-sm text-stone-700">{field.fieldValue || '(なし)'}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          field.confidence >= 0.9 ? 'bg-green-100 text-green-700' :
                          field.confidence >= 0.7 ? 'bg-stone-100 text-stone-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {(field.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-stone-500">
              キーバリューペアがありません。
              <br />
              <span className="text-xs">Form Parser プロセッサーを使用している場合のみ取得できます。</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tables' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">
              Form Parser テーブルデータ
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Document AI (Form Parser) が自動検出した表データです
            </p>
          </div>
          {tables.length > 0 ? (
            <div className="p-6 space-y-6">
              {tables.map((table, ti) => (
                <div key={ti} className="border border-stone-200 rounded overflow-hidden">
                  <div className="bg-stone-50 px-4 py-2 text-xs font-medium text-stone-600">
                    テーブル {ti + 1} (ページ {table.pageNumber})
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-stone-200 text-sm">
                      {table.headerRows.length > 0 && (
                        <thead className="bg-blue-50">
                          {table.headerRows.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((cell, ci) => (
                                <th key={ci} className="px-3 py-2 text-left text-xs font-medium text-blue-800 border border-stone-200">
                                  {cell.text}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                      )}
                      <tbody className="divide-y divide-stone-200">
                        {table.bodyRows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 text-stone-700 border border-stone-200 whitespace-pre-wrap">
                                {cell.text}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-stone-500">
              テーブルデータがありません。
              <br />
              <span className="text-xs">Form Parser プロセッサーを使用している場合のみ取得できます。</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ocr' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">OCRテキスト</h2>
          </div>
          {doc.ocr_result ? (
            <div className="p-6 space-y-4">
              {doc.ocr_result.pages.map(page => (
                <div key={page.pageNumber} className="border border-stone-200 rounded p-4">
                  <h3 className="text-sm font-medium text-stone-700 mb-2">
                    ページ {page.pageNumber}（{page.tokens?.length || 0} トークン）
                  </h3>
                  <pre className="bg-stone-50 p-3 rounded text-sm whitespace-pre-wrap text-stone-800">
                    {page.text}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-stone-500">OCR結果がありません</div>
          )}
        </div>
      )}
    </div>
  );
}
