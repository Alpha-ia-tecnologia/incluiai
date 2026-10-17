import type { MaterialView } from "@/lib/dua/materials";
import { MATERIAL_FORMAT_LABEL } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";

export const AI_PARTICIPATION_LABEL: Record<string, string> = {
  nenhuma: "Sem participação de IA",
  conteudo_com_sugestao_revisada: "Inclui sugestões revisadas",
};

// Metadados do material, os mesmos na lista e na impressão: de onde veio, para
// que serve, para quem é, quem preparou, se há sugestão revisada e a validação.
export function materialMeta(material: MaterialView, options: { withActivity?: boolean; versionState?: string } = {}) {
  return [
    ...(options.withActivity ? [{ label: "Atividade", value: material.planningTitle }] : []),
    { label: "Versão de origem", value: `Versão ${material.versionNumber}${options.versionState ? ` (${options.versionState})` : ""}` },
    { label: "Finalidade pedagógica", value: material.purpose },
    { label: "Formato", value: MATERIAL_FORMAT_LABEL[material.format] ?? material.format },
    { label: "Recursos de acessibilidade", value: material.accessibility.join(", ") || "Não informados" },
    { label: "Escopo", value: material.scope === "individual" ? `Individual${material.student ? `: ${material.student.name}` : ""}` : "Coletivo, para a turma" },
    { label: "Autoria", value: `${material.authorName}, em ${formatDate(material.createdAt)}` },
    { label: "Participação de IA", value: AI_PARTICIPATION_LABEL[material.aiParticipation] ?? material.aiParticipation },
    {
      label: "Revisão",
      value: material.state === "validado"
        ? `Validado${material.validatedByName ? ` por ${material.validatedByName}` : ""}${material.validatedAt ? ` em ${formatDate(material.validatedAt)}` : ""}`
        : "Rascunho, ainda não validado para uso pedagógico",
    },
  ];
}

export function MaterialMetaList({ items, className = "" }: { items: { label: string; value: string }[]; className?: string }) {
  return (
    <dl className={`grid min-w-0 gap-1 text-sm ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="inline font-medium text-ink">{item.label}: </dt>
          <dd className="inline break-words text-ink-soft">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
