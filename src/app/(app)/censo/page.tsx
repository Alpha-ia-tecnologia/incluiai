import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { censusOverview } from "@/lib/census";
import { getMonitor } from "@/lib/census-core";
import { brMoment, fundebComparison, monitorState } from "@/lib/census-rules";
import { STAGE_GROUPS } from "@/lib/educacenso";
import { smallNumber } from "@/lib/assessment";
import { parseJson } from "@/lib/format";
import { saveCensusWindow, saveFndeCount, verifyCensusNow } from "@/actions/census";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { DataBoard, StatTile } from "@/components/data-viz";
import { CensusVerifyForm, CensusWindowForm, FndeForm } from "@/components/census/census-forms";

export const dynamic = "force-dynamic";

const STATUS_TONE = { ativo: "green", aguardando: "brand", fora: "amber", desligado: "neutral" } as const;

// Censo Escolar (Educacenso): o INEP não tem API. A escola exporta o arquivo de
// migração; a plataforma lê, concilia com o cadastro e confere, nos horários da
// janela do Censo, a dupla matrícula dos estudantes do AEE.
export default async function CensusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const overview = await censusOverview(user);
  if (!overview) redirect("/");
  const now = new Date();
  const [{ row: monitor, config }, checks] = await Promise.all([getMonitor(now), prisma.censusCheck.findMany({ orderBy: { at: "desc" }, take: 10 })]);
  const state = monitorState(config, now, checks[0]?.at ?? null);
  const { access, totals } = overview;
  const count = (value: number) => (access.network ? smallNumber(value) : String(value));
  const { estimate } = overview;
  const fnde = fundebComparison(estimate.considered, monitor.fndeAee);
  const stages = Object.entries(estimate.byStage).sort(([a], [b]) => a.localeCompare(b));
  // O que os arquivos têm de AEE e a estimativa deixa de fora, com o motivo.
  const outside = [
    estimate.notVerifiable && `${count(estimate.notVerifiable)} sem classe comum presencial pública nos arquivos da rede (pode estar em escola estadual ou de outro município)`,
    estimate.blocked && `${count(estimate.blocked)} com vínculo que o Educacenso recusa ou não importa`,
    estimate.repeated && `${count(estimate.repeated)} com AEE em mais de uma escola (contam uma vez)`,
    estimate.otherNetwork && `${count(estimate.otherNetwork)} com AEE em escola estadual (contam para o estado)`,
    estimate.partner && `${count(estimate.partner)} com AEE em instituição conveniada (contam se ela atuar só em educação especial)`,
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Censo Escolar" lede="O INEP não tem API: a escola exporta o arquivo de migração do Educacenso e a plataforma lê, concilia com o cadastro e confere a dupla matrícula dos estudantes do AEE." />
      <div className="grid min-w-0 max-w-4xl gap-6">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <SectionTitle>Verificação na janela do Censo</SectionTitle>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink"><CalendarClock size={16} aria-hidden className="text-brand-strong" /> {state.title} <Badge tone={STATUS_TONE[state.status]}>{config.times.join(" e ")}</Badge></p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{state.text}</p>
              <p className="mt-1 text-xs text-ink-soft">A verificação confere os estudantes do AEE de cada escola com o último arquivo aplicado. Mudou a pendência, a coordenação recebe um aviso.</p>
            </div>
            <CensusVerifyForm action={verifyCensusNow} />
          </div>
          {access.canConfigure ? (
            <details className="mt-4 border-t border-line pt-4">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand-strong">Configurar a janela do Censo</summary>
              <div className="mt-3"><CensusWindowForm action={saveCensusWindow} config={config} /></div>
            </details>
          ) : null}
        </Card>

        <section aria-labelledby="censo-contagens" className="grid min-w-0 gap-3">
          <h2 id="censo-contagens" className="text-base font-medium text-ink">Contagens {access.network ? "da rede" : "da escola"}</h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            {overview.withFile ? `Do último arquivo aplicado de ${overview.withFile === 1 ? "1 escola" : `${overview.withFile} escolas`}` : "Nenhuma escola aplicou o arquivo do Censo ainda"}
            {overview.schools.length > overview.withFile ? `; ${overview.schools.length - overview.withFile} sem arquivo.` : "."} Educação especial não é o mesmo que AEE: só o AEE com classe comum conta como dupla matrícula no Fundeb.
          </p>
          <DataBoard className="sm:grid-cols-3">
            <StatTile label="Educação especial no Censo" value={totals.especial} hint="Alunos com a marcação de deficiência, TEA ou altas habilidades." />
            <StatTile label="Matrículas no AEE" value={totals.aee} />
            <StatTile label="Dupla matrícula no arquivo" value={totals.dupla} hint="AEE com classe comum presencial no mesmo arquivo." />
            <StatTile label="AEE sem classe comum" value={count(totals.aeeSemComum)} hint="Dupla matrícula não confirmada no arquivo." />
            <StatTile label="Educação especial sem AEE" value={count(totals.especialSemAee)} hint="Confira se o estudante precisa do AEE." />
            <StatTile label="Com AEE na plataforma" value={overview.platformAee} hint={`${overview.attended} com atendimento registrado nos últimos 60 dias.`} />
          </DataBoard>
          <Card>
            <SectionTitle>AEE que o FNDE deve considerar (estimativa)</SectionTitle>
            <p className="font-display text-3xl font-bold leading-none tracking-tight text-ink tabular-nums">{estimate.considered}</p>
            {stages.length ? <p className="mt-2 text-sm text-ink"><span className="font-medium">Por etapa:</span> {stages.map(([stage, value]) => `${STAGE_GROUPS[stage] ?? "Etapa não informada"} ${count(value)}`).join(" · ")}.</p> : null}
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">Pelas regras da Nota Técnica Conjunta nº 12/2025: aluno com deficiência, TEA ou altas habilidades; vínculo de AEE aceito pelo Educacenso em escola municipal; classe comum presencial em escola pública, no mesmo arquivo ou no de outra escola da rede; cada aluno uma vez.</p>
            {outside.length ? <p className="mt-2 text-sm text-ink"><span className="font-medium">Fora da estimativa:</span> {outside.join("; ")}.</p> : null}
          </Card>
          <Card>
            <SectionTitle>Comparação com o FNDE</SectionTitle>
            {monitor.fndeAee !== null ? <p className="mb-2 text-sm text-ink"><span className="font-medium">Matrículas de AEE consideradas pelo FNDE{monitor.fndeYear ? ` no Fundeb ${monitor.fndeYear}` : ""}:</span> {monitor.fndeAee}. <span className="font-medium">Estimativa dos arquivos:</span> {estimate.considered}.</p> : null}
            <p className="text-sm leading-relaxed text-ink">{access.network || monitor.fndeAee !== null ? fnde.text : "A Secretaria informa o número de matrículas de AEE que o FNDE considerou para comparar com os arquivos da rede."}</p>
            {access.network ? <div className="mt-4"><FndeForm action={saveFndeCount} value={monitor.fndeAee} year={monitor.fndeYear ?? now.getFullYear()} /></div> : null}
          </Card>
        </section>

        <section aria-labelledby="censo-escolas" className="grid min-w-0 gap-3">
          <h2 id="censo-escolas" className="text-base font-medium text-ink">{access.network ? "Escolas" : "Sua escola"}</h2>
          {access.network ? <p className="text-sm text-ink-soft">A rede vê os números. Os nomes ficam com a coordenação de cada escola, que importa o arquivo.</p> : null}
          <ul className="grid min-w-0 gap-3">
            {overview.schools.map((school) => (
              <li key={school.id} className="min-w-0 rounded-2xl border border-line bg-paper-raised p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="min-w-0 break-words text-sm font-medium text-ink">{school.name}</h3>
                  {school.coverage ? (school.coverage.pending ? <Badge tone="amber">{count(school.coverage.pending)} com pendência</Badge> : <Badge tone="green">Sem pendências</Badge>) : <Badge>Sem arquivo aplicado</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-soft">{school.inepCode ? `INEP ${school.inepCode}` : "Sem código INEP"}{school.importedAt ? ` · arquivo aplicado em ${brMoment(school.importedAt)}${school.importedByName ? ` por ${school.importedByName}` : ""}` : ""}</p>
                {school.note && school.note.tone !== "ok" ? <p className="mt-2 text-xs leading-relaxed text-amber-800">{school.note.text}</p> : null}
                <p className="mt-2 text-sm text-ink">
                  {school.platformAee} {school.platformAee === 1 ? "estudante" : "estudantes"} com AEE na plataforma
                  {school.coverage ? `; dupla matrícula confirmada para ${count(school.coverage.confirmed)}${school.coverage.percent !== null ? ` (${school.coverage.percent}%)` : ""}.` : "."}
                </p>
                {school.canOpen ? <p className="mt-2 text-sm"><Link href={`/censo/escolas/${school.id}`} className="inline-flex min-h-11 items-center gap-1 font-medium text-brand-strong underline underline-offset-4">Abrir a escola <ArrowRight size={16} aria-hidden /></Link></p> : null}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="censo-historico" className="grid min-w-0 gap-3">
          <h2 id="censo-historico" className="text-base font-medium text-ink">Histórico das verificações</h2>
          {checks.length ? (
            <ul className="grid gap-2 text-sm text-ink">
              {checks.map((check) => {
                const schools = parseJson<{ schoolId: string }[]>(check.schools, []);
                return (
                  <li key={check.id} className="rounded-xl bg-surface-muted/60 px-4 py-2.5">
                    <span className="font-medium">{brMoment(check.at)}</span> · {check.trigger === "agendada" ? "agendada" : `manual, por ${check.actorName}`} · {check.ok ? `${check.confirmed} confirmados e ${count(check.pending)} com pendência em ${schools.length === 1 ? "1 escola" : `${schools.length} escolas`}` : "nenhuma escola com arquivo aplicado"}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState character="care" title="Nenhuma verificação ainda" hint="As verificações aparecem aqui nos horários da janela do Censo ou quando alguém usa Verificar agora." />
          )}
        </section>
      </div>
    </>
  );
}
