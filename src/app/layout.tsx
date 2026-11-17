import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans } from "next/font/google";
import "./globals.css";
import { TEXT_SCALE_SCRIPT } from "@/components/text-size-control";
import { VLibras } from "@/components/vlibras";
import { currentTenant } from "@/lib/prisma";
import { brandOf } from "@/lib/tenant";
import { brandCss, derivePalette } from "@/lib/branding/palette";

// Noto Sans: a fonte da apresentação da plataforma.
const noto = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const metadata: Metadata = {
  title: "IncluiEdu — Inteligência Municipal para Educação Inclusiva",
  description:
    "Plataforma municipal de acompanhamento do AEE: perfil funcional, plano individual, diário de acompanhamento e painel de gestão.",
};

// A marca e o estado do município vêm do endereço de cada pedido; o build não
// conhece PLATFORM_DOMAIN, então nenhuma rota pode sair pré-renderizada.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await currentTenant();
  if (tenant.kind === "municipio" && tenant.municipality) return { ...metadata, title: `IncluiEdu — ${tenant.municipality.name}` };
  if (tenant.kind === "plataforma") return { ...metadata, title: "IncluiEdu — Administração da plataforma" };
  return metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tenant = await currentTenant();
  const brand = tenant.kind === "municipio" && tenant.municipality?.status === "ativo" ? brandOf(tenant.municipality) : null;
  const css = brand ? brandCss(derivePalette(brand.colors)) : "";
  return (
    // suppressHydrationWarning: o script abaixo marca o tamanho do texto escolhido
    // antes de o React assumir a página.
    <html lang="pt-BR" className={`${noto.variable} ${jetbrains.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SCALE_SCRIPT }} />
        {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      </head>
      <body className="min-h-full">
        {children}
        <VLibras />
      </body>
    </html>
  );
}
