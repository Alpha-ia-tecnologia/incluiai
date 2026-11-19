import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { PageHero } from "@/components/ui";
import { BUTTON_CLS } from "@/components/form-styles";

export default function NotFound() {
  return (
    <PageHero
      standalone
      character="resources"
      title="Não encontramos o que você procurava"
      lede={<p>O endereço pode ter mudado ou o registro pode ter sido excluído. Seus dados continuam protegidos e nada foi alterado.</p>}
      actions={<>
        <Link href="/" className={BUTTON_CLS.primary}><ArrowLeft size={16} aria-hidden /> Voltar para o início</Link>
        <Link href="/estudantes" className={BUTTON_CLS.quiet}><Users size={16} aria-hidden /> Ver estudantes</Link>
      </>}
    />
  );
}
