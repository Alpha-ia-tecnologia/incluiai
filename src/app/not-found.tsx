import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { primaryButtonCls } from "@/components/form-styles";

// Endereço que não existe na plataforma (fora das telas com menu).
export default function NotFound() {
  return (
    <main className="app-frame items-center justify-center px-4 py-10 sm:px-10 sm:py-16">
      <StatusPage
        character="resources"
        eyebrow="Página não encontrada"
        title="Este endereço não existe na plataforma"
        actions={<Link href="/" className={primaryButtonCls}><ArrowLeft size={16} aria-hidden /> Ir para o início</Link>}
      >
        <p>Confira o endereço digitado ou volte para o início para continuar de onde parou.</p>
      </StatusPage>
    </main>
  );
}
