import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '리서치 맵',
  description: 'AI 기반 리서치 마인드맵',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-950">{children}</body>
    </html>
  );
}
