import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '不動産重要事項説明書 自動生成システム',
  description: 'OCR解析による重要事項説明書の自動生成',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-stone-50 min-h-screen">
        <nav className="bg-white border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <a href="/" className="text-xl font-bold text-brand-700">
                  重説自動生成
                </a>
                <div className="ml-10 flex space-x-4">
                  <a href="/" className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md">
                    ダッシュボード
                  </a>
                  <a href="/properties" className="px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md">
                    物件一覧
                  </a>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
