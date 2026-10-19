import { prisma } from "./prisma";
import { canAccessStudent, isNetworkRole, type SessionUser } from "./auth";
import { objectiveTrend, studentAlerts, type StudentAlert, type Trend } from "./insights";
import { getStudentNextStep } from "./student-journey";
import { splitItems } from "./form-options";
import { parseJson } from "./format";
import { hasApiKey, isDeepSeekEnabled } from "./env";
import { MATERIAL_KINDS } from "./materials";
import { MONTH_NAMES, MONTH_SHORT, todayInBrazil } from "./commemorative-dates";
import { BARRIERS, CHANNELS, CONTEXTS, CRITERION_MET, DIMENSIONS, PARTICIPATION, SENSORY_AREAS, SENSORY_LABELS, STAGES } from "./scale";

// Painel de indicadores: reúne os dados da plataforma em um só lugar
// (estudantes, jornada, objetivos, aulas, atividades, IA, famílias, recursos
// e acessos). Tudo é contagem e comparação simples sobre o que a equipe
// registrou, sem inferência sobre o estudante.
//
// Escopo: a gestão da rede vê a rede inteira ou uma escola; a equipe escolar
// vê a própria escola. Listas com nome trazem só estudantes que a pessoa já
// pode acessar; o restante são contagens.

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const REVIEW_HORIZON_DAYS = 30;
const PREPARED = new Set(["aceita", "aplicada"]);

export const PERIODS = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
  tudo: "Todo o histórico",
} as const;
export type DashboardPeriod = keyof typeof PERIODS;

export function parsePeriod(value: unknown): DashboardPeriod {
  return typeof value === "string" && Object.hasOwn(PERIODS, value) ? (value as DashboardPeriod) : "ano";
}

export const ALERT_LABELS: Record<StudentAlert["kind"], string> = {
  sem_plano: "Sem plano individual ativo",
  plano_vencido: "Plano com revisão vencida",
  sem_registro: "Sem registro de aula há mais de 7 dias",
  queda_participacao: "Queda de participação",
};

export const TREND_LABELS: Record<Trend, string> = {
  avancando: "Avançando",
  estavel: "Estável",
  atencao: "Pede atenção",
  sem_dados: "Ainda sem registros",
};

export const SOURCE_LABELS: Record<string, string> = {
  regras: "Motor de regras",
  ia: "Agentes de IA",
  professor: "Criadas pelo professor",
};

// Meia-noite no fuso da rede (America/Sao_Paulo, UTC−3, sem horário de verão).
const brazilMidnight = (year: number, month: number, day = 1) => new Date(Date.UTC(year, month - 1, day, 3));

export function periodStart(period: DashboardPeriod, now: Date): Date | null {
  if (period === "30d") return new Date(now.getTime() - 30 * DAY_MS);
  if (period === "90d") return new Date(now.getTime() - 90 * DAY_MS);
  if (period === "ano") return brazilMidnight(todayInBrazil(now).year, 1);
  return null;
}

// Período anterior de mesma duração, para comparar (o ano é comparado com o
// mesmo trecho do ano passado). O histórico completo não tem comparação.
export function previousRange(period: DashboardPeriod, start: Date | null, now: Date): { from: Date; to: Date } | null {
  if (!start) return null;
  if (period === "ano") {
    const year = todayInBrazil(now).year - 1;
    return { from: brazilMidnight(year, 1), to: new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes())) };
  }
  return { from: new Date(start.getTime() - (now.getTime() - start.getTime())), to: start };
}

export const GAUGES = {
  jornada: "Jornada",
  participacao: "Participação",
  criterio: "Critério de sucesso",
} as const;
export type DashboardGauge = keyof typeof GAUGES;

export function parseGauge(value: unknown): DashboardGauge {
  return typeof value === "string" && Object.hasOwn(GAUGES, value) ? (value as DashboardGauge) : "jornada";
}

// As cinco etapas da jornada, na ordem do próximo passo sugerido
// (student-journey.ts): o passo 3 reúne plano e objetivo.
export const JOURNEY_STEPS = [
  { key: "estudo", label: "Estudo de caso", step: 1 },
  { key: "perfil", label: "Perfil", step: 2 },
  { key: "plano", label: "Plano e objetivo", step: 3 },
  { key: "atividade", label: "Atividade", step: 4 },
  { key: "registro", label: "Registro de aula", step: 5 },
] as const;

export type MonthState = "registro" | "sem_registro" | "aberto" | "recesso" | "antes" | "futuro";

export type Bucket = { label: string; title: string; start: Date; end: Date };

// Intervalos do gráfico de registros: semanas nos períodos curtos; meses no
// ano e no histórico (anos, se o histórico passar de dois anos).
export function timeBuckets(period: DashboardPeriod, start: Date | null, now: Date, earliest: Date | null): Bucket[] {
  const end = new Date(now.getTime() + 1);
  if (start && (period === "30d" || period === "90d")) {
    const buckets: Bucket[] = [];
    for (let time = start.getTime(); time < now.getTime(); time += WEEK_MS) {
      const from = new Date(time);
      const label = from.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      buckets.push({ label, title: `Semana de ${label}`, start: from, end: new Date(Math.min(time + WEEK_MS, end.getTime())) });
    }
    return buckets;
  }
  const today = todayInBrazil(now);
  const first = todayInBrazil(start ?? earliest ?? now);
  const lastIndex = today.year * 12 + today.month - 1;
  const firstIndex = first.year * 12 + first.month - 1;
  const yearly = lastIndex - firstIndex >= 24;
  const step = yearly ? 12 : 1;
  const buckets: Bucket[] = [];
  for (let index = yearly ? first.year * 12 : firstIndex; index <= lastIndex; index += step) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const next = index + step;
    buckets.push({
      label: yearly ? String(year) : `${MONTH_SHORT[month - 1]}${first.year !== today.year ? `/${String(year).slice(2)}` : ""}`,
      title: yearly ? String(year) : `${MONTH_NAMES[month - 1]} de ${year}`,
      start: brazilMidnight(year, month),
      end: next > lastIndex ? end : brazilMidnight(Math.floor(next / 12), (next % 12) + 1),
    });
  }
  return buckets;
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

// Linhas na ordem do vocabulário da plataforma; valores fora dele vão ao fim.
function labeledRows(counts: Map<string, number>, labels: Record<string, string>) {
  const known = Object.entries(labels).map(([key, label]) => ({ key, label, value: counts.get(key) ?? 0 }));
  const extra = [...counts].filter(([key]) => !(key in labels)).map(([key, value]) => ({ key, label: key, value }));
  return [...known, ...extra];
}

const byValue = <T extends { value: number }>(rows: T[]) => rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

function topItems(values: string[], limit: number) {
  return [...countBy(values, (value) => value.trim())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([label, value]) => ({ label, value }));
}

export async function loadDashboard(user: SessionUser, options: { period: DashboardPeriod; school?: unknown; now?: Date }) {
  const now = options.now ?? new Date();
  const period = options.period;
  const start = periodStart(period, now);
  const inPeriod = (date: Date) => (!start || date >= start) && date <= now;
  const createdAt = start ? { gte: start, lte: now } : { lte: now };

  const network = isNetworkRole(user.role);
  const schools = await prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const requested = typeof options.school === "string" ? options.school : null;
  const schoolId = network ? (schools.some((school) => school.id === requested) ? requested : null) : user.schoolId;
  const studentWhere = { status: "ativo", ...(schoolId ? { schoolId } : {}) };

  const [students, classCount, users, accessByAction, actors, aiSends, proposals, images, resources, resourceActivities] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      orderBy: { name: "asc" },
      include: {
        school: { select: { name: true } },
        caseStudy: { select: { status: true } },
        profile: { select: { expressiveChannel: true, barriers: true, sensoryProfile: true, readingSupport: true, writingSupport: true } },
        plans: { include: { objectives: true } },
        diaryEntries: { orderBy: { date: "asc" } },
        activities: { select: { status: true, source: true, context: true, createdAt: true, rejectReason: true } },
        familyNotes: { select: { date: true } },
        intersectorReports: { select: { createdAt: true } },
        materials: { select: { kind: true, createdAt: true } },
        planDraft: { select: { source: true } },
      },
    }),
    prisma.schoolClass.count({ where: schoolId ? { schoolId } : {} }),
    prisma.user.findMany({ select: { role: true, schoolId: true, studentId: true, studentLinks: { select: { studentId: true } } } })
      // Vínculos de família e terapeuta (StudentLink; o campo antigo vale até o primeiro acesso).
      .then((rows) => rows.map((row) => ({ role: row.role, schoolId: row.schoolId, studentIds: row.studentLinks.length ? row.studentLinks.map((link) => link.studentId) : row.studentId ? [row.studentId] : [] }))),
    prisma.accessLog.groupBy({ by: ["action"], where: { student: studentWhere, createdAt }, _count: { _all: true } }),
    prisma.accessLog.findMany({ where: { student: studentWhere, createdAt, role: { not: "sistema" } }, distinct: ["actor"], select: { actor: true } }),
    prisma.accessLog.count({ where: { student: studentWhere, createdAt, actor: "Agentes de IA" } }),
    prisma.accessLog.groupBy({ by: ["detail"], where: { student: studentWhere, createdAt, detail: { startsWith: "Proposta de plano (" } }, _count: { _all: true } }),
    prisma.activityImage.count({ where: { activity: { student: studentWhere }, createdAt } }),
    prisma.resource.findMany({ select: { id: true, title: true, timesUsed: true, positiveOutcomes: true }, orderBy: [{ timesUsed: "desc" }, { title: "asc" }] }),
    prisma.resourceActivity.count(),
  ]);

  type ScopedStudent = (typeof students)[number];
  const total = students.length;
  const count = (test: (student: ScopedStudent) => boolean) => students.filter(test).length;
  const activePlanOf = (student: ScopedStudent) => student.plans.find((plan) => plan.status === "ativo");
  const visible = (student: ScopedStudent) => canAccessStudent(user, student.schoolId, student.id);
  const lastEntryOf = (student: ScopedStudent, objectiveId: string) => student.diaryEntries.findLast((entry) => entry.objectiveId === objectiveId);

  const entries = students.flatMap((student) => student.diaryEntries);
  const periodEntries = entries.filter((entry) => inPeriod(entry.date));
  const activities = students.flatMap((student) => student.activities);
  const periodActivities = activities.filter((activity) => inPeriod(activity.createdAt));
  const objectives = students.flatMap((student) => student.plans.flatMap((plan) => plan.objectives.map((objective) => ({ objective, plan, student }))));
  const profiles = students.flatMap((student) => (student.profile ? [student.profile] : []));

  // ---------- Visão geral ----------
  const withActivePlan = count((student) => !!activePlanOf(student));
  const activeObjectives = objectives.filter(({ objective, plan }) => plan.status === "ativo" && objective.status === "ativo");
  // Avanço = redução do nível de apoio na mesma tarefa (escala única 0 a 5).
  const measurable = objectives.filter(({ objective }) => objective.status !== "em_revisao");
  const reduced = measurable.filter(({ objective, student }) => {
    if (objective.status === "alcancado") return true;
    const last = lastEntryOf(student, objective.id);
    return !!last && last.supportLevel < objective.currentSupport;
  }).length;
  const studentsWithRecord = count((student) => student.diaryEntries.some((entry) => inPeriod(entry.date)));
  const participation = countBy(periodEntries, (entry) => entry.participation);

  // ---------- Precisa de atenção ----------
  const alertsByStudent = students.map((student) => ({ student, alerts: studentAlerts({ plans: student.plans, entries: student.diaryEntries, now }) }));
  const reviewLimit = new Date(now.getTime() + REVIEW_HORIZON_DAYS * DAY_MS);

  // ---------- Jornada ----------
  const nextSteps = students.map((student) => {
    const plan = activePlanOf(student);
    return getStudentNextStep({
      id: student.id,
      caseStudy: (student.caseStudy?.status as "rascunho" | "concluido" | undefined) ?? null,
      hasProfile: !!student.profile,
      hasPlan: !!plan,
      hasObjective: !!plan?.objectives.some((objective) => objective.status === "ativo"),
      hasPreparedActivity: student.activities.some((activity) => PREPARED.has(activity.status)),
      hasDiary: student.diaryEntries.length > 0,
    });
  });
  const prepared = (student: ScopedStudent) => student.activities.some((activity) => PREPARED.has(activity.status));
  const stepDone: Record<(typeof JOURNEY_STEPS)[number]["key"], (student: ScopedStudent) => boolean> = {
    estudo: (student) => student.caseStudy?.status === "concluido",
    perfil: (student) => !!student.profile,
    plano: (student) => !!activePlanOf(student)?.objectives.some((objective) => objective.status === "ativo"),
    atividade: prepared,
    registro: (student) => student.diaryEntries.some((entry) => inPeriod(entry.date)),
  };
  const doneSteps = students.map((student) => JOURNEY_STEPS.filter((step) => stepDone[step.key](student)).length);

  // ---------- Medidor: valor atual e período anterior ----------
  const range = previousRange(period, start, now);
  const previousEntries = range ? entries.filter((entry) => entry.date >= range.from && entry.date < range.to) : [];
  const share = (list: typeof entries, test: (entry: (typeof entries)[number]) => boolean) => percent(list.filter(test).length, list.length);
  const fullParticipation = (entry: (typeof entries)[number]) => entry.participation === "total";
  const criterionMet = (entry: (typeof entries)[number]) => entry.criterionMet === "sim";

  // ---------- Meses com registro (histórico, até 5 anos) ----------
  const monthIndex = (date: Date) => { const day = todayInBrazil(date); return day.year * 12 + day.month - 1; };
  const monthCounts = countBy(entries, (entry) => String(monthIndex(entry.date)));
  const todayIndex = monthIndex(now);
  const firstIndex = entries.length ? Math.min(...entries.map((entry) => monthIndex(entry.date))) : null;
  const currentYear = Math.floor(todayIndex / 12);
  const firstYear = firstIndex === null ? currentYear : Math.max(Math.floor(firstIndex / 12), currentYear - 4);
  const calendarYears = Array.from({ length: currentYear - firstYear + 1 }, (_, offset) => {
    const year = currentYear - offset;
    return {
      year,
      months: Array.from({ length: 12 }, (_, month) => {
        const index = year * 12 + month;
        const records = monthCounts.get(String(index)) ?? 0;
        // Janeiro é recesso escolar: mês sem registro não conta como lacuna.
        const state: MonthState = index > todayIndex ? "futuro"
          : records > 0 ? "registro"
            : firstIndex === null || index < firstIndex ? "antes"
              : index === todayIndex ? "aberto"
                : month === 0 ? "recesso" : "sem_registro";
        return { month: month + 1, records, state };
      }),
    };
  });
  const calendarMonths = calendarYears.flatMap((year) => year.months);

  // ---------- Objetivos ----------
  const withRecords = measurable.filter(({ objective, student }) => !!lastEntryOf(student, objective.id));
  const trends = countBy(activeObjectives, ({ objective, student }) => objectiveTrend(objective, student.diaryEntries).trend);

  // ---------- Atividades ----------
  const sources = Object.keys(SOURCE_LABELS).map((source) => {
    const list = periodActivities.filter((activity) => activity.source === source);
    const decided = list.filter((activity) => activity.status !== "sugerida");
    const used = decided.filter((activity) => PREPARED.has(activity.status)).length;
    return { source, label: SOURCE_LABELS[source], total: list.length, decided: decided.length, used, adhesion: percent(used, decided.length) };
  });

  // ---------- Perfil (agregado) ----------
  const isCaa = (channel: string) => channel.startsWith("caa") || channel === "olhar_acionador";
  const caaStudents = students.filter((student) => student.profile && isCaa(student.profile.expressiveChannel));
  // Banco de práticas: estratégias que funcionaram em registros com boa
  // resposta (critério atingido ou parcial), por perfil agregado.
  const clusters = [
    { label: "CAA ou acionador", test: (profile: NonNullable<ScopedStudent["profile"]>) => isCaa(profile.expressiveChannel) },
    { label: "Hipersensibilidade auditiva", test: (profile: NonNullable<ScopedStudent["profile"]>) => parseJson<{ auditiva?: string }>(profile.sensoryProfile, {}).auditiva === "hiper" },
    { label: "Apoio em leitura e escrita (modelo ou mais)", test: (profile: NonNullable<ScopedStudent["profile"]>) => profile.readingSupport >= 3 || profile.writingSupport >= 3 },
  ];
  const practices = clusters.map((cluster) => {
    const good = students
      .filter((student) => student.profile && cluster.test(student.profile))
      .flatMap((student) => student.diaryEntries)
      .filter((entry) => inPeriod(entry.date) && (entry.criterionMet === "sim" || entry.criterionMet === "parcial") && splitItems(entry.whatWorked).length);
    return { label: cluster.label, records: good.length, top: topItems(good.flatMap((entry) => splitItems(entry.whatWorked)), 4) };
  }).filter((cluster) => cluster.records > 0);

  // ---------- Equipe e acessos ----------
  const scopeIds = new Set(students.map((student) => student.id));
  const scopedUsers = schoolId ? users.filter((item) => item.schoolId === schoolId || item.studentIds.some((id) => scopeIds.has(id))) : users;
  const accessCount = (action: string) => accessByAction.find((row) => row.action === action)?._count._all ?? 0;
  const proposalCount = (detail: string) => proposals.find((row) => row.detail === detail)?._count._all ?? 0;
  const reports = students.flatMap((student) => student.intersectorReports);
  const materials = students.flatMap((student) => student.materials);

  return {
    scope: {
      network,
      schoolId,
      schoolName: schoolId ? schools.find((school) => school.id === schoolId)?.name ?? null : null,
      schools: network ? schools : [],
      period,
      start,
      now,
    },
    overview: {
      students: total,
      withAEE: count((student) => student.hasAEE),
      withSupportProfessional: count((student) => student.supportProfessional),
      schools: schoolId ? 1 : schools.length,
      classes: classCount,
      withActivePlan,
      planCoverage: percent(withActivePlan, total),
      activeObjectives: activeObjectives.length,
      achievedObjectives: objectives.filter(({ objective }) => objective.status === "alcancado").length,
      objectivesInReview: objectives.filter(({ objective }) => objective.status === "em_revisao").length,
      reducedSupport: reduced,
      measurableObjectives: measurable.length,
      reducedSupportPct: percent(reduced, measurable.length),
      records: periodEntries.length,
      // Registros do período anterior de mesmo tamanho (null em "todo o histórico").
      previousRecords: range ? previousEntries.length : null,
      studentsWithRecord,
      fullParticipation: participation.get("total") ?? 0,
      fullParticipationPct: percent(participation.get("total") ?? 0, periodEntries.length),
      preparedActivities: periodActivities.filter((activity) => PREPARED.has(activity.status)).length,
      pendingSuggestions: activities.filter((activity) => activity.status === "sugerida").length,
    },
    attention: {
      studentsWithAlerts: alertsByStudent.filter((item) => item.alerts.length).length,
      byKind: (Object.keys(ALERT_LABELS) as StudentAlert["kind"][]).map((kind) => ({
        key: kind, label: ALERT_LABELS[kind], value: alertsByStudent.filter((item) => item.alerts.some((alert) => alert.kind === kind)).length,
      })),
      reviewsSoon: count((student) => {
        const plan = activePlanOf(student);
        return !!plan && plan.reviewDate >= now && plan.reviewDate <= reviewLimit;
      }),
      reviewHorizonDays: REVIEW_HORIZON_DAYS,
      // Tabela nominal: só estudantes que a pessoa já pode acessar.
      students: students
        .map((student, index) => ({ student, alerts: alertsByStudent[index].alerts, next: nextSteps[index] }))
        .filter(({ student }) => visible(student))
        .sort((a, b) => b.alerts.length - a.alerts.length || a.student.name.localeCompare(b.student.name))
        .map(({ student, alerts, next }) => {
          const plan = activePlanOf(student);
          return {
            id: student.id,
            name: student.name,
            className: student.className,
            school: student.school.name,
            plan: !plan ? "sem_plano" as const : plan.reviewDate < now ? "vencido" as const : "ativo" as const,
            reviewDate: plan?.reviewDate ?? null,
            lastRecord: student.diaryEntries.at(-1)?.date ?? null,
            alerts: alerts.map((alert) => alert.kind),
            next: { label: next.label, href: next.href },
          };
        }),
    },
    journey: {
      steps: JOURNEY_STEPS.map((step) => ({
        ...step,
        done: count(stepDone[step.key]),
        here: nextSteps.filter((next) => next.step === step.step).length,
      })),
      caseStudyDrafts: count((student) => student.caseStudy?.status === "rascunho"),
      completion: percent(doneSteps.reduce((sum, done) => sum + done, 0), JOURNEY_STEPS.length * total),
      complete: doneSteps.filter((done) => done === JOURNEY_STEPS.length).length,
    },
    gauges: {
      participacao: { value: share(periodEntries, fullParticipation), previous: share(previousEntries, fullParticipation), records: periodEntries.length },
      criterio: { value: share(periodEntries, criterionMet), previous: share(previousEntries, criterionMet), records: periodEntries.length },
    },
    calendar: {
      years: calendarYears,
      monthsWithRecords: calendarMonths.filter((month) => month.state === "registro").length,
      schoolMonths: calendarMonths.filter((month) => month.state === "registro" || month.state === "sem_registro").length,
      gaps: calendarMonths.filter((month) => month.state === "sem_registro").length,
    },
    learning: {
      advancing: trends.get("avancando") ?? 0,
      trends: (Object.keys(TREND_LABELS) as Trend[]).map((trend) => ({ key: trend, label: TREND_LABELS[trend], value: trends.get(trend) ?? 0 })),
      support: {
        objectives: withRecords.length,
        initial: average(withRecords.map(({ objective }) => objective.currentSupport)),
        latest: average(withRecords.map(({ objective, student }) => lastEntryOf(student, objective.id)!.supportLevel)),
        target: average(withRecords.map(({ objective }) => objective.targetSupport)),
      },
      byDimension: byValue(Object.entries(DIMENSIONS).map(([key, label]) => {
        const list = objectives.filter(({ objective }) => objective.dimension === key);
        return { key, label, value: list.length, achieved: list.filter(({ objective }) => objective.status === "alcancado").length };
      })),
      criterion: labeledRows(countBy(periodEntries, (entry) => entry.criterionMet), CRITERION_MET),
    },
    records: {
      series: timeBuckets(period, start, now, entries[0] ? entries.reduce((min, entry) => (entry.date < min ? entry.date : min), entries[0].date) : null)
        .map((bucket) => ({ label: bucket.label, title: bucket.title, value: entries.filter((entry) => entry.date >= bucket.start && entry.date < bucket.end).length })),
      weekly: period === "30d" || period === "90d",
      participation: labeledRows(participation, PARTICIPATION),
      byAuthor: byValue([...countBy(periodEntries, (entry) => entry.authorRole)].map(([key, value]) => ({ key, value }))),
      strategies: topItems(periodEntries.flatMap((entry) => splitItems(entry.whatWorked)), 6),
    },
    activities: {
      created: periodActivities.length,
      byStatus: labeledRows(countBy(periodActivities, (activity) => activity.status), { sugerida: "Aguardando avaliação", aceita: "Aceita", aplicada: "Aplicada", rejeitada: "Rejeitada" }),
      byContext: labeledRows(countBy(periodActivities, (activity) => activity.context), CONTEXTS),
      sources,
      rejectReasons: topItems(periodActivities.filter((activity) => activity.status === "rejeitada").map((activity) => activity.rejectReason?.trim() || "Sem motivo informado"), 3),
    },
    ai: {
      providers: {
        claude: hasApiKey("ANTHROPIC_API_KEY"),
        deepseek: isDeepSeekEnabled(),
        openai: hasApiKey("OPENAI_API_KEY"),
      },
      planProposals: { ia: proposalCount("Proposta de plano (agentes de IA)"), regras: proposalCount("Proposta de plano (regras)") },
      draftsPending: count((student) => !!student.planDraft),
      activities: sources.find((source) => source.source === "ia")!,
      rulesActivities: sources.find((source) => source.source === "regras")!,
      images,
      deepseekSends: aiSends,
    },
    profile: {
      withoutProfile: total - profiles.length,
      byStage: labeledRows(countBy(students, (student) => student.stage), STAGES).filter((row) => row.value > 0),
      bySchool: schoolId ? [] : byValue(schools.map((school) => ({ key: school.id, label: school.name, value: count((student) => student.schoolId === school.id) }))),
      channels: byValue(labeledRows(countBy(profiles, (profile) => profile.expressiveChannel), CHANNELS)),
      barriers: byValue(labeledRows(countBy(profiles.flatMap((profile) => parseJson<string[]>(profile.barriers, [])), (barrier) => barrier), BARRIERS)),
      hypersensitivity: SENSORY_AREAS.map((area) => ({
        key: area, label: SENSORY_LABELS[area], value: profiles.filter((profile) => parseJson<Record<string, string>>(profile.sensoryProfile, {})[area] === "hiper").length,
      })),
      caa: { total: caaStudents.length, withoutResources: caaStudents.filter((student) => !student.accessibilityNotes?.trim()).length },
      practices,
    },
    family: {
      notes: students.flatMap((student) => student.familyNotes).filter((note) => inPeriod(note.date)).length,
      records: periodEntries.filter((entry) => entry.authorRole === "familia").length,
      withAccess: count((student) => users.some((item) => item.role === "familia" && item.studentIds.includes(student.id))),
      reports: reports.length,
      reportsInPeriod: reports.filter((report) => inPeriod(report.createdAt)).length,
      studentsWithReport: count((student) => student.intersectorReports.length > 0),
      materials: MATERIAL_KINDS.map(({ kind, label }) => ({ key: kind, label, value: materials.filter((material) => material.kind === kind).length })),
      materialsInPeriod: materials.filter((material) => inPeriod(material.createdAt)).length,
    },
    resources: {
      total: resources.length,
      activities: resourceActivities,
      uses: resources.reduce((sum, resource) => sum + resource.timesUsed, 0),
      top: resources.filter((resource) => resource.timesUsed > 0).slice(0, 5).map((resource) => ({
        id: resource.id, title: resource.title, uses: resource.timesUsed, positive: percent(resource.positiveOutcomes, resource.timesUsed),
      })),
    },
    team: {
      byRole: byValue([...countBy(scopedUsers, (item) => item.role)].map(([key, value]) => ({ key, value }))),
      access: ["visualizou", "criou", "editou", "enviou"].map((action) => ({ key: action, value: accessCount(action) })),
      actors: actors.length,
    },
  };
}

export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;
