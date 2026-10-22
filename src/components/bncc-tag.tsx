import { bnccSkill } from "@/lib/bncc";
import { Badge } from "@/components/ui";

// Habilidade da BNCC de um objetivo: a etiqueta com o código e, com `detail`,
// o componente e o texto oficial logo abaixo. Código fora da base aparece em aviso.
export function BnccTag({ code, detail = false }: { code: string; detail?: boolean }) {
  const skill = bnccSkill(code);
  if (!skill) return <Badge tone="amber">BNCC {code}: código não encontrado na base</Badge>;
  if (!detail) return <span title={`${skill.component}: ${skill.description}`}><Badge>BNCC {skill.code}</Badge></span>;
  return (
    <p className="w-full text-xs leading-relaxed text-ink-soft">
      <span className="font-medium text-ink">BNCC <span className="font-mono">{skill.code}</span> · {skill.component}:</span> {skill.description}
    </p>
  );
}
