import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CasalGastos",
  description: "Sistema de controle de gastos para casal (web + celular) com Supabase",
  manifest: "/manifest.webmanifest",
  themeColor: "#14b8a6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
