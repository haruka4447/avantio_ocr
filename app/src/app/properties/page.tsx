'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Property {
  id: string;
  address: string | null;
  land_number: string | null;
  land_area: string | null;
  status: string;
  created_at: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const fetchProperties = () => {
    fetch('/api/properties')
      .then(res => res.json())
      .then(data => {
        setProperties(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/properties', { method: 'POST' });
      const data = await res.json();
      if (data.id) {
        router.push(`/properties/${data.id}`);
      }
    } catch (error) {
      alert('物件の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この物件を削除しますか？')) return;
    try {
      await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      fetchProperties();
    } catch {
      alert('削除に失敗しました');
    }
  };

  const statusLabel: Record<string, string> = {
    draft: '下書き',
    ocr_processing: 'OCR処理中',
    parsed: '解析済',
    generated: '生成済',
    completed: '完了',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-stone-900">物件一覧</h1>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {creating ? '作成中...' : '新規物件作成'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-6 text-center text-stone-500">読み込み中...</div>
        ) : properties.length === 0 ? (
          <div className="p-6 text-center text-stone-500">物件がありません</div>
        ) : (
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">住所</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">地番</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">地積</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">ステータス</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">作成日</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {properties.map(property => (
                <tr key={property.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 text-sm text-stone-900">
                    {property.address || '（未設定）'}
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">
                    {property.land_number || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">
                    {property.land_area || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">
                    {statusLabel[property.status] || property.status}
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">
                    {new Date(property.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <a
                      href={`/properties/${property.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      詳細
                    </a>
                    <button
                      onClick={() => handleDelete(property.id)}
                      className="text-red-600 hover:underline"
                    >
                      削除
                    </button>
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
