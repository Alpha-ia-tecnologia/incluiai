import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import type { Dashboard } from "@/lib/dashboard";
import { plural } from "@/lib/format";
import { CENSUS_RULES } from "@/lib/federal-guidance";
import { advancingCount, groupByTrend, schoolsNeedingHelp, trendGroupsSentence } from "@/lib/panel-overview";
import { shortOf } from "@/lib/scale";
import { ALERTS, RECORD_GAP_DAYS } from "@/lib/student-alerts";
import { Assurances, HowToRead } from "@/components/explain";
import { StatusPill } from "@/components/viz/charts";
import { SupportSteps } from "@/components/viz/support-steps";
import { CoverageList, TrendSteps } from "./charts";

const LIST_LIMIT = 6;
const ROW_LINK = "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-surface-muted";
const MORE_LINK = "mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline";
const ALERT_WORDS = Object.values(ALERTS).map((alert) => alert.label.charAt(0).toLowerCase() + alert.label.slice(1)).join("; ");

function Question({ id, title, lead, help, aside, children }: { id: string; title: string; lead?: ReactNode; help?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={`dash-card grid min-w-0 scroll-mt-24 gap-x-10 gap-y-6 ${aside ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : ""}`}>
      <div className="min-w-0">
        <h2 id={`${id}-titulo`} className="text-xl font-medium tracking-tight text-ink">{title}</h2>
        {lead ? <p className="mt-2 text-sm text-ink-soft">{lead}</p> : null}
        {help ? <HowToRead>{help}</HowToRead> : null}
        <div className="mt-4">{children}</div>
      </div>
      {aside ? <div className="min-w-0 lg:border-l lg:border-line lg:pl-10">{aside}</div> : null}
    </section>
  );
}

/** "9 de 10 com …": o número que responde à pergunta. */
function Lead({ value, of, children }: { value: number; of: number; children: ReactNode }) {
  return <><strong className="font-display text-3xl font-bold tracking-tight text-ink tabular-nums">{value}</strong> de {of} {children}</>;
}

function ListTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-base font-medium tracking-tight text-ink">{children}</h3>;
}

function More({ shown, total, href, children }: { shown: number; total: number; href: string; children: string }) {
  if (total <= shown) return null;
  return <Link href={href} className={MORE_LINK}>{children} ({total - shown} a mais) <ArrowRight size={15} aria-hidden /></Link>;
}

export function Overview({ data, nominal, canCensus, periodText }: { data: Dashboard; nominal: boolean; canCensus: boolean; periodText: string }) {
  const { scope, overview: o, attention: a, records: r, questions: q } = data;
  const where = (school: string) => (scope.network && !scope.schoolId ? ` · ${school}` : "");

  // 1. Cobertura
  const coverageRows = q.coverage.steps.map((step) => ({ ...step, hint: step.key === "registro" ? `últimos ${RECORD_GAP_DAYS} dias` : undefined }));
  const pending = q.coverage.pending.slice(0, LIST_LIMIT);
  const unreferenced = q.schools.filter((school) => school.withoutReference > 0);

  // 2. O que funciona
  const groups = groupByTrend(q.objectives, (item) => item.steps.trend);
  const stepGroups = groups.map((group) => ({ key: group.key, reading: group.reading, items: group.items.map((item) => ({ key: item.key, level: item.level, participation: item.participation, target: item.steps.target })) }));
  const atGoal = (groups.find((group) => group.key === "meta")?.items ?? []).filter((item) => item.student);
  const strategies = r.strategies.slice(0, 5);
  const atGoalList = nominal && atGoal.length ? (
    <div>
      <ListTitle>Na meta</ListTitle>
      <ul className="-mx-3">
        {atGoal.slice(0, LIST_LIMIT).map((item) => (
          <li key={item.key}>
            <Link href={`/estudantes/${item.student!.id}/linha-do-tempo#objetivo-${item.key}`} className={ROW_LINK}>
              <span aria-hidden><SupportSteps data={item.steps} size="mini" /></span>
              <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{item.student!.name}</span><span className="block text-sm text-ink-soft first-letter:uppercase">{item.action}</span></span>
              <ArrowUpRight size={16} aria-hidden className="shrink-0 text-ink-soft" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
  const strategyList = strategies.length ? (
    <div>
      <ListTitle>Funcionou nas aulas</ListTitle>
      <p className="-mt-1 mb-3 text-sm text-ink-soft">Marcado em “o que funcionou” · {periodText}</p>
      <ul className="flex flex-wrap gap-1.5">
        {strategies.map((item) => (
          <li key={item.label} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-sm text-ink">{item.label}<span className="text-xs tabular-nums text-ink-soft">{item.value}×</span></li>
        ))}
      </ul>
    </div>
  ) : null;

  // 3. Onde precisa de ajuda
  const flaggedStudents = a.students.filter((student) => student.alerts.length > 0);
  const flaggedElsewhere = a.studentsWithAlerts - flaggedStudents.length;
  const schools = schoolsNeedingHelp(q.schools);
  const reviews = a.reviewsSoon ? <p className="mt-4 text-sm text-ink-soft">{plural(a.reviewsSoon, "revisão de plano", "revisões de plano")} nos próximos {a.reviewHorizonDays} dias.</p> : null;

  return (
    <div className="dash-board grid gap-3.5">
      <Question
        id="cobertura"
        title="Cobertura"
        lead={<Lead value={q.coverage.censusBacked} of={o.students}>com registro de referência para o Censo</Lead>}
        help={<>Estudo de caso concluído ou plano ativo (PAEE e PEI) na plataforma. {CENSUS_RULES[2]}</>}
        aside={nominal ? (
          <>
            <ListTitle>Falta um passo</ListTitle>
            {pending.length ? (
              <ul className="-mx-3">
                {pending.map((student) => (
                  <li key={student.id}>
                    <Link href={student.next.href} className={ROW_LINK}>
                      <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{student.name}</span><span className="block text-sm text-ink-soft">{student.next.label}{where(student.school)}</span></span>
                      <ArrowUpRight size={16} aria-hidden className="shrink-0 text-ink-soft" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">Todos com a trilha completa.</p>}
            <More shown={pending.length} total={q.coverage.pending.length} href="/estudantes">Ver estudantes</More>
          </>
        ) : (
          <>
            <ListTitle>Sem registro de referência</ListTitle>
            {unreferenced.length ? (
              <ul className="divide-y divide-line">
                {unreferenced.map((school) => (
                  <li key={school.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5 text-sm">
                    <span className="min-w-0 font-medium text-ink">{school.name}</span>
                    <span className="tabular-nums text-ink-soft">{school.withoutReference} de {plural(school.students, "estudante", "estudantes")}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">Cada estudante tem um registro de referência.</p>}
            {canCensus && unreferenced.length ? <Link href="/censo" className={MORE_LINK}>Abrir o Censo Escolar <ArrowRight size={15} aria-hidden /></Link> : null}
          </>
        )}
      >
        <CoverageList rows={coverageRows} total={o.students} />
      </Question>

      <Question
        id="funciona"
        title="O que funciona"
        lead={q.objectives.length ? <Lead value={advancingCount(groups)} of={q.objectives.length}>objetivos avançando</Lead> : undefined}
        help={q.objectives.length ? "Cada quadrado é um objetivo, na altura do apoio da aula mais recente; o traço é a meta. A tendência olha as últimas aulas e só pede atenção quando o apoio subiu ou houve recusas repetidas." : undefined}
        aside={atGoalList || strategyList ? <div className="grid gap-6">{atGoalList}{strategyList}</div> : undefined}
      >
        {q.objectives.length ? <TrendSteps groups={stepGroups} sentence={trendGroupsSentence(groups)} /> : <p className="text-sm text-ink-soft">Nenhum objetivo em acompanhamento.</p>}
      </Question>

      {nominal ? (
        <Question
          id="atencao"
          title="Estudantes que precisam de ajuda"
          lead={<Lead value={a.studentsWithAlerts} of={o.students}>com aviso</Lead>}
          help={`Aviso é um limite cruzado: ${ALERT_WORDS}.`}
        >
          {flaggedStudents.length ? (
            <ul className="-mx-3 grid gap-x-6 xl:grid-cols-2">
              {flaggedStudents.slice(0, 8).map((student) => (
                <li key={student.id}>
                  <Link href={`/estudantes/${student.id}`} className={ROW_LINK}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{student.name}</span>
                      <span className="block text-sm text-ink-soft">{student.className}{where(student.school)} · {student.alerts.map((kind) => shortOf(ALERTS, kind)).join(" · ")}</span>
                    </span>
                    <StatusPill tone="alert">{plural(student.alerts.length, "aviso", "avisos")}</StatusPill>
                    <ArrowUpRight size={16} aria-hidden className="shrink-0 text-ink-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : flaggedElsewhere ? null : <p className="text-sm text-ink-soft">Nenhum estudante com aviso.</p>}
          <More shown={Math.min(8, flaggedStudents.length)} total={flaggedStudents.length} href="/estudantes">Ver estudantes</More>
          {flaggedElsewhere > 0 ? <p className="mt-3 text-sm text-ink-soft">Em outras escolas: {plural(flaggedElsewhere, "estudante", "estudantes")} com aviso.</p> : null}
          {reviews}
        </Question>
      ) : (
        <Question
          id="atencao"
          title="Escolas que precisam de ajuda"
          lead={<Lead value={schools.flagged.length} of={q.schools.length}>{q.schools.length === 1 ? "escola" : "escolas"}</Lead>}
          help={`Entra aqui a escola em que 1 em cada 5 estudantes, ou mais, tem aviso. Aviso é um limite cruzado: ${ALERT_WORDS}.`}
        >
          <Assurances className="mb-3" label="Privacidade" items={[{ icon: ShieldCheck, text: "Números por escola, sem nomes" }]} />
          {schools.flagged.length ? (
            <ul className="divide-y divide-line">
              {schools.flagged.map((school) => (
                <li key={school.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{school.name}</span>
                    <span className="block text-sm text-ink-soft">{school.byKind.map((row) => `${shortOf(ALERTS, row.kind)}: ${row.value}`).join(" · ")}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="text-sm tabular-nums text-ink"><strong className="font-semibold">{school.withAlerts}</strong> de {plural(school.students, "estudante", "estudantes")} com aviso</span>
                    {scope.schoolId ? null : <Link href={`/painel?escola=${school.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm text-ink transition-colors hover:border-ink-soft">Ver a escola <ArrowRight size={15} aria-hidden /></Link>}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-soft">Nenhuma escola acima do limite.</p>}
          {schools.others.length ? <p className="mt-3 text-sm text-ink-soft">Abaixo do limite: {schools.others.map((school) => school.name).join(", ")}.</p> : null}
          <p className="mt-2 text-sm text-ink-soft">Ficha com nome: busque em Estudantes e informe o motivo.</p>
          {reviews}
        </Question>
      )}
    </div>
  );
}
