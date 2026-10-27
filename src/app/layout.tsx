import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Machine Facturas | Facturação e gestão empresarial",
  description: "Gestão de facturação para a sua empresa em Angola",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-AO" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">{`(() => { try { const key = 'machine-facturas-theme'; const saved = localStorage.getItem(key); const theme = saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = theme; } catch { document.documentElement.dataset.theme = 'light'; } })();`}</Script>
        {children}
      </body>
    </html>
  );
}
