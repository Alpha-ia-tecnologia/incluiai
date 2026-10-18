import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { primaryButtonCls, quietButtonCls } from "@/components/form-styles";

// Registro que não existe ou saiu do alcance (estudante, material, planejamento).
export default function NotFound() {
  return (
    <StatusPage
      character="resources"
      eyebrow="Não encontrado"
      title="Não encontramos o que você procurava"
      actions={<>
        <Link href="/" className={primaryButtonCls}><ArrowLeft size={16} aria-hidden /> Voltar para o início</Link>
        <Link href="/estudantes" className={quietButtonCls}><Users size={16} aria-hidden /> Ver estudantes</Link>
      </>}
    >
      <p>O endereço pode ter mudado ou o registro pode ter sido excluído. Seus dados continuam protegidos e nada foi alterado.</p>
    </StatusPage>
  );
}
