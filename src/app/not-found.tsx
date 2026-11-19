import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/ui";
import { BUTTON_CLS } from "@/components/form-styles";

export default function NotFound() {
  return (
    <main className="app-frame items-center justify-center px-4 py-10 sm:px-10 sm:py-16">
      <PageHero
        standalone
        character="resources"
        title="Este endereço não existe na plataforma"
        lede={<p>Confira o endereço digitado ou volte para o início para continuar de onde parou.</p>}
        actions={<Link href="/" className={BUTTON_CLS.primary}><ArrowLeft size={16} aria-hidden /> Ir para o início</Link>}
      />
    </main>
  );
}
