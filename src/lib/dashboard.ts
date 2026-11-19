import { db } from "./prisma";
import { AI_ACTOR, AUDIT_ACTION, PLAN_PROPOSAL_DETAIL } from "./audit";
import { bnccSkill } from "./bncc";
import { componentLabel } from "./bncc-core";
import { AREAS, compareAreas, reassessmentDue } from "./assessment";
import { answersOf } from "./assessments";
import type { SessionUser } from "./auth";
import { canAccessStudent, isFamilyOf, linkedStudentIds } from "./policy";
import { can } from "./roles";
import { ALERTS, objectiveTrend, studentAlerts, type StudentAlert } from "./insights";
import { JOURNEY_STEPS, getStudentNextStep, journeyFacts } from "./student-journey";
import { parseCaseStudy } from "./case-study";
import { censusReference } from "./federal-guidance";
import { recentRecord, type SchoolAlerts } from "./panel-overview";
import { stepsFor } from "./support-steps";
import { parseJson, splitItems, readList } from "./format";
import { aiProviders } from "./agents/capabilities";
import { usesAac } from "./pedagogy-rules";
import { MATERIAL_KINDS } from "./material-content";
import { DAY_MS, MONTH_NAMES, MONTH_SHORT, brYmd, formatDateShort, isPastDay, monthIndex, monthOfIndex, monthStart } from "./dates";
import { ACTIVITY_STATUS, BARRIERS, CHANNELS, CONTEXTS, CRITERION_MET, DIMENSIONS, PARTICIPATION, PREPARED_ACTIVITY_STATUSES, SENSORY_AREAS, SENSORY_LABELS, STAGES, TREND, shortOf, type Term, type Tone } from "./scale";

const WEEK_MS = 7 * DAY_MS;
const REVIEW_HORIZON_DAYS = 30;
const prepared = (status: string) => PREPARED_ACTIVITY_STATUSES.includes(status);

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

export const SOURCE_LABELS: Record<string, string> = {
  regras: "Motor de regras",
  ia: "Agentes de IA",
  professor: "Criadas pelo professor",
};

export function periodStart(period: DashboardPeriod, now: Date): Date | null {
  if (period === "30d") return new Date(now.getTime() - 30 * DAY_MS);
  if (period === "90d") return new Date(now.getTime() - 90 * DAY_MS);
  if (period === "ano") return monthStart(brYmd(now).year * 12);
  return null;
}

export type MonthState = "registro" | "sem_registro" | "aberto" | "recesso" | "antes" | "futuro";

export type Bucket = { label: string; title: string; start: Date; end: Date };

export function timeBuckets(period: DashboardPeriod, start: Date | null, now: Date, earliest: Date | null): Bucket[] {
  const end = new Date(now.getTime() + 1);
  if (start && (period === "30d" || period === "90d")) {
    const buckets: Bucket[] = [];
    for (let time = start.getTime(); time < now.getTime(); time += WEEK_MS) {
      const from = new Date(time);
      const label = formatDateShort(from);
      buckets.push({ label, title: `Semana de ${label}`, start: from, end: new Date(Math.min(time + WEEK_MS, end.getTime())) });
    }
    return buckets;
  }
  const lastIndex = monthIndex(now);
  const firstIndex = monthIndex(start ?? earliest ?? now);
  const firstYear = monthOfIndex(firstIndex).year;
  const yearly = lastIndex - firstIndex >= 24;
  const step = yearly ? 12 : 1;
  const buckets: Bucket[] = [];
  for (let index = yearly ? firstYear * 12 : firstIndex; index <= lastIndex; index += step) {
    const { year, month } = monthOfIndex(index);
    const next = index + step;
    buckets.push({
      label: yearly ? String(year) : `${MONTH_SHORT[month - 1]}${firstYear !== monthOfIndex(lastIndex).year ? `/${String(year).slice(2)}` : ""}`,
      title: yearly ? String(year) : `${MONTH_NAMES[month - 1]} de ${year}`,
      start: monthStart(index),
      end: next > lastIndex ? end : monthStart(next),
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

function labeledRows(counts: Map<string, number>, table: Readonly<Record<string, Term | string>>): { key: string; label: string; tone: Tone; value: number }[] {
  const known = Object.entries(table).map(([key, term]) => (typeof term === "string" ? { key, label: term, tone: "neutral" as const, value: counts.get(key) ?? 0 } : { key, label: term.label, tone: term.tone, value: counts.get(key) ?? 0 }));
  const extra = [...counts].filter(([key]) => !(key in table)).map(([key, value]) => ({ key, label: key, tone: "neutral" as const, value }));
  return [...known, ...extra];
}

const byValue = <T extends { value: number }>(rows: T[]) => rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

function topItems(values: string[], limit: number) {
  return [...countBy(values, (value) => value.trim())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([label, value]) => ({ label, value }));
}

export async function loadDashboard(user: SessionUser, options: { period: DashboardPeriod; school?: unknown; now?: Date }) {
  const prisma = await db();
  const now = options.now ?? new Date();
  const period = options.period;
  const start = periodStart(period, now);
  const inPeriod = (date: Date) => (!start || date >= start) && date <= now;
  const createdAt = start ? { gte: start, lte: now } : { lte: now };

  const network = can(user.role, "management");
  const schools = await prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const requested = typeof options.school === "string" ? options.school : null;
  const schoolId = network ? (schools.some((school) => school.id === requested) ? requested : null) : user.schoolId;
  const studentWhere = { status: "ativo", ...(schoolId ? { schoolId } : {}) };

  const [students, classCount, users, accessByAction, actors, proposals, images, resources, resourceActivities] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      orderBy: { name: "asc" },
      include: {
        school: { select: { name: true } },
        caseStudy: { select: { status: true, content: true } },
        profile: { select: { expressiveChannel: true, barriers: true, sensoryProfile: true, readingSupport: true, writingSupport: true } },
        plans: { include: { objectives: true } },
        reports: { where: { status: "validado" }, select: { validatedAt: true } },
        assessments: { orderBy: { appliedAt: "asc" }, select: { appliedAt: true, answers: true } },
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
      .then((rows) => rows.map((row) => ({ role: row.role, schoolId: row.schoolId, studentIds: linkedStudentIds(row) }))),
    prisma.accessLog.groupBy({ by: ["action"], where: { student: studentWhere, createdAt }, _count: { _all: true } }),
    prisma.accessLog.findMany({ where: { student: studentWhere, createdAt, role: { not: AI_ACTOR.role } }, distinct: ["actor"], select: { actor: true } }),
    prisma.accessLog.groupBy({ by: ["detail"], where: { student: studentWhere, createdAt, detail: { in: Object.values(PLAN_PROPOSAL_DETAIL) } }, _count: { _all: true } }),
    prisma.activityImage.count({ where: { activity: { student: studentWhere }, createdAt } }),
    prisma.resource.findMany({ select: { id: true, title: true, timesUsed: true, positiveOutcomes: true }, orderBy: [{ timesUsed: "desc" }, { title: "asc" }] }),
    prisma.resourceActivity.count(),
  ]);

  type ScopedStudent = (typeof students)[number];
  const total = students.length;
  const count = (test: (student: ScopedStudent) => boolean) => students.filter(test).length;
  const activePlanOf = (student: ScopedStudent) => student.plans.find((plan) => plan.status === "ativo");
  const visible = (student: ScopedStudent) => canAccessStudent(user, student);
  const lastEntryOf = (student: ScopedStudent, objectiveId: string) => student.diaryEntries.findLast((entry) => entry.objectiveId === objectiveId);

  const entries = students.flatMap((student) => student.diaryEntries);
  const periodEntries = entries.filter((entry) => inPeriod(entry.date));
  const activities = students.flatMap((student) => student.activities);
  const periodActivities = activities.filter((activity) => inPeriod(activity.createdAt));
  const objectives = students.flatMap((student) => student.plans.flatMap((plan) => plan.objectives.map((objective) => ({ objective, plan, student }))));
  const profiles = students.flatMap((student) => (student.profile ? [student.profile] : []));

  const withActivePlan = count((student) => !!activePlanOf(student));
  const activeObjectives = objectives.filter(({ objective, plan }) => plan.status === "ativo" && objective.status === "ativo");
  const measurable = objectives.filter(({ objective }) => objective.status !== "em_revisao");
  const reduced = measurable.filter(({ objective, student }) => {
    if (objective.status === "alcancado") return true;
    const last = lastEntryOf(student, objective.id);
    return !!last && last.supportLevel < objective.currentSupport;
  }).length;
  const studentsWithRecord = count((student) => student.diaryEntries.some((entry) => inPeriod(entry.date)));
  const participation = countBy(periodEntries, (entry) => entry.participation);

  const alertsByStudent = students.map((student) => ({ student, alerts: studentAlerts({ plans: student.plans, entries: student.diaryEntries, now }) }));
  const reviewLimit = new Date(now.getTime() + REVIEW_HORIZON_DAYS * DAY_MS);

  const facts = students.map((student) => journeyFacts(student));
  const nextSteps = students.map((student, index) => getStudentNextStep({ id: student.id, ...facts[index] }));
  const periodFacts = students.map((student, index) => ({ ...facts[index], hasDiary: student.diaryEntries.some((entry) => inPeriod(entry.date)) }));
  const doneSteps = periodFacts.map((item) => JOURNEY_STEPS.filter((step) => step.done(item)).length);

  // Visão geral: cobertura, o que funciona e onde a ajuda é necessária.
  const lastRecords = students.map((student) => student.diaryEntries.at(-1)?.date ?? null);
  const backed = students.map((student) => censusReference(student.caseStudy && { status: student.caseStudy.status, content: parseCaseStudy(student.caseStudy.content) }, Boolean(activePlanOf(student))).backed);
  const coverageSteps = JOURNEY_STEPS.map((step) => ({
    key: step.key,
    label: step.label,
    done: step.key === "registro" ? lastRecords.filter((date) => recentRecord(date, now)).length : facts.filter((item) => step.done(item)).length,
  }));
  const pending = students
    .map((student, index) => ({ student, next: nextSteps[index], complete: JOURNEY_STEPS.every((step) => step.done(facts[index])) }))
    .filter(({ student, complete }) => !complete && visible(student))
    .sort((a, b) => a.next.step - b.next.step || a.student.name.localeCompare(b.student.name, "pt-BR"))
    .map(({ student, next }) => ({ id: student.id, name: student.name, className: student.className, school: student.school.name, next: { label: next.label, href: next.href } }));
  const schoolAlerts = schools
    .filter((school) => !schoolId || school.id === schoolId)
    .map((school): SchoolAlerts & { withoutReference: number } => {
      const indexes = students.flatMap((student, index) => (student.schoolId === school.id ? [index] : []));
      const withKind = (kind: StudentAlert["kind"]) => indexes.filter((index) => alertsByStudent[index].alerts.some((alert) => alert.kind === kind)).length;
      return {
        id: school.id,
        name: school.name,
        students: indexes.length,
        withAlerts: indexes.filter((index) => alertsByStudent[index].alerts.length > 0).length,
        byKind: (Object.keys(ALERTS) as StudentAlert["kind"][]).map((kind) => ({ kind, value: withKind(kind) })).filter((row) => row.value > 0),
        withoutReference: indexes.filter((index) => !backed[index]).length,
      };
    })
    .filter((school) => school.students > 0);
  const trendObjectives = activeObjectives.map(({ objective, student }) => {
    const steps = stepsFor(objective, student.diaryEntries);
    const latest = steps.lessons.at(-1);
    return {
      key: objective.id,
      action: objective.action,
      steps,
      level: latest?.level ?? null,
      participation: latest?.participation ?? null,
      student: visible(student) ? { id: student.id, name: student.name } : null,
    };
  });

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

  const withRecords = measurable.filter(({ objective, student }) => !!lastEntryOf(student, objective.id));
  const trends = countBy(activeObjectives, ({ objective, student }) => objectiveTrend(objective, student.diaryEntries).trend);

  const sources = Object.keys(SOURCE_LABELS).map((source) => {
    const list = periodActivities.filter((activity) => activity.source === source);
    const decided = list.filter((activity) => activity.status !== "sugerida");
    const used = decided.filter((activity) => prepared(activity.status)).length;
    return { source, label: SOURCE_LABELS[source], total: list.length, decided: decided.length, used, adhesion: percent(used, decided.length) };
  });

  const caaStudents = students.filter((student) => student.profile && usesAac(student.profile.expressiveChannel));
  const clusters = [
    { label: "CAA ou acionador", test: (profile: NonNullable<ScopedStudent["profile"]>) => usesAac(profile.expressiveChannel) },
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
      withAEE: total,
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
      records: periodEntries.length,
      studentsWithRecord,
      fullParticipation: participation.get("total") ?? 0,
      fullParticipationPct: percent(participation.get("total") ?? 0, periodEntries.length),
      preparedActivities: periodActivities.filter((activity) => prepared(activity.status)).length,
      pendingSuggestions: activities.filter((activity) => activity.status === "sugerida").length,
    },
    attention: {
      studentsWithAlerts: alertsByStudent.filter((item) => item.alerts.length).length,
      byKind: (Object.keys(ALERTS) as StudentAlert["kind"][]).map((kind) => ({
        key: kind, label: ALERTS[kind].label, short: shortOf(ALERTS, kind), value: alertsByStudent.filter((item) => item.alerts.some((alert) => alert.kind === kind)).length,
      })),
      reviewsSoon: count((student) => {
        const plan = activePlanOf(student);
        return !!plan && !isPastDay(plan.reviewDate, now) && plan.reviewDate <= reviewLimit;
      }),
      reviewHorizonDays: REVIEW_HORIZON_DAYS,
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
            plan: !plan ? "sem_plano" as const : isPastDay(plan.reviewDate, now) ? "vencido" as const : "ativo" as const,
            reviewDate: plan?.reviewDate ?? null,
            lastRecord: student.diaryEntries.at(-1)?.date ?? null,
            alerts: alerts.map((alert) => alert.kind),
            next: { label: next.label, href: next.href },
          };
        }),
    },
    questions: {
      coverage: { steps: coverageSteps, censusBacked: backed.filter(Boolean).length, pending },
      objectives: trendObjectives,
      schools: schoolAlerts,
    },
    journey: {
      steps: JOURNEY_STEPS.map((step) => ({
        key: step.key, label: step.label, step: step.step,
        done: periodFacts.filter((item) => step.done(item)).length,
      })),
      completion: percent(doneSteps.reduce((sum, done) => sum + done, 0), JOURNEY_STEPS.length * total),
    },
    calendar: {
      years: calendarYears,
      monthsWithRecords: calendarMonths.filter((month) => month.state === "registro").length,
      schoolMonths: calendarMonths.filter((month) => month.state === "registro" || month.state === "sem_registro").length,
      gaps: calendarMonths.filter((month) => month.state === "sem_registro").length,
    },
    learning: {
      trends: labeledRows(trends, TREND),
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
      assessment: (() => {
        const withTwo = students.filter((student) => student.assessments.length >= 2);
        const changes = withTwo.map((student) => compareAreas(answersOf(student.assessments[0].answers), answersOf(student.assessments.at(-1)!.answers)));
        return {
          upToDate: count((student) => !reassessmentDue(student.assessments.at(-1)?.appliedAt ?? null, now)),
          withBaseline: count((student) => student.assessments.length > 0),
          total,
          improved: AREAS.map((area) => ({ label: area.label, value: changes.filter((rows) => (rows.find((row) => row.area === area.key)?.change ?? 0) > 0).length })),
        };
      })(),
      reports: {
        covered: count((student) => student.reports.some((report) => report.validatedAt && now.getTime() - report.validatedAt.getTime() <= 183 * DAY_MS)),
        total,
      },
      bncc: {
        linked: objectives.filter(({ objective }) => objective.bnccCode).length,
        total: objectives.length,
        byComponent: byValue([...countBy(objectives, ({ objective }) => {
          const skill = bnccSkill(objective.bnccCode);
          return skill ? componentLabel(skill) : null;
        })].map(([key, value]) => ({ key, label: key, value }))),
      },
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
      byStatus: labeledRows(countBy(periodActivities, (activity) => activity.status), ACTIVITY_STATUS),
      byContext: labeledRows(countBy(periodActivities, (activity) => activity.context), CONTEXTS),
      sources,
      rejectReasons: topItems(periodActivities.filter((activity) => activity.status === "rejeitada").map((activity) => activity.rejectReason?.trim() || "Sem motivo informado"), 3),
    },
    ai: {
      providers: aiProviders(),
      planProposals: { ia: proposalCount(PLAN_PROPOSAL_DETAIL.ia), regras: proposalCount(PLAN_PROPOSAL_DETAIL.regras) },
      draftsPending: count((student) => !!student.planDraft),
      activities: sources.find((source) => source.source === "ia")!,
      images,
    },
    profile: {
      withoutProfile: total - profiles.length,
      byStage: labeledRows(countBy(students, (student) => student.stage), STAGES).filter((row) => row.value > 0),
      bySchool: schoolId ? [] : byValue(schools.map((school) => ({ key: school.id, label: school.name, value: count((student) => student.schoolId === school.id) }))),
      channels: byValue(labeledRows(countBy(profiles, (profile) => profile.expressiveChannel), CHANNELS)),
      barriers: byValue(labeledRows(countBy(profiles.flatMap((profile) => readList(profile.barriers)), (barrier) => barrier), BARRIERS)),
      hypersensitivity: SENSORY_AREAS.map((area) => ({
        key: area, label: SENSORY_LABELS[area], value: profiles.filter((profile) => parseJson<Record<string, string>>(profile.sensoryProfile, {})[area] === "hiper").length,
      })),
      caa: { total: caaStudents.length, withoutResources: caaStudents.filter((student) => !student.accessibilityNotes?.trim()).length },
      practices,
    },
    family: {
      notes: students.flatMap((student) => student.familyNotes).filter((note) => inPeriod(note.date)).length,
      records: periodEntries.filter((entry) => can(entry.authorRole, "familyPortal")).length,
      withAccess: count((student) => users.some((item) => isFamilyOf(item, student.id))),
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
      access: [AUDIT_ACTION.viewed, AUDIT_ACTION.created, AUDIT_ACTION.edited, AUDIT_ACTION.sent].map((action) => ({ key: action, value: accessCount(action) })),
      actors: actors.length,
    },
  };
}

export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;
