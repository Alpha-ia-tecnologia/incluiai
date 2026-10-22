import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Lightbulb } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canEditStudentRecord, canSeePedagogicalDetail, isStaffOrNetwork, requireStudentPage } from "@/lib/auth";
import { answersOf } from "@/lib/assessments";
import { ITEMS, compareAreas, objectiveSuggestions, observed, reassessmentDue, referenceLabel, referenceYear, AREA_LABEL } from "@/lib/assessment";
import { supportInfo } from "@/lib/scale";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { BnccTag } from "@/components/bncc-tag";
import { AreaComparison } from "@/components/assessment/area-comparison";
import { linkCls, primaryButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

// Sondagem (item 3 do plano): linha de base, reavaliação a cada 12 semanas,
// evolução por área, referência na BNCC e sugestões de objetivo para o plano.
export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudentPage(id, "Sondagem");
  if (!canSeePedagogicalDetail(user.role) || !isStaffOrNetwork(user.role)) redirect(`/estudantes/${id}`);
  const team = canEditStudentRecord(user.role);
  const assessments = await prisma.assessment.findMany({ where: { studentId: id }, orderBy: { appliedAt: "asc" } });
  const baseline = assessments[0];
  const latest = assessments.at(-1);
  const apply = team ? <Link href={`/estudantes/${id}/sondagem/aplicar`} className={primaryButtonCls}><ClipboardCheck size={16} aria-hidden /> {baseline ? "Aplicar a reavaliação" : "Aplicar a linha de base"}</Link> : undefined;

  if (!baseline || !latest) {
    return (
      <>
        <PageHeader level={2} title="Sondagem" lede="Itens observáveis, um por um, com o apoio de que o estudante precisa. A primeira aplicação é a linha de base; as seguintes mostram a evolução." actions={apply} />
        <Card className="max-w-3xl"><p className="text-sm leading-relaxed text-ink-soft">Ainda não há sondagem. O melhor momento para a linha de base é ao concluir o estudo de caso; depois, reaplique a cada revisão do plano (12 semanas).</p></Card>
      </>
    );
  }
  const first = answersOf(baseline.answers);
  const last = answersOf(latest.answers);
  const due = reassessmentDue(latest.appliedAt);
  const suggestions = objectiveSuggestions(last);

  return (
    <>
      <PageHeader level={2} title="Sondagem" lede="Avançar é precisar de menos apoio no mesmo item. A sondagem não classifica o estudante por diagnóstico: mostra por onde começar." actions={apply} />
      <div className="grid min-w-0 max-w-3xl gap-6">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          Linha de base em {formatDate(baseline.appliedAt)}{assessments.length > 1 ? `; última aplicação em ${formatDate(latest.appliedAt)}` : ""}.
          {due ? <Badge tone="amber">Reavaliação pendente: mais de 12 semanas</Badge> : <Badge tone="green">Reavaliação em dia</Badge>}
        </p>
        <Card>
          <SectionTitle>Apoio por área</SectionTitle>
          <AreaComparison rows={assessments.length > 1 ? compareAreas(first, last) : compareAreas(last, last).map((row) => ({ ...row, start: null, change: null }))} />
        </Card>
        <Card>
          <SectionTitle>Referência na BNCC para planejar</SectionTitle>
          <ul className="grid gap-2 text-sm text-ink">
            {(["leitura_escrita", "matematica"] as const).map((area) => {
              const label = referenceLabel(referenceYear(last, area));
              return <li key={area}><span className="font-medium">{AREA_LABEL[area]}:</span> {label ?? "não observado na última aplicação"}.</li>;
            })}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">Referência para escolher as habilidades do plano, não nota nem classificação: o maior ano em que todos os itens observados até ele saem com até instrução verbal.</p>
        </Card>
        {suggestions.length ? (
          <Card>
            <SectionTitle>Sugestões de objetivo</SectionTitle>
            <p className="mb-3 text-sm leading-relaxed text-ink-soft">Itens em que o estudante ainda precisa de modelo ou mais apoio. Escolha no plano o que faz sentido trabalhar agora.</p>
            <ul className="grid gap-3">
              {suggestions.map((item) => (
                <li key={item.id} className="flex min-w-0 flex-wrap items-start gap-2 rounded-xl bg-surface-muted/60 p-3">
                  <Lightbulb size={16} aria-hidden className="mt-0.5 shrink-0 text-brand-strong" />
                  <span className="min-w-0 flex-1 text-sm text-ink">{item.text} <span className="text-ink-soft">({AREA_LABEL[item.area]}; hoje: {supportInfo(last[item.id] as number).label.toLowerCase()})</span></span>
                  {item.bncc ? <BnccTag code={item.bncc} /> : null}
                </li>
              ))}
            </ul>
            {team ? <p className="mt-3 text-sm"><Link href={`/estudantes/${id}/ppi#novo-objetivo`} className={linkCls}>Definir um objetivo no plano</Link></p> : null}
          </Card>
        ) : null}
        <Card>
          <SectionTitle>Aplicações</SectionTitle>
          <ol className="grid gap-2 text-sm">
            {[...assessments].reverse().map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-line pb-2 last:border-0">
                <span className="text-ink">{item.kind === "linha_de_base" ? "Linha de base" : "Reavaliação"} · {formatDate(item.appliedAt)} · {item.appliedByName}</span>
                <span className="text-ink-soft">{observed(answersOf(item.answers)).length} de {ITEMS.length} itens observados</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
