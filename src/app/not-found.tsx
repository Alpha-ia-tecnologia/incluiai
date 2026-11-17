import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { primaryOnNavyCls } from "@/components/form-styles";

export default function NotFound() {
  return (
    <main className="app-frame items-center justify-center px-4 py-10 sm:px-10 sm:py-16">
      <StatusPage
        character="resources"
        eyebrow="Página não encontrada"
        title="Este endereço não existe na plataforma"
        actions={<Link href="/" className={primaryOnNavyCls}><ArrowLeft size={16} aria-hidden /> Ir para o início</Link>}
      >
        <p>Confira o endereço digitado ou volte para o início para continuar de onde parou.</p>
      </StatusPage>
    </main>
  );
}
