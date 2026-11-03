import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: {
    default: 'Machine Facturas | Facturação e gestão empresarial para Angola',
    template: '%s | Machine Facturas',
  },
  description: 'Facturação online para empresas angolanas. Crie, emite e organize facturas, com ferramentas gratuitas e conteúdos práticos para Angola.',
  keywords: ['facturação Angola', 'software de facturas Angola', 'facturação online', 'SAFT Angola', 'gestão empresarial Angola'],
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_AO',
    siteName: 'Machine Facturas',
    title: 'Machine Facturas | Facturação e gestão empresarial para Angola',
    description: 'Facturação online para empresas angolanas. Ferramentas gratuitas e conhecimento prático para o dia-a-dia.',
    url: 'https://machinefaturas.shop',
    images: [{ url: '/logo.png', width: 800, height: 600 }],
  },
  twitter: {
    card: 'summary',
    title: 'Machine Facturas | Facturação e gestão empresarial para Angola',
    description: 'Facturação online para empresas angolanas — grátis para começar.',
    images: ['/logo.png'],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-AO" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">{`(() => { try { const key = 'machine-facturas-theme'; const saved = localStorage.getItem(key); const theme = saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = theme; } catch { document.documentElement.dataset.theme = 'light'; } })();`}</Script>
        <Script id="sw-register" strategy="afterInteractive">{`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(() => {}); }`}</Script>
        <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9283668518139905" crossOrigin="anonymous" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
