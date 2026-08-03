import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";

import "./globals.css";

/**
 * Fontes self-hosted por next/font — sem FOUT, sem requisição a terceiro.
 * Nenhum script de terceiro roda na área infantil (Bíblia Cap. 1 PE1).
 */
const baloo = Baloo_2({
  subsets: ["latin", "latin-ext"],
  variable: "--font-baloo",
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Crescendo e Aprendendo — o Arquipélago Crescente",
    template: "%s · Crescendo e Aprendendo",
  },
  description:
    "Plataforma de desenvolvimento infantil onde a criança aprende de verdade enquanto joga. Alinhada à BNCC, sem publicidade, sem chat, sem dado vendido.",
  applicationName: "Crescendo e Aprendendo",
  authors: [{ name: "Crescendo e Aprendendo" }],
  keywords: [
    "educação infantil",
    "BNCC",
    "aprendizagem gamificada",
    "educação financeira infantil",
  ],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#7C5CFF",
  width: "device-width",
  initialScale: 1,
  // Permite zoom: bloquear é uma violação de acessibilidade.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${baloo.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
