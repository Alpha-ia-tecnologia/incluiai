import { addDays, brDay, dayStart, daysBetween, formatDateShort } from "./dates.ts";
import { plural } from "./format.ts";
import { RECORD_GAP_DAYS, type StudentAlert } from "./student-alerts.ts";

export const REVIEW_HORIZON_DAYS = 30;
export const QUEUE_VISIBLE = 6;

export type QueueKind =
  | "aula" | "conquista" | "semana" | "orientacao" | "sugestao" | "proposta" | "novo"
  | "revisao" | "sem_registro" | "evolucao" | "estudo";

export type QueueItem = {
  key: string;
  kind: QueueKind;
  title: string;
  subject: string | null;
  detail: string | null;
  href: string;
  date: Date | null;
  when: string | null;
  count: number | null;
  crossed: boolean;
};

export type Queue = { recent: QueueItem[]; due: QueueItem[] };

export type QueueStudent = {
  id: string;
  name: string;
  createdAt: Date;
  alerts: ReadonlyArray<StudentAlert>;
  reviewDate: Date | null;
  caseStudy: { status: string; updatedAt: Date } | null;
  hasPlan: boolean;
  hasRecord: boolean;
};

type Dated = { studentId: string; date: Date };
export type QueueFacts = {
  students: ReadonlyArray<QueueStudent>;
  records: ReadonlyArray<Dated & { author: string | null }>;
  familyNotes: ReadonlyArray<Dated & { author: string; note: string }>;
  checkIns: ReadonlyArray<Dated & { author: string }>;
  guidance: ReadonlyArray<Dated & { author: string }>;
  suggestions: ReadonlyArray<Dated>;
  planDrafts: ReadonlyArray<Dated>;
};

export const queueSince = (now: Date) => dayStart(addDays(brDay(now), -1));

export function whenWords(date: Date, now: Date): string {
  const days = daysBetween(brDay(now), brDay(date));
  if (days === 0) return "hoje";
  if (days === -1) return "ontem";
  if (days === 1) return "amanhã";
  const span = Math.abs(days) < 60 ? plural(Math.abs(days), "dia", "dias") : plural(Math.round(Math.abs(days) / 30), "mês", "meses");
  return days > 0 ? `em ${span}` : `há ${span}`;
}

const listNames = (names: ReadonlyArray<string>) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`);
const newest = (items: ReadonlyArray<Dated>) => items.reduce((last, item) => (item.date > last ? item.date : last), items[0].date);
const oldest = (items: ReadonlyArray<Dated>) => items.reduce((first, item) => (item.date < first ? item.date : first), items[0].date);

function byStudent<T extends Dated>(items: ReadonlyArray<T>): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.studentId, [...(groups.get(item.studentId) ?? []), item]);
  return groups;
}

const isNewStudent = (student: QueueStudent, since: Date) => student.createdAt >= since && !student.hasPlan && !student.hasRecord;
const isReviewDue = (student: QueueStudent, now: Date): student is QueueStudent & { reviewDate: Date } =>
  student.reviewDate !== null && daysBetween(brDay(now), brDay(student.reviewDate)) <= REVIEW_HORIZON_DAYS;
const hasAlert = (student: QueueStudent, ...kinds: StudentAlert["kind"][]) => student.alerts.some((alert) => kinds.includes(alert.kind));

export function buildQueue(facts: QueueFacts, options: { now: Date; nominal: boolean }): Queue {
  return options.nominal ? nominalQueue(facts, options.now) : networkQueue(facts, options.now);
}

function nominalQueue(facts: QueueFacts, now: Date): Queue {
  const since = queueSince(now);
  const students = new Map(facts.students.map((student) => [student.id, student]));
  const recent: QueueItem[] = [];
  const due: QueueItem[] = [];
  const item = (fields: Omit<QueueItem, "subject" | "when" | "count" | "crossed" | "detail"> & Partial<Pick<QueueItem, "crossed" | "detail">>, studentId: string): QueueItem | null => {
    const student = students.get(studentId);
    if (!student) return null;
    return { detail: null, crossed: false, ...fields, subject: student.name, when: fields.date ? whenWords(fields.date, now) : null, count: null };
  };
  const push = (list: QueueItem[], entry: QueueItem | null) => { if (entry) list.push(entry); };
  const fresh = <T extends Dated>(items: ReadonlyArray<T>) => items.filter((entry) => entry.date >= since);

  for (const [id, records] of byStudent(fresh(facts.records))) {
    const authors = [...new Set(records.flatMap((record) => (record.author ? [record.author] : [])))];
    push(recent, item({ key: `aula-${id}`, kind: "aula", title: records.length === 1 ? "Aula registrada" : `${records.length} aulas registradas`, detail: authors.length ? `por ${listNames(authors)}` : null, href: `/estudantes/${id}/diario#historico-registros`, date: newest(records) }, id));
  }
  for (const note of fresh(facts.familyNotes)) {
    push(recent, item({ key: `conquista-${note.studentId}-${note.date.getTime()}`, kind: "conquista", title: "Conquista contada pela família", detail: `${note.author}: “${note.note}”`, href: `/estudantes/${note.studentId}`, date: note.date }, note.studentId));
  }
  for (const checkIn of fresh(facts.checkIns)) {
    push(recent, item({ key: `semana-${checkIn.studentId}-${checkIn.date.getTime()}`, kind: "semana", title: "A família contou como foi a semana", detail: checkIn.author, href: `/estudantes/${checkIn.studentId}/diario`, date: checkIn.date }, checkIn.studentId));
  }
  for (const report of fresh(facts.guidance)) {
    push(recent, item({ key: `orientacao-${report.studentId}-${report.date.getTime()}`, kind: "orientacao", title: "Nova orientação do terapeuta", detail: report.author, href: `/estudantes/${report.studentId}`, date: report.date }, report.studentId));
  }
  for (const [id, waiting] of byStudent(facts.suggestions)) {
    const isNew = waiting.some((entry) => entry.date >= since);
    const noun = waiting.length === 1 ? "Sugestão de atividade" : `${waiting.length} sugestões de atividade`;
    push(isNew ? recent : due, item({ key: `sugestao-${id}`, kind: "sugestao", title: `${noun} ${isNew ? "para avaliar" : "aguardando"}`, href: `/estudantes/${id}/atividades`, date: isNew ? newest(waiting) : oldest(waiting) }, id));
  }
  for (const draft of facts.planDrafts) {
    const isNew = draft.date >= since;
    push(isNew ? recent : due, item({ key: `proposta-${draft.studentId}`, kind: "proposta", title: isNew ? "Proposta de plano para revisar" : "Proposta de plano aguardando revisão", href: `/estudantes/${draft.studentId}/ppi`, date: draft.date }, draft.studentId));
  }

  for (const student of facts.students) {
    const id = student.id;
    if (isNewStudent(student, since)) push(recent, item({ key: `novo-${id}`, kind: "novo", title: "Estudante novo", href: `/estudantes/${id}`, date: student.createdAt }, id));
    if (isReviewDue(student, now)) {
      const overdue = hasAlert(student, "plano_vencido");
      push(due, item({ key: `revisao-${id}`, kind: "revisao", title: overdue ? "Revisão do plano vencida" : "Revisão do plano", detail: `marcada para ${formatDateShort(student.reviewDate)}`, href: `/estudantes/${id}/ppi#revisao`, date: student.reviewDate, crossed: overdue }, id));
    }
    const gap = student.alerts.find((alert) => alert.kind === "sem_registro");
    if (gap) {
      push(due, item({ key: `sem-registro-${id}`, kind: "sem_registro", title: "Sem registro de aula", detail: student.hasRecord ? `último em ${formatDateShort(gap.since)}` : "nenhum desde o início do plano", href: `/estudantes/${id}/diario`, date: gap.since, crossed: true }, id));
    }
    const evolution = student.alerts.find((alert) => alert.kind === "tendencia" || alert.kind === "queda_participacao");
    if (evolution) {
      push(due, item({ key: `evolucao-${id}`, kind: "evolucao", title: "Evolução pede atenção", detail: evolution.message, href: `/estudantes/${id}/linha-do-tempo`, date: evolution.since, crossed: true }, id));
    }
    if (student.caseStudy?.status === "rascunho") {
      push(due, item({ key: `estudo-${id}`, kind: "estudo", title: "Estudo de caso em rascunho", detail: `editado em ${formatDateShort(student.caseStudy.updatedAt)}`, href: `/estudantes/${id}/estudo-de-caso`, date: student.caseStudy.updatedAt }, id));
    }
  }

  const time = (entry: QueueItem) => entry.date?.getTime() ?? 0;
  const name = (a: QueueItem, b: QueueItem) => (a.subject ?? "").localeCompare(b.subject ?? "", "pt-BR");
  recent.sort((a, b) => time(b) - time(a) || name(a, b));
  due.sort((a, b) => time(a) - time(b) || Number(b.crossed) - Number(a.crossed) || name(a, b));
  return { recent, due };
}

function networkQueue(facts: QueueFacts, now: Date): Queue {
  const since = queueSince(now);
  const counted = (key: string, kind: QueueKind, count: number, [one, many]: [string, string], crossed = false, href = "/painel#atencao"): QueueItem[] =>
    count ? [{ key, kind, title: count === 1 ? one : many, subject: null, detail: null, href, date: null, when: null, count, crossed }] : [];
  const students = facts.students;
  const count = (test: (student: QueueStudent) => boolean) => students.filter(test).length;
  return {
    recent: [
      ...counted("aulas", "aula", facts.records.filter((record) => record.date >= since).length, ["Aula registrada", "Aulas registradas"], false, "/painel"),
      ...counted("conquistas", "conquista", facts.familyNotes.filter((note) => note.date >= since).length, ["Conquista contada pela família", "Conquistas contadas pelas famílias"], false, "/painel"),
      ...counted("novos", "novo", count((student) => isNewStudent(student, since)), ["Estudante novo", "Estudantes novos"], false, "/painel"),
    ],
    due: [
      ...counted("revisoes-vencidas", "revisao", count((student) => hasAlert(student, "plano_vencido")), ["Plano com revisão vencida", "Planos com revisão vencida"], true),
      ...counted("sem-registro", "sem_registro", count((student) => hasAlert(student, "sem_registro")), [`Estudante sem registro há ${RECORD_GAP_DAYS} dias ou mais`, `Estudantes sem registro há ${RECORD_GAP_DAYS} dias ou mais`], true),
      ...counted("evolucao", "evolucao", count((student) => hasAlert(student, "tendencia", "queda_participacao")), ["Estudante com a evolução pedindo atenção", "Estudantes com a evolução pedindo atenção"], true),
      ...counted("revisoes", "revisao", count((student) => isReviewDue(student, now) && !hasAlert(student, "plano_vencido")), [`Revisão de plano nos próximos ${REVIEW_HORIZON_DAYS} dias`, `Revisões de plano nos próximos ${REVIEW_HORIZON_DAYS} dias`]),
    ],
  };
}
