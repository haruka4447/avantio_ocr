'use client';

import { useEffect, useState } from 'react';

interface Property {
  id: string;
  address: string | null;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/properties')
      .then(res => res.json())
      .then(data => {
        setProperties(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statusCounts = {
    total: properties.length,
    draft: properties.filter(p => p.status === 'draft').length,
    processing: properties.filter(p => ['ocr_processing', 'parsed'].includes(p.status)).length,
    completed: properties.filter(p => ['generated', 'completed'].includes(p.status)).length,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-stone-500">全物件数</p>
          <p className="text-3xl font-bold text-stone-900">{statusCounts.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-stone-500">下書き</p>
          <p className="text-3xl font-bold text-amber-600">{statusCounts.draft}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-stone-500">処理中</p>
          <p className="text-3xl font-bold text-brand-600">{statusCounts.processing}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-stone-500">完了</p>
          <p className="text-3xl font-bold text-green-600">{statusCounts.completed}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">最近の物件</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-stone-500">読み込み中...</div>
        ) : properties.length === 0 ? (
          <div className="p-6 text-center text-stone-500">
            物件がありません。
            <a href="/properties" className="text-brand-600 hover:underline ml-1">新規作成</a>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">住所</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">ステータス</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">作成日</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {properties.slice(0, 10).map(property => (
                <tr key={property.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 text-sm text-stone-900">
                    {property.address || '（未設定）'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={property.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">
                    {new Date(property.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <a href={`/properties/${property.id}`} className="text-brand-600 hover:underline">
                      詳細
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: '下書き', className: 'bg-stone-100 text-stone-700' },
    ocr_processing: { label: 'OCR処理中', className: 'bg-brand-100 text-brand-700' },
    parsed: { label: '解析済', className: 'bg-orange-100 text-orange-700' },
    generated: { label: '生成済', className: 'bg-green-100 text-green-700' },
    completed: { label: '完了', className: 'bg-green-200 text-green-800' },
  };

  const c = config[status] || { label: status, className: 'bg-stone-100 text-stone-700' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
