import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facturação Angola",
  description: "Gestão de facturação para a sua empresa em Angola",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-AO" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        {/* Google AdSense — verificação e veiculação de anúncios no site */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9283668518139905"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
