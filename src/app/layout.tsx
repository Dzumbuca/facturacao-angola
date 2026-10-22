import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facturação Angola",
  description: "Gestão de facturação para a sua empresa em Angola",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-AO" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
