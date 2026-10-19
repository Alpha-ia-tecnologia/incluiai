import { ShieldAlert } from "lucide-react";

// Aviso para a equipe: a IA está configurada, mas a família ainda não autorizou
// o uso com os dados deste estudante. As propostas saem pelas regras da plataforma.
export function ConsentNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="note" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-amber">
      <ShieldAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
      A família ainda não autorizou o uso de IA com os dados deste estudante: as propostas saem pelas regras da plataforma, e nada é enviado a serviços de IA. A família decide no portal dela.
    </p>
  );
}
