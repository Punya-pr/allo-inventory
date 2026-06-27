import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Allo Inventory — Reservation Demo',
  description: 'Inventory reservation system with race-condition-safe checkout.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="font-semibold text-lg text-brand-700">
              Allo Inventory
            </a>
            <span className="text-sm text-slate-500">Reservation-based checkout demo</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
