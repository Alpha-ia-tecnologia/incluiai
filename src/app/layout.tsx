import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans } from "next/font/google";
import "./globals.css";
import { TEXT_SCALE_SCRIPT } from "@/components/text-size-control";

// Noto Sans: a fonte da apresentação da plataforma.
const noto = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
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
    // suppressHydrationWarning: o script abaixo marca o tamanho do texto escolhido
    // antes de o React assumir a página.
    <html lang="pt-BR" className={`${noto.variable} ${jetbrains.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SCALE_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
