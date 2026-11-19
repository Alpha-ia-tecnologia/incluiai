import { bnccSkill } from "@/lib/bncc";
import type { BnccSkill } from "@/lib/bncc-core";
import { Badge } from "@/components/ui";

/** Quem lê: a equipe vê o código da BNCC; a família, só as palavras. */
export type BnccAudience = "equipe" | "familia";

export function BnccSkillLine({ skill, audience = "equipe" }: { skill: Pick<BnccSkill, "code" | "component" | "description">; audience?: BnccAudience }) {
  if (audience === "familia") {
    return <p className="w-full text-xs leading-relaxed text-ink-soft"><span className="font-medium text-ink">Ligado ao que a turma aprende em {skill.component}:</span> {skill.description}</p>;
  }
  return (
    <p className="w-full text-xs leading-relaxed text-ink-soft">
      <span className="font-medium text-ink">BNCC <span className="font-mono">{skill.code}</span> · {skill.component}:</span> {skill.description}
    </p>
  );
}

export function BnccTag({ code, detail = false }: { code: string; detail?: boolean }) {
  const skill = bnccSkill(code);
  if (!skill) return <Badge tone="mid">BNCC {code}: código não encontrado na base</Badge>;
  if (!detail) return <span title={`${skill.component}: ${skill.description}`}><Badge>BNCC {skill.code}</Badge></span>;
  return <BnccSkillLine skill={skill} />;
}
