import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Lightbulb, RotateCcw, ShieldCheck, TrendingUp } from "lucide-react";
import { Assurances, HowToRead, Steps } from "@/components/explain";
import { prisma } from "@/lib/prisma";
import { canEditStudentRecord, canSeePedagogicalDetail, isStaffOrNetwork, requireStudentPage } from "@/lib/auth";
import { answersOf } from "@/lib/assessments";
import { ITEMS, compareAreas, objectiveSuggestions, observed, reassessmentDue, referenceLabel, referenceYear, AREA_LABEL } from "@/lib/assessment";
import { supportInfo } from "@/lib/scale";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { PillLink } from "@/components/pill-link";
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
        <PageHeader level={2} title="Sondagem" actions={<div className="flex flex-wrap items-center gap-2"><PillLink slug="sondagem" />{apply}</div>} />
        <Card className="max-w-3xl">
          <p className="mb-4 text-sm font-medium text-ink">Ainda não há sondagem.</p>
          <Steps
            label="Como a sondagem acompanha o estudante"
            items={[
              { icon: ClipboardCheck, label: "Linha de base após o estudo de caso" },
              { icon: RotateCcw, label: "Reaplique a cada 12 semanas" },
              { icon: TrendingUp, label: "Veja a evolução por área" },
            ]}
          />
        </Card>
      </>
    );
  }
  const first = answersOf(baseline.answers);
  const last = answersOf(latest.answers);
  const due = reassessmentDue(latest.appliedAt);
  const suggestions = objectiveSuggestions(last);

  return (
    <>
      <PageHeader level={2} title="Sondagem" actions={<div className="flex flex-wrap items-center gap-2"><PillLink slug="sondagem" />{apply}</div>} />
      <div className="grid min-w-0 max-w-3xl gap-6">
        <Assurances label="O que a sondagem não faz" items={[{ icon: ShieldCheck, text: "Não classifica por diagnóstico" }]} />
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          Linha de base em {formatDate(baseline.appliedAt)}{assessments.length > 1 ? `; última aplicação em ${formatDate(latest.appliedAt)}` : ""}.
          {due ? <Badge tone="amber">Reavaliação pendente: mais de 12 semanas</Badge> : <Badge tone="green">Reavaliação em dia</Badge>}
        </p>
        <Card>
          <SectionTitle>Apoio por área</SectionTitle>
          <HowToRead className="-mt-2 mb-3">Avançar é precisar de menos apoio no mesmo item.</HowToRead>
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
          <HowToRead className="mt-2">Referência para escolher as habilidades do plano, não nota nem classificação: o maior ano em que todos os itens observados até ele saem com até instrução verbal.</HowToRead>
        </Card>
        {suggestions.length ? (
          <Card>
            <SectionTitle>Sugestões de objetivo</SectionTitle>
            <p className="mb-3 text-sm text-ink-soft">Itens que ainda pedem modelo ou mais apoio.</p>
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
