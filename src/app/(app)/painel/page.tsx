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
import { EmptyState } from "@/components/ui";
import {
  BarList, ColumnChart, HatchedDonut, HatchedGauge, Legend, MonthGrid, SIGNAL, StackedBar, SupportScale, Swatch, type ChartSegment,
} from "@/components/charts";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// Linguagem visual inspirada em painéis de score: destaque com medidor em
// degradê, cartões brancos sobre quadro cinza, pílulas de situação (lima =
// bom, amarelo = intermediário, laranja = atenção) e botões pretos.

const SEGMENT_COLORS: Record<string, string> = {
  total: SIGNAL.lime, sim: SIGNAL.lime, avancando: SIGNAL.lime, aplicada: SIGNAL.lime,
  parcial: SIGNAL.yellow, sugerida: SIGNAL.yellow,
  recusou: SIGNAL.orange, nao: SIGNAL.orange, atencao: SIGNAL.orange, rejeitada: SIGNAL.orange,
  estavel: SIGNAL.cyan, aceita: SIGNAL.cyan, sem_dados: SIGNAL.track,
};
const ROLE_LABELS: Record<string, string> = { ...ROLES, terapeuta: "Terapeuta" };
const ACCESS_LABELS: Record<string, string> = { visualizou: "Consultas", criou: "Inclusões", editou: "Alterações", enviou: "Envios à IA de reserva (DeepSeek)" };
const SHORT_ALERTS: Record<string, string> = { sem_registro: "Sem registro há 7+ dias", plano_vencido: "Revisão vencida", sem_plano: "Sem plano", queda_participacao: "Queda de participação" };

type Tone = "good" | "mid" | "alert" | "neutral";
const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-signal-lime text-ink-strong",
  mid: "bg-signal-yellow text-ink-strong",
  alert: "bg-signal-orange text-ink-strong",
  neutral: "bg-signal-track text-ink-soft",
};

const withColors = (rows: { key: string; label: string; value: number }[]): ChartSegment[] =>
  rows.map((row) => ({ ...row, color: SEGMENT_COLORS[row.key] ?? SIGNAL.lime }));
const decimal = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const oneDecimal = (value: number) => Math.round(value * 10) / 10;
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;
const shortDate = (date: Date) => date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });

function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${TONE_CLASSES[tone]}`}>{children}</span>;
}

function CardHeader({ title, hint, href, linkLabel }: { title: string; hint?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium tracking-tight text-ink">{title}</h3>
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

function FactorCard({ title, value, tone, status, text, href }: { title: string; value: ReactNode; tone: Tone; status: string; text: string; href: string }) {
  return (
    <article className="dash-card flex flex-col !p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-ink">{title}</h3>
        <Link href={href} className="circle-link !size-8" aria-label={`Ver detalhes: ${title}`}><ArrowUpRight size={15} aria-hidden /></Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-display text-[32px] font-normal leading-none tracking-tight text-ink">{value}</p>
        <StatusPill tone={tone}>{status}</StatusPill>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">{text}</p>
    </article>
  );
}

function Stat({ value, label, hint }: { value: ReactNode; label: string; hint?: string }) {
  return (
    <div className="dash-card">
      <p className="font-display text-[32px] font-normal leading-none tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-sm font-medium leading-snug text-ink">{label}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-soft">{hint}</p> : null}
    </div>
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
  const factors: { title: string; value: ReactNode; tone: Tone; status: string; text: string; href: string }[] = [
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
    },
    {
      title: "Objetivos", value: o.activeObjectives,
      tone: o.achievedObjectives > 0 ? "good" : "neutral", status: o.achievedObjectives > 0 ? `${o.achievedObjectives} alcançados` : "Em andamento",
      text: `em acompanhamento · ${o.objectivesInReview} em revisão`, href: "#objetivos",
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
    ["ia", "IA"], ["perfil", "Perfil"], ["familia", "Família"], ["recursos", "Recursos e datas"],
    ...(scope.network ? [["equipe", "Equipe"] as [string, string]] : []),
  ];

  const support = l.support;
  const supportDrop = support.initial !== null && support.latest !== null ? oneDecimal(oneDecimal(support.initial) - oneDecimal(support.latest)) : null;
  const participation = withColors(r.participation);
  const participationTotal = participation.reduce((sum, segment) => sum + segment.value, 0);
  const statusSegments = withColors(act.byStatus);
  const tableRows = a.students.slice(0, 8);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-normal tracking-tight text-ink sm:text-[34px]">Painel de indicadores</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">{scope.schoolName ?? "Toda a rede"}</span>
            {o.students ? <> · <span data-testid="total-estudantes">{plural(o.students, "estudante", "estudantes")}</span> ({o.withAEE} no AEE) · {plural(o.schools, "escola", "escolas")} · {plural(o.classes, "turma", "turmas")}</> : null}
            {" "}· {PERIODS[period]}{scope.start ? ` (desde ${formatDate(scope.start)})` : ""} · atualizado em {updatedAt}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <nav aria-label="Período" className="flex flex-wrap gap-1 rounded-[22px] border border-line bg-surface-muted p-1 sm:rounded-full">
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
              <button type="submit" className="min-h-10 rounded-full bg-ink-strong px-4 text-sm font-medium text-white transition-colors hover:bg-[#3a3a3a]">Ver</button>
            </form>
          ) : null}
          <PrintButton label="Imprimir" />
        </div>
      </div>

      {o.students === 0 ? (
        <div>
          <EmptyState title="Ainda não há estudantes ativos neste recorte" hint="Quando houver estudantes cadastrados, os indicadores aparecem aqui." />
          <Link href="/estudantes/novo" className="task-action mt-4 w-fit">Cadastrar estudante</Link>
        </div>
      ) : (
        <div className="dash-board">
          <nav aria-label="Seções do painel" className="sticky top-0 z-20 -mx-1 mb-3.5 flex gap-1.5 overflow-x-auto rounded-full bg-surface-muted/95 p-1 backdrop-blur scrollbar-none print:hidden">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-paper-raised/70 px-4 text-sm text-ink-soft transition-colors hover:bg-ink-strong hover:text-white">{label}</a>
            ))}
          </nav>

          <section id="visao-geral" aria-label="Visão geral" className="grid scroll-mt-20 grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
            {/* Coluna da direita (vem primeiro no celular): destaque e cartões de situação */}
            <div className="contents xl:order-2 xl:flex xl:min-w-0 xl:flex-col xl:gap-3.5">
              <section aria-labelledby="destaque-titulo" className="dash-hero order-1 min-w-0 px-5 pb-6 pt-8 text-center sm:px-8 xl:order-none">
                <h2 id="destaque-titulo" className="font-display text-[34px] font-medium leading-tight tracking-tight text-ink sm:text-[42px]">Olá, {firstName(user.name)}</h2>
                <p className="mt-1 text-xl font-light leading-snug text-ink sm:text-[26px]">Este é o acompanhamento {scopePhrase}</p>
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
                    <p className="mt-1 font-display text-[60px] font-normal leading-none tracking-tight text-ink sm:text-[68px]">{gauge.value ?? "—"}{gauge.value !== null ? <span className="text-[0.5em]">%</span> : null}</p>
                  </div>
                </div>
                <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-ink-soft">{gauge.description}</p>
                {scope.network
                  ? <a href="#atencao" className="pill-dark mx-auto mt-5 max-w-sm">Ver estudantes com avisos</a>
                  : <Link href="/estudantes?acao=registrar" className="pill-dark mx-auto mt-5 max-w-sm">Registrar uma aula</Link>}
              </section>

              <div className="order-2 grid min-w-0 grid-cols-2 gap-3.5 xl:order-none 2xl:grid-cols-3">
                {factors.map((factor) => <FactorCard key={factor.title} {...factor} />)}
              </div>

              <section id="ia" aria-labelledby="ia-titulo" className="dash-card order-4 min-w-0 scroll-mt-20 xl:order-none">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 id="ia-titulo" className="text-[15px] font-medium tracking-tight">Inteligência artificial</h2>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">A IA propõe e o professor decide. Nomes, contatos e documentos são trocados por marcadores antes do envio.</p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal-lime-soft text-ink-strong"><ShieldCheck size={17} aria-hidden /></span>
                </div>
                <dl className="divide-y divide-line text-sm">
                  {([
                    ["Claude (planos e atividades)", ai.providers.claude ? "Ativo" : "Não configurado"],
                    ["DeepSeek (reserva)", ai.providers.deepseek ? "Ativo" : "Não configurado"],
                    ["OpenAI (imagens de apoio)", ai.providers.openai ? "Ativo" : "Não configurado"],
                    ["Planos propostos pela IA", `${ai.planProposals.ia} · regras: ${ai.planProposals.regras}`],
                    ["Propostas aguardando revisão", String(ai.draftsPending)],
                    ["Atividades criadas pela IA", ai.activities.adhesion === null ? String(ai.activities.total) : `${ai.activities.total} · adesão ${ai.activities.adhesion}%`],
                    ["Imagens geradas", String(ai.images)],
                    ["Envios à IA de reserva", String(ai.deepseekSends)],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                      <dt className="text-ink-soft">{label}</dt>
                      <dd className="text-right font-medium text-ink">{value === "Ativo" ? <StatusPill tone="good">Ativo</StatusPill> : value === "Não configurado" ? <StatusPill tone="neutral">Não configurado</StatusPill> : value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">Números de {periodText}. Cada envio à IA de reserva fica no histórico de acessos que a família consulta.</p>
                <Link href="/estudantes?acao=preparar" className="pill-dark mt-4"><Sparkles size={16} aria-hidden /> Preparar uma atividade</Link>
              </section>
            </div>

            {/* Coluna da esquerda: jornada, contadores, estudantes, apoio, participação e meses */}
            <div className="contents xl:order-1 xl:flex xl:min-w-0 xl:flex-col xl:gap-3.5">
              <section id="jornada" aria-labelledby="jornada-titulo" className="dash-card order-3 min-w-0 scroll-mt-20 xl:order-none">
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="jornada-titulo" className="text-[15px] font-medium tracking-tight">Jornada do acompanhamento</h2>
                  <p className="text-xs text-ink-soft">{j.completion ?? 0}% concluída{j.caseStudyDrafts ? ` · ${plural(j.caseStudyDrafts, "estudo de caso em andamento", "estudos de caso em andamento")}` : ""}</p>
                </div>
                <div className="-mx-1 overflow-x-auto scrollbar-none">
                  <ol className="stepper">
                    {j.steps.map((step) => {
                      const complete = step.done === o.students;
                      return (
                        <li key={step.key} className="stepper-item">
                          <span className={`relative z-10 flex size-[34px] items-center justify-center rounded-full text-xs font-semibold ${complete ? "bg-ink-strong text-white" : step.done > 0 ? "border-2 border-signal-lime bg-signal-lime-soft text-ink-strong" : "border-2 border-dashed border-[#cfc9c0] bg-paper-raised text-ink-soft"}`}>
                            {complete ? <Check size={17} strokeWidth={3} aria-hidden /> : step.done}
                          </span>
                          <span className="mt-2 text-[11px] text-ink-soft">Etapa {step.step}</span>
                          <span className="text-[13px] font-medium leading-snug text-ink">{step.label}</span>
                          <span className="mt-0.5 text-[11px] text-ink-soft">{step.done} de {o.students}</span>
                          {step.here ? <span className="mt-1.5 rounded-full bg-signal-yellow-soft px-2 py-0.5 text-[10px] font-medium text-ink-strong">{step.here} {step.step === 5 ? "na rotina" : "nesta etapa"}</span> : null}
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
                    <h2 id="atencao-titulo" className="text-[15px] font-medium tracking-tight">Estudantes</h2>
                    <p className="mt-1 text-xs text-ink-soft">Ordenados por avisos. Só aparecem estudantes aos quais você tem acesso.</p>
                  </div>
                  <Link href="/estudantes" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm text-ink transition-colors hover:border-ink-strong">Ver todos <ArrowRight size={15} aria-hidden /></Link>
                </div>
                {tableRows.length ? (
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
                {a.students.length > tableRows.length ? <p className="mt-2 text-xs text-ink-soft">Mostrando {tableRows.length} de {a.students.length}. <Link href="/estudantes" className="font-medium text-ink underline">Ver todos os estudantes</Link></p> : null}
                <p className="mt-3 rounded-2xl bg-surface-muted/70 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
                  <span className="font-medium text-ink">Avisos em {scope.schoolName ?? "toda a rede"}:</span>{" "}
                  {a.byKind.map((kind) => `${kind.value} ${ALERT_LABELS[kind.key].charAt(0).toLowerCase()}${ALERT_LABELS[kind.key].slice(1)}`).join(" · ")}. O botão ↗ leva ao próximo passo de cada estudante.
                </p>
              </section>

              <div className="order-3 grid min-w-0 gap-3.5 md:grid-cols-2 xl:order-none">
                <section aria-labelledby="apoio-titulo" className="dash-card">
                  <h2 id="apoio-titulo" className="text-[15px] font-medium tracking-tight">Nível de apoio</h2>
                  {support.initial !== null && support.latest !== null && support.target !== null ? (
                    <>
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                        {supportDrop !== null && supportDrop > 0 ? `Em média, os estudantes já precisam de ${decimal(supportDrop)} ${supportDrop >= 2 ? "níveis" : "nível"} de apoio a menos do que no início.` : "O nível de apoio médio ainda não diminuiu em relação ao início."} Média de {plural(support.objectives, "objetivo", "objetivos")} com registro.
                      </p>
                      <SupportScale initial={support.initial} latest={support.latest} target={support.target} />
                      <dl className="mt-4 grid grid-cols-3 gap-2">
                        {([["No início", support.initial, "rounded-full border-2 border-ink-strong bg-white"], ["Agora", support.latest, "rounded-full bg-ink-strong"], ["Meta", support.target, "rotate-45 rounded-[2px] border-2 border-ink-strong bg-white"]] as const).map(([label, value, marker], index) => (
                          <div key={label} className={index === 1 ? "text-center" : index === 2 ? "text-right" : ""}>
                            <dt className={`flex items-center gap-1.5 text-xs text-ink-soft ${index === 1 ? "justify-center" : index === 2 ? "justify-end" : ""}`}><span aria-hidden className={`inline-block size-2.5 ${marker}`} />{label}</dt>
                            <dd className="mt-1 font-display text-[28px] leading-none tracking-tight">{decimal(value)}</dd>
                            <dd className="mt-1 text-[11px] text-ink-soft">{supportInfo(Math.round(value)).label}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : <p className="mt-2 text-sm text-ink-soft">Ainda não há registros de aula ligados a objetivos.</p>}
                </section>

                <section aria-labelledby="participacao-titulo" className="dash-card">
                  <h2 id="participacao-titulo" className="text-[15px] font-medium tracking-tight">Participação nas aulas</h2>
                  {participationTotal ? (
                    <div className="mt-4 flex flex-wrap items-center gap-5">
                      <HatchedDonut id="rosca-participacao" segments={participation} label={`Participação: ${participation.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`} size={140} thickness={18}>
                        <span className="font-display text-[30px] leading-none tracking-tight">{o.fullParticipationPct ?? 0}%</span>
                        <span className="mt-1 text-[11px] leading-tight text-ink-soft">{o.fullParticipation} de {o.records}<br />plenas</span>
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
                    <h2 id="meses-titulo" className="text-[15px] font-medium tracking-tight">Meses com registro de aula</h2>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                      {cal.schoolMonths ? `Houve registro em ${cal.monthsWithRecords} de ${plural(cal.schoolMonths, "mês letivo", "meses letivos")} desde o primeiro registro.` : "Ainda não há registros de aula."} Histórico completo, sem o filtro de período.
                    </p>
                  </div>
                  {cal.gaps ? <StatusPill tone="alert">{plural(cal.gaps, "mês sem registro", "meses sem registro")}</StatusPill> : cal.schoolMonths ? <StatusPill tone="good">Sem lacunas</StatusPill> : null}
                </div>
                <MonthGrid years={cal.years} />
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink-soft">
                  <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border-2 border-[#e2f6a6] bg-signal-lime" />Com registro</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="flex size-3 items-center justify-center rounded-full bg-signal-orange" />Mês letivo sem registro</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border border-dashed border-[#cfc9c0]" />Mês atual</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border border-line bg-paper" />Recesso (janeiro)</li>
                </ul>
              </section>
            </div>
          </section>

          <Section id="objetivos" title="Objetivos e aprendizagem" description="Avançar é precisar de menos apoio para a mesma tarefa, na escala de 0 (independente) a 5 (apoio físico total).">
            <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              <div className="dash-card">
                <CardHeader title="Como estão os objetivos" hint="Tendência dos últimos registros de cada objetivo em acompanhamento." />
                <StackedBar segments={withColors(l.trends)} empty="Nenhum objetivo em acompanhamento." />
              </div>
              <div className="dash-card">
                <CardHeader title="Objetivos por área" />
                <BarList rows={l.byDimension.map((row) => ({ ...row, detail: plural(row.achieved, "alcançado", "alcançados") }))} empty="Nenhum objetivo cadastrado." />
              </div>
              <div className="dash-card">
                <CardHeader title="Critério de sucesso" hint={`Registros de aula · ${periodText}.`} />
                <StackedBar segments={withColors(l.criterion)} />
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
                <CardHeader title="Estratégias que mais funcionaram" hint={`Marcadas como “o que funcionou” nos registros · ${periodText}.`} />
                {r.strategies.length ? (
                  <ol className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {r.strategies.map((item, index) => (
                      <li key={item.label} className="flex items-center gap-3 text-sm">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-signal-lime text-xs font-semibold text-ink-strong">{index + 1}</span>
                        <span className="flex-1 leading-snug">{item.label}</span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-soft">{item.value}x</span>
                      </li>
                    ))}
                  </ol>
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
                      <span className="font-display text-[28px] leading-none tracking-tight">{act.created}</span>
                      <span className="mt-1 text-[11px] text-ink-soft">criadas</span>
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
                {act.rejectReasons.length ? (
                  <ul className="space-y-2.5 text-sm">
                    {act.rejectReasons.map((reason) => (
                      <li key={reason.label} className="flex items-start justify-between gap-3"><span>“{reason.label}”</span><StatusPill tone="alert">{reason.value}x</StatusPill></li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-ink-soft">Nenhuma sugestão rejeitada no período.</p>}
              </div>
            </div>
          </Section>

          <Section id="perfil" title="Perfil dos estudantes" description="Dados agregados, sem identificar ninguém: orientam formação, compra de recursos e adaptação dos ambientes.">
            {p.caa.withoutResources > 0 ? (
              <div className="mb-3.5 flex items-start gap-3 rounded-[22px] bg-signal-yellow-soft p-4 sm:p-5">
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
                      <ul className="space-y-2 text-sm text-ink">
                        {cluster.top.map((item) => (
                          <li key={item.label} className="flex items-center gap-2.5"><Swatch color={SIGNAL.lime} /><span className="flex-1">{item.label}</span><span className="shrink-0 text-xs tabular-nums text-ink-soft">{item.value}x</span></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </Section>

          <Section id="familia" title="Família e rede de apoio" description="Participação da família e articulação com saúde e assistência social.">
            <div className="grid gap-3.5 lg:grid-cols-3">
              <div className="grid gap-3.5 sm:grid-cols-2 lg:col-span-2">
                <Stat value={f.notes} label="Conquistas registradas pela família" hint={PERIODS[period]} />
                <Stat value={f.records} label="Registros de aula feitos em casa" hint={PERIODS[period]} />
                <Stat value={`${f.withAccess} de ${o.students}`} label="Famílias com acesso à plataforma" hint="Acompanham o plano e as conquistas pelo celular." />
                <Stat value={f.reports} label="Relatórios intersetoriais" hint={`${plural(f.studentsWithReport, "estudante com orientações", "estudantes com orientações")} da rede de apoio · ${f.reportsInPeriod} no período`} />
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
                  <ol className="divide-y divide-line">
                    {res.top.map((item) => (
                      <li key={item.id}>
                        <Link href={`/recursos/${item.id}`} className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm hover:underline">
                          <span>{item.title}</span>
                          <span className="ml-auto flex shrink-0 items-center gap-2 text-xs tabular-nums text-ink-soft">{plural(item.uses, "uso", "usos")}{item.positive !== null ? <StatusPill tone={item.positive >= 70 ? "good" : item.positive >= 40 ? "mid" : "alert"}>{item.positive}% bom resultado</StatusPill> : null}</span>
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
                          <span className={`flex w-11 shrink-0 flex-col items-center rounded-xl py-1.5 ${CALENDAR_THEMES[event.entry.theme].chip}`}><span className="text-base font-medium leading-none">{event.start.day}</span><span className="text-[11px]">{MONTH_SHORT[event.start.month - 1]}</span></span>
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
