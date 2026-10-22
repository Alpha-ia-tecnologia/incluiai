import { smallNumber } from "@/lib/assessment";
import Link from "next/link";
import { recordJourneyMark } from "@/lib/user-journey";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Lightbulb, ShieldCheck, Sparkles } from "lucide-react";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import {
  ALERT_LABELS, GAUGES, PERIODS, loadDashboard, parseGauge, parsePeriod,
  type DashboardGauge, type DashboardPeriod,
} from "@/lib/dashboard";
import { ROLES, supportInfo } from "@/lib/scale";
import { firstName, formatDate, formatDateShort } from "@/lib/format";
import { CALENDAR_THEMES, MONTH_SHORT, monthParam, relativeLabel, todayInBrazil, upcomingEvents } from "@/lib/commemorative-dates";
import { duaIndicators } from "@/lib/dua/indicators";
import { canPlanDua } from "@/lib/dua/access";
import { AI_BLOCK_DECISION_LABEL } from "@/lib/dua/domain";
import { EmptyState } from "@/components/ui";
import {
  BarList, ColumnChart, HatchedDonut, HatchedGauge, Legend, MonthGrid, SIGNAL, StackedBar, SupportScale, type ChartSegment,
} from "@/components/charts";
import { RingStat, StatTile, StatusPill, TrendBadge, withSegmentColors, type Tone } from "@/components/data-viz";
import { ShareRing } from "@/components/viz/share-ring";
import { UsageMeter } from "@/components/viz/usage-meter";
import { Character } from "@/components/character";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// Linguagem visual inspirada em painéis de score: destaque com medidor em
// degradê, cartões brancos sobre quadro cinza, pílulas de situação (lima =
// bom, amarelo = intermediário, laranja = atenção) e botões pretos.

const ROLE_LABELS: Record<string, string> = { ...ROLES, terapeuta: "Terapeuta" };
const ACCESS_LABELS: Record<string, string> = { visualizou: "Consultas", criou: "Inclusões", editou: "Alterações", enviou: "Envios à IA de reserva (DeepSeek)" };
const SHORT_ALERTS: Record<string, string> = { sem_registro: "Sem registro há 7+ dias", plano_vencido: "Revisão vencida", sem_plano: "Sem plano", queda_participacao: "Queda de participação" };

// Cores dos contadores; as mesmas da pílula de situação (src/components/data-viz.tsx).
const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-signal-lime text-ink-strong",
  mid: "bg-signal-yellow text-ink-strong",
  alert: "bg-signal-orange text-ink-strong",
  neutral: "bg-signal-track text-ink-soft",
  info: "bg-sky-soft text-sky-ink",
};
const decimal = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const oneDecimal = (value: number) => Math.round(value * 10) / 10;
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;
// Diferença em pontos percentuais contra o período anterior; sem um dos dois, não há comparação.
const pointsDelta = (gauge: { value: number | null; previous: number | null }) => (gauge.value !== null && gauge.previous !== null ? gauge.value - gauge.previous : null);
const pointsText = (delta: number) => `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta)} ${Math.abs(delta) === 1 ? "ponto" : "pontos"}`;
const shortDate = (date: Date) => date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });

function CardHeader({ title, hint, href, linkLabel }: { title: string; hint?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-medium tracking-tight text-ink">{title}</h3>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-soft">{hint}</p> : null}
      </div>
      {href ? <Link href={href} className="circle-link" aria-label={linkLabel ?? `Abrir ${title.toLowerCase()}`}><ArrowUpRight size={16} aria-hidden /></Link> : null}
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="mt-10 scroll-mt-20">
      <div className="mb-3.5 px-1">
        <h2 id={`${id}-titulo`} className="font-display text-xl font-medium tracking-tight text-ink sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

// Comparação com o período anterior, escrita por extenso ao lado da pílula
// (a seta e a cor só reforçam o texto).
type FactorTrend = { delta: number | null; better: "up" | "down"; caption: string };
type Factor = { title: string; value: ReactNode; tone: Tone; status: string; text: string; href: string; trend?: FactorTrend };

function FactorCard({ title, value, tone, status, text, href, trend }: Factor) {
  return (
    <article className="dash-card flex min-w-0 flex-col !p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-ink">{title}</h3>
        <Link href={href} className="circle-link !size-8" aria-label={`Ver detalhes: ${title}`}><ArrowUpRight size={15} aria-hidden /></Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-display text-3xl font-bold leading-none tracking-tight text-ink">{value}</p>
        <StatusPill tone={tone}>{status}</StatusPill>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">{text}</p>
      {trend && trend.delta !== null ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-snug text-ink-soft">
          <TrendBadge delta={trend.delta} better={trend.better} text={pointsText(trend.delta)} />
          <span className="min-w-0">{trend.caption}</span>
        </p>
      ) : null}
    </article>
  );
}

// Número da IA em bloco compacto, dentro da lista de definições do cartão.
function AiStat({ label, value, detail, wide = false, children }: { label: string; value: ReactNode; detail?: string; wide?: boolean; children?: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-2xl bg-surface-muted/70 p-3.5 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs leading-snug text-ink-soft">{label}</dt>
      <dd className="mt-1.5 font-display text-2xl font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</dd>
      {detail ? <dd className="mt-1 text-xs leading-snug text-ink-soft">{detail}</dd> : null}
      {children ? <dd className="mt-2">{children}</dd> : null}
    </div>
  );
}

// Indicador de uso do DUA: sem pílula de "bom" ou "atenção", porque não é nota.
// Sem denominador, mostra "sem base" (nunca 0%).
// O anel é azul-claro (informação) e fica fora da leitura de tela: o valor,
// ou "sem base", já está escrito ao lado. Sem base, o anel fica sem arco.
function DuaIndicatorCard({ ringId, label, definition, unit, numerator, denominator, value, noBaseText, footer }: {
  ringId: string; label: string; definition: string; unit: string; numerator: number; denominator: number; value: number | null; noBaseText: string; footer: string;
}) {
  return (
    <article className="dash-card flex min-w-0 flex-col">
      <CardHeader title={label} />
      <div className="flex min-w-0 items-center gap-4">
        <div aria-hidden className="shrink-0">
          <RingStat id={ringId} value={value} label={label} size={64} color={SIGNAL.cyan}><span /></RingStat>
        </div>
        <div className="min-w-0">
          {value === null
            ? <p className="text-sm font-medium leading-snug text-ink-soft">{noBaseText}</p>
            : <p className="font-display text-3xl font-bold leading-none tracking-tight text-ink">{value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p>}
          <p className="mt-2 text-sm text-ink">{numerator} de {denominator} {unit}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-soft">{definition}</p>
      <p className="mt-auto pt-3 text-xs leading-relaxed text-ink-soft">{footer}</p>
    </article>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string; escola?: string; indicador?: string }> }) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffOrNetwork(user.role)) redirect("/");
  await recordJourneyMark(user.id, "painel");

  const period = parsePeriod(filters.periodo);
  const gaugeKey = parseGauge(filters.indicador);
  const data = await loadDashboard(user, { period, school: filters.escola });
  const { scope, overview: o, attention: a, journey: j, gauges: g, calendar: cal, learning: l, records: r, activities: act, ai, profile: p, family: f, resources: res, team } = data;
  // Mesmo recorte e período do painel; null para quem não vê os indicadores do DUA.
  const dua = await duaIndicators(user, { start: scope.start, now: scope.now, schoolId: scope.schoolId, schoolName: scope.schoolName });
  const periodText = PERIODS[period].toLowerCase();
  const today = todayInBrazil(scope.now);
  const upcomingDates = upcomingEvents(today).slice(0, 4);
  const updatedAt = scope.now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const href = (changes: { periodo?: DashboardPeriod; indicador?: DashboardGauge }) => {
    const params = new URLSearchParams();
    const periodo = changes.periodo ?? period;
    const indicador = changes.indicador ?? gaugeKey;
    if (periodo !== "ano") params.set("periodo", periodo);
    if (scope.network && scope.schoolId) params.set("escola", scope.schoolId);
    if (indicador !== "jornada") params.set("indicador", indicador);
    const query = params.toString();
    return query ? `/painel?${query}` : "/painel";
  };

  // ---------- Medidor do destaque ----------
  const gauge = (() => {
    if (gaugeKey === "jornada") {
      return {
        value: j.completion,
        pill: { tone: (j.complete > 0 ? "good" : "neutral") as Tone, text: `${j.complete} de ${o.students} completos` },
        description: "Média das 5 etapas concluídas por estudante: estudo de caso, perfil, plano com objetivo, atividade preparada e aula registrada no período.",
      };
    }
    const current = g[gaugeKey];
    const delta = current.value !== null && current.previous !== null ? current.value - current.previous : null;
    const pill = current.value === null ? { tone: "neutral" as Tone, text: "Sem registros" }
      : delta === null ? { tone: "neutral" as Tone, text: period === "tudo" ? "Todo o histórico" : "Sem comparação" }
        : delta > 0 ? { tone: "good" as Tone, text: `▲ ${delta} pts` }
          : delta < 0 ? { tone: "alert" as Tone, text: `▼ ${Math.abs(delta)} pts` }
            : { tone: "neutral" as Tone, text: "= Estável" };
    return {
      value: current.value,
      pill,
      deltaText: delta === null ? (current.value === null ? null : "não há registros no período anterior para comparar") : `${Math.abs(delta)} pontos ${delta >= 0 ? "a mais" : "a menos"} que no período anterior`,
      description: gaugeKey === "participacao"
        ? `Registros de aula em que o estudante participou plenamente · ${periodText} (${plural(current.records, "registro", "registros")}).`
        : `Registros de aula em que o critério de sucesso do objetivo foi atingido · ${periodText} (${plural(current.records, "registro", "registros")}).`,
    };
  })();
  const scopePhrase = scope.schoolName ? (scope.network ? `da ${scope.schoolName}` : "da sua escola") : "da rede";

  // ---------- Cartões de situação ----------
  const recordShare = o.students ? o.studentsWithRecord / o.students : 0;
  // Só participação e critério têm o período anterior calculado (gauges); os
  // demais fatores ficam sem comparação, em vez de uma comparação inventada.
  const factors: Factor[] = [
    {
      title: "Plano individual", value: `${o.planCoverage ?? 0}%`,
      tone: (o.planCoverage ?? 0) >= 80 ? "good" : "alert", status: (o.planCoverage ?? 0) >= 80 ? "Em dia" : "Atenção",
      text: `${o.withActivePlan} de ${o.students} estudantes com plano ativo`, href: "#atencao",
    },
    {
      title: "Redução de apoio", value: o.reducedSupportPct === null ? "—" : `${o.reducedSupportPct}%`,
      tone: o.reducedSupportPct === null ? "neutral" : o.reducedSupportPct >= 50 ? "good" : o.reducedSupportPct > 0 ? "mid" : "alert",
      status: o.reducedSupportPct === null ? "Sem dados" : o.reducedSupportPct >= 50 ? "Avançando" : o.reducedSupportPct > 0 ? "Em progresso" : "Atenção",
      text: `${o.reducedSupport} de ${o.measurableObjectives} objetivos já pedem menos apoio`, href: "#objetivos",
    },
    {
      title: "Registros de aula", value: o.records,
      tone: recordShare === 1 ? "good" : recordShare >= 0.5 ? "mid" : "alert", status: recordShare === 1 ? "Em dia" : recordShare >= 0.5 ? "Parcial" : "Atenção",
      text: `${o.studentsWithRecord} de ${o.students} estudantes com registro · ${periodText}`, href: "#aulas",
      trend: { delta: o.previousRecords === null ? null : o.records - o.previousRecords, better: "up", caption: "registros vs. período anterior" },
    },
    {
      title: "Objetivos", value: o.activeObjectives,
      tone: o.achievedObjectives > 0 ? "good" : "neutral", status: o.achievedObjectives > 0 ? `${o.achievedObjectives} alcançados` : "Em andamento",
      text: `em acompanhamento · ${o.objectivesInReview} em revisão`, href: "#objetivos",
      trend: { delta: pointsDelta(g.criterio), better: "up", caption: "critério atingido vs. período anterior" },
    },
    {
      title: "Atividades", value: o.preparedActivities,
      tone: o.pendingSuggestions > 0 ? "mid" : "good", status: o.pendingSuggestions > 0 ? `${o.pendingSuggestions} para avaliar` : "Em dia",
      text: `preparadas para usar · ${periodText}`, href: "#atividades",
    },
    {
      title: "Família", value: f.notes,
      tone: f.notes > 0 ? "good" : "neutral", status: f.notes > 0 ? "Participando" : "Sem registros",
      text: `conquistas registradas em casa · ${periodText}`, href: "#familia",
    },
  ];

  const counters: { value: number; label: string; tone: Tone; href: string }[] = [
    { value: a.studentsWithAlerts, label: "Estudantes com avisos", tone: a.studentsWithAlerts ? "alert" : "good", href: "#atencao" },
    { value: a.reviewsSoon, label: `Revisões de plano em ${a.reviewHorizonDays} dias`, tone: a.reviewsSoon ? "mid" : "neutral", href: "#atencao" },
    { value: o.pendingSuggestions, label: "Sugestões para avaliar", tone: o.pendingSuggestions ? "mid" : "neutral", href: "#atividades" },
    { value: l.advancing, label: "Objetivos avançando", tone: l.advancing ? "good" : "neutral", href: "#objetivos" },
  ];

  const sections: [string, string][] = [
    ["visao-geral", "Visão geral"], ["atencao", "Estudantes"], ["objetivos", "Objetivos"], ["aulas", "Aulas"], ["atividades", "Atividades"],
    ...(dua ? [["dua", "DUA"] as [string, string]] : []),
    ["ia", "IA"], ["perfil", "Perfil"], ["familia", "Família"], ["recursos", "Recursos e datas"],
    ...(scope.network ? [["equipe", "Equipe"] as [string, string]] : []),
  ];

  // ---------- Planejamento com DUA (uso e documentação) ----------
  const duaPeriod = dua ? `${PERIODS[period]}${dua.period.start ? ` (de ${formatDate(dua.period.start)} a ${formatDate(dua.period.end)})` : ` (até ${formatDate(dua.period.end)})`}` : "";
  const duaDecisions: ChartSegment[] = dua ? [
    { key: "aceito", label: AI_BLOCK_DECISION_LABEL.aceito, value: dua.decisions.aceito, color: SIGNAL.lime },
    { key: "editado", label: AI_BLOCK_DECISION_LABEL.editado, value: dua.decisions.editado, color: SIGNAL.cyan },
    // Recusar também é decisão profissional: sem a cor de alerta.
    { key: "recusado", label: AI_BLOCK_DECISION_LABEL.recusado, value: dua.decisions.recusado, color: SIGNAL.yellow },
  ] : [];

  const support = l.support;
  const supportDrop = support.initial !== null && support.latest !== null ? oneDecimal(oneDecimal(support.initial) - oneDecimal(support.latest)) : null;
  const participation = withSegmentColors(r.participation);
  const participationTotal = participation.reduce((sum, segment) => sum + segment.value, 0);
  const statusSegments = withSegmentColors(act.byStatus);
  const tableRows = a.students.slice(0, 8);
  // Secretaria: a rede em números (seção 10). No lugar da lista com nomes, os
  // avisos agrupados por escola.
  const nominal = user.role !== "secretaria";
  const schoolRows = nominal ? [] : [...a.students.reduce((map, student) => {
    const row = map.get(student.school) ?? { school: student.school, students: 0, withAlerts: 0, noPlan: 0, overdue: 0 };
    row.students += 1;
    if (student.alerts.length) row.withAlerts += 1;
    if (student.plan === "sem_plano") row.noPlan += 1;
    if (student.plan === "vencido") row.overdue += 1;
    return map.set(student.school, row);
  }, new Map<string, { school: string; students: number; withAlerts: number; noPlan: number; overdue: number }>()).values()].sort((x, y) => y.withAlerts - x.withAlerts || x.school.localeCompare(y.school, "pt-BR"));
  const strategyMax = Math.max(1, ...r.strategies.map((item) => item.value));
  const strategyHalf = Math.ceil(r.strategies.length / 2);
  const topUses = Math.max(1, ...res.top.map((item) => item.uses));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-3xl">Painel de indicadores</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">{scope.schoolName ?? "Toda a rede"}</span>
            {o.students ? <> · <span data-testid="total-estudantes">{plural(o.students, "estudante", "estudantes")}</span> ({o.withAEE} no AEE) · {plural(o.schools, "escola", "escolas")} · {plural(o.classes, "turma", "turmas")}</> : null}
            {" "}· {PERIODS[period]}{scope.start ? ` (desde ${formatDate(scope.start)})` : ""} · atualizado em {updatedAt}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <nav aria-label="Período" className="flex flex-wrap gap-1 rounded-2xl border border-line bg-surface-muted p-1 sm:rounded-full">
            {(Object.keys(PERIODS) as DashboardPeriod[]).map((key) => (
              <Link key={key} href={href({ periodo: key })} aria-current={key === period ? "page" : undefined} className="inline-flex min-h-9 items-center rounded-full px-3.5 text-sm text-ink-soft transition-colors hover:text-ink aria-[current=page]:bg-paper-raised aria-[current=page]:font-medium aria-[current=page]:text-ink aria-[current=page]:shadow-e1">
                {PERIODS[key]}
              </Link>
            ))}
          </nav>
          {scope.network ? (
            <form method="get" action="/painel" className="flex w-full items-center gap-2 sm:w-auto">
              {period !== "ano" ? <input type="hidden" name="periodo" value={period} /> : null}
              {gaugeKey !== "jornada" ? <input type="hidden" name="indicador" value={gaugeKey} /> : null}
              <label htmlFor="escola" className="text-sm text-ink-soft">Escola</label>
              {/* w-full: sem ele, o nome de escola mais longo vira a largura mínima e a página rola de lado a 320 px. */}
              <select id="escola" name="escola" defaultValue={scope.schoolId ?? ""} className="min-h-10 w-full min-w-0 flex-1 rounded-full border border-line bg-paper-raised px-3.5 text-sm sm:max-w-60">
                <option value="">Toda a rede</option>
                {scope.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
              <button type="submit" className="min-h-10 rounded-full bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong">Ver</button>
            </form>
          ) : null}
          <PrintButton label="Imprimir" />
        </div>
      </div>

      {o.students === 0 ? (
        <div>
          <EmptyState character="resources" title="Ainda não há estudantes ativos neste recorte" hint="Quando houver estudantes cadastrados, os indicadores aparecem aqui." action={<Link href="/estudantes/novo" className="task-action">Cadastrar estudante</Link>} />
        </div>
      ) : (
        <div className="dash-board">
          <nav aria-label="Seções do painel" className="sticky top-0 z-20 -mx-1 mb-3.5 flex gap-1.5 overflow-x-auto rounded-full bg-surface-muted/95 p-1 backdrop-blur scrollbar-none print:hidden">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-paper-raised/70 px-4 text-sm text-ink-soft transition-colors hover:bg-brand hover:text-white">{label}</a>
            ))}
          </nav>

          <section id="visao-geral" aria-label="Visão geral" className="grid scroll-mt-20 grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
            {/* Coluna da direita (vem primeiro no celular): destaque e cartões de situação */}
            <div className="contents xl:order-2 xl:flex xl:min-w-0 xl:flex-col xl:gap-3.5">
              <section aria-labelledby="destaque-titulo" className="dash-hero relative order-1 min-w-0 px-5 pb-6 pt-8 text-center sm:px-8 xl:order-none">
                <Character variant="resources" className="absolute right-4 top-4 hidden w-16 sm:block xl:w-20" />
                <h2 id="destaque-titulo" className="font-display text-3xl font-medium leading-tight tracking-tight text-ink sm:text-4xl">Olá, {firstName(user.name)}</h2>
                <p className="mt-1 text-xl font-light leading-snug text-ink sm:text-2xl">Este é o acompanhamento {scopePhrase}</p>
                <nav aria-label="Indicador do medidor" className="mx-auto mt-5 inline-flex max-w-full flex-wrap justify-center gap-1 rounded-full border border-black/5 bg-white/40 p-1">
                  {(Object.keys(GAUGES) as DashboardGauge[]).map((key) => (
                    <Link key={key} href={href({ indicador: key })} scroll={false} aria-current={key === gaugeKey ? "page" : undefined} className="inline-flex min-h-9 items-center rounded-full px-4 text-sm text-ink-soft transition-colors hover:text-ink aria-[current=page]:bg-white aria-[current=page]:text-ink aria-[current=page]:shadow-e1">
                      {GAUGES[key]}
                    </Link>
                  ))}
                </nav>
                <div className="relative mx-auto mt-3 max-w-[400px]">
                  <HatchedGauge value={gauge.value} label={`${GAUGES[gaugeKey]}: ${gauge.value === null ? "sem dados" : `${gauge.value}%`}, em uma escala de 0 a 100%.`} />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
                    <StatusPill tone={gauge.pill.tone}>{gauge.pill.text}{"deltaText" in gauge && gauge.deltaText ? <span className="sr-only">: {gauge.deltaText}</span> : null}</StatusPill>
                    <p className="mt-1 font-display text-5xl font-bold leading-none tracking-tight text-ink sm:text-5xl">{gauge.value ?? "—"}{gauge.value !== null ? <span className="text-[0.5em]">%</span> : null}</p>
                  </div>
                </div>
                <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-ink-soft">{gauge.description}</p>
                {scope.network
                  ? <a href="#atencao" className="pill-action mx-auto mt-5 max-w-sm">Ver estudantes com avisos</a>
                  : <Link href="/estudantes?acao=registrar" className="pill-action mx-auto mt-5 max-w-sm">Registrar uma aula</Link>}
              </section>

              <div className="order-2 grid min-w-0 grid-cols-2 gap-3.5 xl:order-none 2xl:grid-cols-3">
                {factors.map((factor) => <FactorCard key={factor.title} {...factor} />)}
              </div>

            </div>

            {/* Coluna da esquerda: jornada, contadores, estudantes, apoio, participação e meses */}
            <div className="contents xl:order-1 xl:flex xl:min-w-0 xl:flex-col xl:gap-3.5">
              <section id="jornada" aria-labelledby="jornada-titulo" className="dash-card order-3 min-w-0 scroll-mt-20 xl:order-none">
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="jornada-titulo" className="text-base font-medium tracking-tight">Jornada do acompanhamento</h2>
                  <p className="text-xs text-ink-soft">{j.completion ?? 0}% concluída{j.caseStudyDrafts ? ` · ${plural(j.caseStudyDrafts, "estudo de caso em andamento", "estudos de caso em andamento")}` : ""}</p>
                </div>
                <div className="-mx-1 overflow-x-auto scrollbar-none" tabIndex={0} role="region" aria-label="Etapas da jornada do acompanhamento (role para o lado no celular)">
                  <ol className="stepper">
                    {j.steps.map((step) => {
                      const complete = step.done === o.students;
                      return (
                        <li key={step.key} className="stepper-item">
                          <span className={`relative z-10 flex size-[34px] items-center justify-center rounded-full text-xs font-semibold ${complete ? "bg-brand text-white" : step.done > 0 ? "border-2 border-signal-lime bg-signal-lime-soft text-ink-strong" : "border-2 border-dashed border-[#bfd0d8] bg-paper-raised text-ink-soft"}`}>
                            {complete ? <Check size={17} strokeWidth={3} aria-hidden /> : step.done}
                          </span>
                          <span className="mt-2 text-xs text-ink-soft">Etapa {step.step}</span>
                          <span className="text-sm font-medium leading-snug text-ink">{step.label}</span>
                          <span className="mt-0.5 text-xs text-ink-soft">{step.done} de {o.students}</span>
                          {step.here ? <span className="mt-1.5 rounded-full bg-signal-yellow-soft px-2 py-0.5 text-xs font-medium text-ink-strong">{step.here} {step.step === 5 ? "na rotina" : "nesta etapa"}</span> : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>

              <div className="order-3 flex min-w-0 flex-wrap gap-2.5 xl:order-none">
                {counters.map((counter) => (
                  <a key={counter.label} href={counter.href} className="inline-flex min-h-12 items-center gap-3 rounded-full bg-paper-raised py-1.5 pl-1.5 pr-4 text-sm font-medium text-ink transition-shadow hover:shadow-e2">
                    <span className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold ${TONE_CLASSES[counter.tone]}`}>{counter.value}</span>
                    {counter.label}
                  </a>
                ))}
              </div>

              <section id="atencao" aria-labelledby="atencao-titulo" className="dash-card order-3 min-w-0 scroll-mt-20 xl:order-none">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="atencao-titulo" className="text-base font-medium tracking-tight">{nominal ? "Estudantes" : "Avisos por escola"}</h2>
                    <p className="mt-1 text-xs text-ink-soft">{nominal ? "Ordenados por avisos. Só aparecem estudantes aos quais você tem acesso." : "Números por escola, sem nomes. Para abrir a ficha de um estudante, busque em Estudantes e informe o motivo."}</p>
                  </div>
                  {nominal ? <Link href="/estudantes" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm text-ink transition-colors hover:border-ink-strong">Ver todos <ArrowRight size={15} aria-hidden /></Link> : null}
                </div>
                {!nominal ? (
                  <div className="-mx-1 overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Avisos de acompanhamento por escola</caption>
                      <thead>
                        <tr className="text-left text-xs text-ink-soft">
                          <th scope="col" className="px-1 py-2.5 font-normal">Escola</th>
                          <th scope="col" className="px-1 py-2.5 text-right font-normal">Estudantes</th>
                          <th scope="col" className="px-1 py-2.5 text-right font-normal">Com aviso</th>
                          <th scope="col" className="hidden px-1 py-2.5 text-right font-normal sm:table-cell">Sem plano</th>
                          <th scope="col" className="hidden px-1 py-2.5 text-right font-normal sm:table-cell">Revisão vencida</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line border-t border-line tabular-nums">
                        {schoolRows.map((row) => (
                          <tr key={row.school}>
                            <th scope="row" className="px-1 py-3 text-left font-medium text-ink">{row.school}</th>
                            <td className="px-1 py-3 text-right">{row.students}</td>
                            <td className="px-1 py-3 text-right">{row.withAlerts ? <StatusPill tone="alert">{row.withAlerts}</StatusPill> : <StatusPill tone="good">0</StatusPill>}</td>
                            <td className="hidden px-1 py-3 text-right sm:table-cell">{row.noPlan}</td>
                            <td className="hidden px-1 py-3 text-right sm:table-cell">{row.overdue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : tableRows.length ? (
                  <div className="-mx-1">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Estudantes, situação do plano, último registro e avisos</caption>
                      <thead>
                        <tr className="text-left text-xs text-ink-soft">
                          <th scope="col" className="px-1 py-2.5 font-normal">Estudante</th>
                          <th scope="col" className="hidden px-1 py-2.5 font-normal sm:table-cell">Plano</th>
                          <th scope="col" className="hidden whitespace-nowrap px-1 py-2.5 font-normal md:table-cell">Último registro</th>
                          <th scope="col" className="px-1 py-2.5 font-normal">Situação</th>
                          <th scope="col" className="w-10 px-1 py-2.5"><span className="sr-only">Próximo passo</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line border-t border-line">
                        {tableRows.map((student) => (
                          <tr key={student.id} className="align-top">
                            <td className="px-1 py-3">
                              <Link href={`/estudantes/${student.id}`} className="font-medium text-ink hover:underline">{student.name}</Link>
                              <p className="mt-0.5 text-xs text-ink-soft">{student.className}{scope.schoolId ? "" : ` · ${student.school}`}</p>
                            </td>
                            <td className="hidden px-1 py-3 sm:table-cell">
                              {student.plan === "ativo" ? <><p>Ativo</p><p className="mt-0.5 text-xs text-ink-soft">revisão {student.reviewDate ? formatDateShort(student.reviewDate) : ""}</p></>
                                : student.plan === "vencido" ? <><p className="text-signal-orange-ink">Revisão vencida</p><p className="mt-0.5 text-xs text-ink-soft">desde {student.reviewDate ? formatDateShort(student.reviewDate) : ""}</p></>
                                  : <p className="text-signal-orange-ink">Sem plano</p>}
                            </td>
                            <td className="hidden whitespace-nowrap px-1 py-3 text-ink-soft md:table-cell">{student.lastRecord ? shortDate(student.lastRecord) : "Nenhum"}</td>
                            <td className="px-1 py-3">
                              <StatusPill tone={student.alerts.length ? "alert" : "good"}>{student.alerts.length ? plural(student.alerts.length, "aviso", "avisos") : "Em dia"}</StatusPill>
                              {student.alerts.length ? <p className="mt-1 text-xs leading-snug text-ink-soft">{student.alerts.map((kind) => SHORT_ALERTS[kind]).join(" · ")}</p> : null}
                            </td>
                            <td className="px-1 py-2.5 text-right">
                              <Link href={student.next.href} className="circle-link" title={`Próximo passo: ${student.next.label}`} aria-label={`${student.name}: ${student.next.label}`}><ArrowUpRight size={16} aria-hidden /></Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-ink-soft">Nenhum estudante deste recorte está vinculado ao seu acesso.</p>}
                {nominal && a.students.length > tableRows.length ? <p className="mt-2 text-xs text-ink-soft">Mostrando {tableRows.length} de {a.students.length}. <Link href="/estudantes" className="font-medium text-ink underline">Ver todos os estudantes</Link></p> : null}
                <p className="mt-3 rounded-2xl bg-surface-muted/70 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
                  <span className="font-medium text-ink">Avisos em {scope.schoolName ?? "toda a rede"}:</span>{" "}
                  {a.byKind.map((kind) => `${kind.value} ${ALERT_LABELS[kind.key].charAt(0).toLowerCase()}${ALERT_LABELS[kind.key].slice(1)}`).join(" · ")}.{nominal ? " O botão ↗ leva ao próximo passo de cada estudante." : ""}
                </p>
              </section>

              <div className="order-3 grid min-w-0 gap-3.5 md:grid-cols-2 xl:order-none">
                <section aria-labelledby="apoio-titulo" className="dash-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 id="apoio-titulo" className="text-base font-medium tracking-tight">Nível de apoio</h2>
                    {supportDrop !== null && support.target !== null ? <TrendBadge delta={-supportDrop} better="down" text={supportDrop === 0 ? "Sem mudança desde o início" : `${supportDrop > 0 ? "−" : "+"}${decimal(Math.abs(supportDrop))} desde o início`} /> : null}
                  </div>
                  {support.initial !== null && support.latest !== null && support.target !== null ? (
                    <>
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                        {supportDrop !== null && supportDrop > 0 ? `Em média, os estudantes já precisam de ${decimal(supportDrop)} ${supportDrop >= 2 ? "níveis" : "nível"} de apoio a menos do que no início.` : "O nível de apoio médio ainda não diminuiu em relação ao início."} Média de {plural(support.objectives, "objetivo", "objetivos")} com registro.
                      </p>
                      <SupportScale initial={support.initial} latest={support.latest} target={support.target} />
                      {/* Legenda compacta: o marcador é o mesmo da escala, e o número e o nome vêm em texto. */}
                      <dl className="mt-4 flex min-w-0 flex-wrap gap-1.5">
                        {([["No início", support.initial, "rounded-full border-2 border-ink-strong bg-white"], ["Agora", support.latest, "rounded-full bg-ink-strong"], ["Meta", support.target, "rotate-45 rounded-[2px] border-2 border-ink-strong bg-white"]] as const).map(([label, value, marker]) => (
                          <div key={label} className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 rounded-full bg-surface-muted/70 py-1.5 pl-2.5 pr-3 text-xs">
                            <dt className="inline-flex items-center gap-1.5 self-center text-ink-soft"><span aria-hidden className={`inline-block size-2.5 shrink-0 ${marker}`} />{label}</dt>
                            <dd className="font-display font-bold text-base leading-none tracking-tight text-ink tabular-nums">{decimal(value)}</dd>
                            <dd className="text-ink-soft">{supportInfo(Math.round(value)).label}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : <p className="mt-2 text-sm text-ink-soft">Ainda não há registros de aula ligados a objetivos.</p>}
                </section>

                <section aria-labelledby="participacao-titulo" className="dash-card">
                  <h2 id="participacao-titulo" className="text-base font-medium tracking-tight">Participação nas aulas</h2>
                  {participationTotal ? (
                    <div className="mt-4 flex flex-wrap items-center gap-5">
                      <HatchedDonut id="rosca-participacao" segments={participation} label={`Participação: ${participation.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`} size={140} thickness={18}>
                        <span className="font-display text-3xl leading-none tracking-tight">{o.fullParticipationPct ?? 0}%</span>
                        <span className="mt-1 text-xs leading-tight text-ink-soft">{o.fullParticipation} de {o.records}<br />plenas</span>
                      </HatchedDonut>
                      <div className="min-w-[150px] flex-1">
                        <p className="mb-3 text-xs leading-relaxed text-ink-soft">Registre a cada aula: o ritmo dos registros mostra o que está funcionando.</p>
                        <Legend segments={participation} />
                      </div>
                    </div>
                  ) : <p className="mt-2 text-sm text-ink-soft">Nenhum registro de aula · {periodText}.</p>}
                </section>
              </div>

              <section aria-labelledby="meses-titulo" className="dash-card order-3 min-w-0 xl:order-none">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="meses-titulo" className="text-base font-medium tracking-tight">Meses com registro de aula</h2>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                      {cal.schoolMonths ? `Houve registro em ${cal.monthsWithRecords} de ${plural(cal.schoolMonths, "mês letivo", "meses letivos")} desde o primeiro registro.` : "Ainda não há registros de aula."} Histórico completo, sem o filtro de período.
                    </p>
                  </div>
                  {cal.gaps ? <StatusPill tone="alert">{plural(cal.gaps, "mês sem registro", "meses sem registro")}</StatusPill> : cal.schoolMonths ? <StatusPill tone="good">Sem lacunas</StatusPill> : null}
                </div>
                <MonthGrid years={cal.years} />
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
                  <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border-2 border-[#cfe6b4] bg-signal-lime" />Com registro</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="flex size-3 items-center justify-center rounded-full bg-signal-orange" />Mês letivo sem registro</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border border-dashed border-[#bfd0d8]" />Mês atual</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border border-line bg-paper" />Recesso (janeiro)</li>
                </ul>
              </section>
            </div>
            {/* IA numa faixa inteira, depois das duas colunas: assim nenhuma coluna fica com um vão embaixo. */}
            <section id="ia" aria-labelledby="ia-titulo" className="dash-card order-4 min-w-0 scroll-mt-20 xl:order-3 xl:col-span-2">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 id="ia-titulo" className="text-base font-medium tracking-tight">Inteligência artificial</h2>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">A IA propõe e o professor decide. Nomes, contatos e documentos são trocados por marcadores antes do envio.</p>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal-lime-soft text-ink-strong"><ShieldCheck size={17} aria-hidden /></span>
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-start lg:gap-4">
              <dl className="grid gap-1.5 text-sm">
                {([
                  ["Claude", "planos e atividades", ai.providers.claude],
                  ["DeepSeek", "reserva", ai.providers.deepseek],
                  ["OpenAI", "imagens de apoio", ai.providers.openai],
                ] as const).map(([name, purpose, active]) => (
                  <div key={name} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-surface-muted/70 px-3.5 py-2">
                    <dt className="min-w-0"><span className="font-medium text-ink">{name}</span> <span className="text-ink-soft">· {purpose}</span></dt>
                    <dd>{active ? <StatusPill tone="good"><Check size={12} strokeWidth={3} aria-hidden /> Ativo</StatusPill> : <StatusPill tone="neutral">Não configurado</StatusPill>}</dd>
                  </div>
                ))}
              </dl>
              <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <AiStat label="Planos propostos pela IA" value={ai.planProposals.ia} detail={`${plural(ai.planProposals.regras, "proposto", "propostos")} pelo motor de regras`} />
                <AiStat label="Propostas aguardando revisão" value={ai.draftsPending} detail={ai.draftsPending ? "o professor decide" : "nenhuma pendente"} />
                <AiStat label="Atividades criadas pela IA" value={ai.activities.total} wide detail={ai.activities.adhesion === null ? "Adesão: sem atividades avaliadas para calcular." : `Adesão de ${ai.activities.adhesion}%: ${ai.activities.used} de ${plural(ai.activities.decided, "avaliada foi aceita ou aplicada", "avaliadas foram aceitas ou aplicadas")}.`}>
                  {ai.activities.adhesion !== null ? <UsageMeter value={ai.activities.adhesion} max={100} color={SIGNAL.cyan} /> : null}
                </AiStat>
                <AiStat label="Imagens geradas" value={ai.images} />
                <AiStat label="Envios à IA de reserva" value={ai.deepseekSends} />
              </dl>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">Números de {periodText}. Cada envio à IA de reserva fica no histórico de acessos que a família consulta.</p>
              <Link href="/estudantes?acao=preparar" className="pill-action mt-4 sm:w-fit"><Sparkles size={16} aria-hidden /> Preparar uma atividade</Link>
            </section>
          </section>

          <Section id="objetivos" title="Objetivos e aprendizagem" description="Avançar é precisar de menos apoio para a mesma tarefa, na escala de 0 (independente) a 5 (apoio físico total).">
            <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              <div className="dash-card">
                <CardHeader title="Como estão os objetivos" hint="Tendência dos últimos registros de cada objetivo em acompanhamento." />
                <StackedBar segments={withSegmentColors(l.trends)} empty="Nenhum objetivo em acompanhamento." />
              </div>
              <div className="dash-card">
                <CardHeader title="Objetivos por área" />
                <BarList rows={l.byDimension.map((row) => ({ ...row, detail: plural(row.achieved, "alcançado", "alcançados") }))} empty="Nenhum objetivo cadastrado." />
              </div>
              <div className="dash-card">
                <CardHeader title="Critério de sucesso" hint={`Registros de aula · ${periodText}.`} />
                <StackedBar segments={withSegmentColors(l.criterion)} />
              </div>
              <div className="dash-card">
                <CardHeader title="Sondagem" hint={`Com linha de base: ${smallNumber(l.assessment.withBaseline)} de ${plural(l.assessment.total, "estudante", "estudantes")}. Em dia: reaplicada nas últimas 12 semanas.`} />
                <p className="font-display text-3xl font-bold tracking-tight text-ink"><span className="tabular-nums">{smallNumber(l.assessment.upToDate)}</span> <span className="text-base text-ink-soft">em dia</span></p>
                {l.assessment.improved.some((row) => row.value > 0) ? (
                  <ul className="mt-3 grid gap-1 text-sm text-ink-soft">
                    {l.assessment.improved.filter((row) => row.value > 0).map((row) => <li key={row.label}><span className="text-ink">{row.label}:</span> {smallNumber(row.value)} com menos apoio que na linha de base</li>)}
                  </ul>
                ) : null}
              </div>
              <div className="dash-card">
                <CardHeader title="Relatórios do período" hint="Estudantes com relatório validado e publicado para a família nos últimos 6 meses." />
                <p className="font-display text-3xl font-bold tracking-tight text-ink"><span className="tabular-nums">{l.reports.covered}</span> <span className="text-base text-ink-soft">de {plural(l.reports.total, "estudante", "estudantes")}</span></p>
              </div>
              <div className="dash-card">
                <CardHeader title="Objetivos por componente da BNCC" hint={l.bncc.total ? `${l.bncc.linked} de ${l.bncc.total} objetivos ligados a uma habilidade da BNCC.` : undefined} />
                <BarList rows={l.bncc.byComponent} empty="Nenhum objetivo ligado à BNCC ainda." />
              </div>
            </div>
          </Section>

          <Section id="aulas" title="Aulas e registros" description="Cada registro em 3 toques mostra participação, apoio necessário e o que funcionou.">
            <div className="grid gap-3.5 xl:grid-cols-3">
              <div className="dash-card xl:col-span-2">
                <CardHeader title={r.weekly ? "Registros por semana" : "Registros por mês"} hint={`${PERIODS[period]}. Queda sustentada no ritmo de registros antecipa o abandono do acompanhamento.`} />
                {r.series.some((row) => row.value > 0) ? <ColumnChart rows={r.series} caption={r.weekly ? "Registros de aula por semana" : "Registros de aula por mês"} /> : <p className="text-sm text-ink-soft">Nenhum registro de aula · {periodText}.</p>}
              </div>
              <div className="dash-card">
                <CardHeader title="Quem registrou" />
                <BarList rows={r.byAuthor.map((row) => ({ ...row, label: ROLE_LABELS[row.key] ?? row.key }))} />
              </div>
              <div className="dash-card xl:col-span-3">
                <CardHeader title="Estratégias que mais funcionaram" hint={`Marcadas como “o que funcionou” nos registros · ${periodText}. O número é quantas vezes cada uma foi marcada.`} />
                {r.strategies.length ? (
                  // Duas colunas com a mesma escala, na ordem do ranking (de cima para baixo).
                  <div className="grid min-w-0 gap-x-8 gap-y-3 md:grid-cols-2">
                    <BarList rows={r.strategies.slice(0, strategyHalf)} max={strategyMax} />
                    {r.strategies.length > strategyHalf ? <BarList rows={r.strategies.slice(strategyHalf)} max={strategyMax} /> : null}
                  </div>
                ) : <p className="text-sm text-ink-soft">Sem estratégias registradas no período.</p>}
              </div>
            </div>
          </Section>

          <Section id="atividades" title="Atividades" description={`Atividades criadas · ${periodText}: sugeridas pelo motor de regras ou pelos agentes de IA, ou escritas pelo professor.`}>
            <div className="grid gap-3.5 md:grid-cols-2">
              <div className="dash-card">
                <CardHeader title="Situação das atividades" hint={`${plural(act.created, "atividade criada", "atividades criadas")} no período.`} />
                {act.created ? (
                  <div className="flex flex-wrap items-center gap-5">
                    <HatchedDonut id="rosca-atividades" segments={statusSegments} label={`Atividades: ${statusSegments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`} size={132} thickness={17}>
                      <span className="font-display text-3xl leading-none tracking-tight">{act.created}</span>
                      <span className="mt-1 text-xs text-ink-soft">criadas</span>
                    </HatchedDonut>
                    <div className="min-w-[160px] flex-1"><Legend segments={statusSegments} /></div>
                  </div>
                ) : <p className="text-sm text-ink-soft">Nenhuma atividade criada no período.</p>}
              </div>
              <div className="dash-card">
                <CardHeader title="Onde acontecem" />
                <BarList rows={act.byContext} empty="Nenhuma atividade criada no período." />
              </div>
              <div className="dash-card">
                <CardHeader title="Origem e adesão" hint="Adesão: aceitas ou aplicadas entre as que o professor já avaliou." />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Atividades por origem e adesão</caption>
                    <thead>
                      <tr className="text-xs text-ink-soft">
                        <th scope="col" className="pb-2.5 text-left font-normal">Origem</th>
                        <th scope="col" className="pb-2.5 text-right font-normal">Criadas</th>
                        <th scope="col" className="pb-2.5 text-right font-normal">Avaliadas</th>
                        <th scope="col" className="pb-2.5 text-right font-normal">Adesão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line border-t border-line">
                      {act.sources.map((source) => (
                        <tr key={source.source}>
                          <th scope="row" className="py-3 pr-2 text-left font-normal">{source.label}</th>
                          <td className="py-3 text-right tabular-nums">{source.total}</td>
                          <td className="py-3 text-right tabular-nums">{source.decided}</td>
                          <td className="py-3 text-right">{source.adhesion === null ? <span className="text-ink-soft">—</span> : <StatusPill tone={source.adhesion >= 70 ? "good" : source.adhesion >= 40 ? "mid" : "alert"}>{source.adhesion}%</StatusPill>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="dash-card">
                <CardHeader title="Por que as sugestões são rejeitadas" hint="Rejeição é dado para melhorar as sugestões, não reclamação." />
                {/* Amarelo, não laranja: rejeitar é decisão do professor, não alarme. */}
                <BarList rows={act.rejectReasons.map((reason) => ({ label: `“${reason.label}”`, value: reason.value }))} color={SIGNAL.yellow} empty="Nenhuma sugestão rejeitada no período." />
              </div>
            </div>
          </Section>

          {dua ? (
            <Section id="dua" title="Planejamento com DUA — uso e documentação" description={`Como a equipe está usando o planejamento com Desenho Universal para a Aprendizagem · ${duaPeriod} · ${dua.scopeLabel}.`}>
              <p className="mb-3.5 max-w-3xl rounded-2xl bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink">
                <strong className="font-medium">Estes números medem uso e documentação, não aprendizagem.</strong> Não existe nota, selo nem “conformidade DUA”: nenhum número aqui avalia professor, escola ou estudante. Quando não há o que contar no período, aparece “{dua.noBaseText.toLowerCase()}”, e não 0%.
                {canPlanDua(user) ? <> <Link href="/planejamento" className="font-medium text-ink underline">Abrir o planejamento</Link></> : null}
              </p>
              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {dua.indicators.map(({ key, ...indicator }) => (
                  <DuaIndicatorCard key={key} ringId={`anel-dua-${key}`} {...indicator} noBaseText={dua.noBaseText} footer={`${duaPeriod} · ${dua.scopeLabel}`} />
                ))}
                <div className="dash-card min-w-0">
                  <CardHeader title="Decisões sobre as sugestões" hint={`Blocos de sugestão (IA ou regras) revisados pela equipe · ${duaPeriod} · ${dua.scopeLabel}.`} />
                  <StackedBar segments={duaDecisions} empty={`${dua.noBaseText}: nenhum bloco de sugestão revisado.`} />
                  {dua.decisions.total ? <p className="mt-3 text-xs text-ink-soft">{dua.decisions.aceito} aceitos sem alteração, {dua.decisions.editado} aceitos com edição e {dua.decisions.recusado} recusados, de {plural(dua.decisions.total, "bloco revisado", "blocos revisados")}.</p> : null}
                </div>
              </div>
            </Section>
          ) : null}

          <Section id="perfil" title="Perfil dos estudantes" description="Dados agregados, sem identificar ninguém: orientam formação, compra de recursos e adaptação dos ambientes.">
            {p.caa.withoutResources > 0 ? (
              <div className="mb-3.5 flex items-start gap-3 rounded-2xl bg-signal-yellow-soft p-4 sm:p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal-yellow text-ink-strong"><Lightbulb size={17} aria-hidden /></span>
                <p className="text-sm leading-relaxed text-ink">
                  <strong>Leitura para a gestão:</strong> {plural(p.caa.total, "estudante se comunica", "estudantes se comunicam")} por comunicação alternativa ou acionador, e {p.caa.withoutResources} ainda {p.caa.withoutResources === 1 ? "não tem" : "não têm"} recursos de acessibilidade registrados. É um indicativo para compra de materiais e formação.
                </p>
              </div>
            ) : null}
            <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {p.bySchool.length > 1 ? <div className="dash-card"><CardHeader title="Estudantes por escola" /><BarList rows={p.bySchool} /></div> : null}
              <div className="dash-card"><CardHeader title="Etapa de ensino" /><BarList rows={p.byStage} /></div>
              <div className="dash-card"><CardHeader title="Canais de comunicação" hint="Indica a demanda por comunicação alternativa (CAA)." /><BarList rows={p.channels} empty="Nenhum perfil preenchido." /></div>
              <div className="dash-card"><CardHeader title="Barreiras ativas" /><BarList rows={p.barriers} color={SIGNAL.yellow} empty="Nenhuma barreira registrada." /></div>
              <div className="dash-card"><CardHeader title="Hipersensibilidade sensorial" hint="Orienta a adaptação de salas e eventos." /><BarList rows={p.hypersensitivity} color={SIGNAL.cyan} empty="Nenhuma hipersensibilidade registrada." /></div>
            </div>
            {p.withoutProfile ? <p className="mt-3 px-1 text-xs text-ink-soft">{plural(p.withoutProfile, "estudante ainda não tem", "estudantes ainda não têm")} o perfil de aprendizagem preenchido e não entram nestes números.</p> : null}
            {p.practices.length ? (
              <>
                <h3 className="mb-1 mt-7 px-1 text-base font-medium">Banco de práticas por perfil</h3>
                <p className="mb-3.5 px-1 text-sm text-ink-soft">Estratégias que funcionaram em aulas com boa resposta, agrupadas por perfil · {periodText}.</p>
                <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                  {p.practices.map((cluster) => (
                    <div key={cluster.label} className="dash-card">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-ink">{cluster.label}</h4>
                        <StatusPill tone="good">{plural(cluster.records, "registro", "registros")}</StatusPill>
                      </div>
                      <BarList rows={cluster.top} empty="Sem estratégias marcadas para este perfil." />
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </Section>

          <Section id="familia" title="Família e rede de apoio" description="Participação da família e articulação com saúde e assistência social.">
            <div className="grid gap-3.5 lg:grid-cols-3">
              <div className="grid gap-3.5 sm:grid-cols-2 lg:col-span-2">
                <StatTile label="Conquistas registradas pela família" value={f.notes} hint={PERIODS[period]} />
                <StatTile
                  label="Registros de aula feitos em casa" value={f.records} hint={PERIODS[period]}
                  chart={<ShareRing id="anel-familia-registros" part={f.records} whole={o.records} label="Registros de aula feitos em casa" caption={`dos ${plural(o.records, "registro", "registros")} de aula do período foram feitos em casa.`} />}
                />
                <StatTile
                  label="Famílias com acesso à plataforma" value={`${f.withAccess} de ${o.students}`} hint="Acompanham o plano e as conquistas pelo celular."
                  chart={<ShareRing id="anel-familia-acesso" part={f.withAccess} whole={o.students} label="Famílias com acesso à plataforma" caption="dos estudantes têm a família com acesso." />}
                />
                <StatTile
                  label="Relatórios intersetoriais" value={f.reports} hint={`${f.reportsInPeriod} no período`}
                  chart={<ShareRing id="anel-familia-relatorios" part={f.studentsWithReport} whole={o.students} label="Estudantes com orientações da rede de apoio" caption={`dos estudantes (${f.studentsWithReport}) têm orientações da rede de apoio.`} />}
                />
              </div>
              <div className="dash-card">
                <CardHeader title="Materiais acessíveis" hint={`${f.materialsInPeriod} produzidos no período.`} />
                <BarList rows={f.materials} empty="Nenhum material produzido ainda." />
              </div>
            </div>
          </Section>

          <Section id="recursos" title="Recursos e datas">
            <div className="grid gap-3.5 lg:grid-cols-2">
              <div className="dash-card">
                <CardHeader title="Recursos mais usados" hint={`Banco municipal, igual para toda a rede: ${plural(res.total, "recurso", "recursos")}, ${plural(res.activities, "proposta prática", "propostas práticas")} e ${plural(res.uses, "uso registrado", "usos registrados")}.`} href="/recursos" linkLabel="Abrir o banco de recursos" />
                {res.top.length ? (
                  // A barra compara o uso com o recurso mais usado; o número vem escrito ao lado.
                  <ol className="divide-y divide-line">
                    {res.top.map((item) => (
                      <li key={item.id}>
                        <Link href={`/recursos/${item.id}`} className="group block min-h-12 py-2.5 text-sm">
                          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <span className="min-w-0 group-hover:underline">{item.title}</span>
                            <span className="ml-auto flex shrink-0 items-center gap-2 text-xs tabular-nums text-ink-soft">{plural(item.uses, "uso", "usos")}{item.positive !== null ? <StatusPill tone={item.positive >= 70 ? "good" : item.positive >= 40 ? "mid" : "alert"}>{item.positive}% bom resultado</StatusPill> : null}</span>
                          </span>
                          <UsageMeter value={item.uses} max={topUses} className="mt-2" />
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-ink-soft">Nenhum uso registrado ainda.</p>}
              </div>
              <div className="dash-card">
                <CardHeader title="Próximas datas inclusivas" hint="Para planejar ações de conscientização com a comunidade escolar." href="/calendario" linkLabel="Abrir o calendário inclusivo" />
                {upcomingDates.length ? (
                  <ul className="space-y-1.5">
                    {upcomingDates.map((event) => (
                      <li key={event.key}>
                        <Link href={`/calendario?mes=${monthParam(event.start.year, event.start.month)}#evento-${event.key}`} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface-muted">
                          <span className={`flex w-11 shrink-0 flex-col items-center rounded-xl py-1.5 ${CALENDAR_THEMES[event.entry.theme].chip}`}><span className="text-base font-medium leading-none">{event.start.day}</span><span className="text-xs">{MONTH_SHORT[event.start.month - 1]}</span></span>
                          <span className="min-w-0"><span className="block text-sm font-medium leading-snug">{event.entry.title}</span><span className="mt-0.5 block text-xs text-ink-soft">{relativeLabel(event, today)}</span></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-ink-soft">Nenhuma data comemorativa nas próximas semanas.</p>}
                <Link href="/calendario" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink"><CalendarDays size={16} aria-hidden /> Ver calendário inclusivo</Link>
              </div>
            </div>
          </Section>

          {scope.network ? (
            <Section id="equipe" title="Equipe e privacidade" description="Quem usa a plataforma e o registro de acessos exigido pela LGPD.">
              <div className="grid gap-3.5 lg:grid-cols-2">
                <div className="dash-card">
                  <CardHeader title="Pessoas com acesso" hint={scope.schoolId ? "Equipe da escola e famílias e terapeutas dos estudantes dela." : "Todos os usuários cadastrados na rede."} />
                  <BarList rows={team.byRole.map((row) => ({ ...row, label: ROLE_LABELS[row.key] ?? row.key }))} color={SIGNAL.cyan} empty="Nenhum usuário cadastrado." />
                </div>
                <div className="dash-card">
                  <CardHeader title="Acessos registrados" hint={`${plural(team.actors, "pessoa acessou", "pessoas acessaram")} dados de estudantes · ${periodText}. A família consulta o histórico do próprio filho.`} />
                  <BarList rows={team.access.map((row) => ({ ...row, label: ACCESS_LABELS[row.key] }))} color={SIGNAL.cyan} empty="Nenhum acesso registrado no período." />
                </div>
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </>
  );
}
