import type { Metadata } from "next";
import { Archivo, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Títulos e números em Archivo condensada (eixo de largura); texto e interface
// em Atkinson Hyperlegible Next, desenhada para leitura com baixa visão.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IncluiEdu — Inteligência Municipal para Educação Inclusiva",
  description:
    "Plataforma municipal de acompanhamento do AEE: perfil funcional, plano individual, diário de acompanhamento e painel de gestão.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
