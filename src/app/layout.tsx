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
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Machine Facturas',
    statusBarStyle: 'default',
    startupImage: [
      { url: '/icons/splash-1170x2532.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
      { url: '/icons/splash-1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
      { url: '/icons/splash-2048x2732.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)' },
    ],
  },
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
  themeColor: "#021f87",
  viewportFit: 'cover',
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
