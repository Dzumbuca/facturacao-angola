import type { Metadata } from "next";
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
        {/* Google AdSense — script directo no HTML (o rastreador do AdSense lê o HTML bruto) */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9283668518139905"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
