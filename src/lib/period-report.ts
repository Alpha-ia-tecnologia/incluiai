// Relatório do período (devolutiva à família, Portaria MEC nº 421/2026, art. 11, IV),
// puro para teste com node --test (src/lib/period-report.test.mjs): o período,
// a fotografia dos registros e o rascunho do parecer, feito por regras (sem IA).
// O relatório validado não muda mais: guarda os dados como estavam.

export type ReportObjective = {
  description: string;
  dimension: string;
  bncc: { code: string; component: string; description: string } | null;
  status: string;
  supportStart: number;
  supportEnd: number | null;
  records: number;
};

export type ReportData = {
  version: 1;
  period: { start: string; end: string };
  student: { name: string; gradeYear: string; className: string; school: string };
  caseStudy: { concluded: boolean; synthesis: string | null; needs: string[] };
  objectives: ReportObjective[];
  aee: { done: number; absences: number; cancelled: number };
  strategies: string[];
  activities: string[];
  materials: string[];
  familyNotes: number;
  therapistReports: number;
  // Sondagem no período (apoio médio por área no começo e no fim); ausente em relatórios antigos.
  assessment?: { label: string; start: number | null; end: number | null }[] | null;
};

const DAY = 86_400_000;
export const isoDay = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
export const brDate = (iso: string) => iso.split("-").reverse().join("/");

// Semestre letivo de referência: janeiro a junho ou julho a dezembro.
export function currentSemester(today: Date = new Date()): { start: string; end: string } {
  const [year, month] = isoDay(today).split("-").map(Number);
  return month <= 6 ? { start: `${year}-01-01`, end: `${year}-06-30` } : { start: `${year}-07-01`, end: `${year}-12-31` };
}

export function periodProblem(start: string, end: string, today: Date = new Date()): string | null {
  const valid = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(`${iso}T12:00:00Z`));
  if (!valid(start) || !valid(end)) return "Informe o começo e o fim do período.";
  if (end < start) return "O fim do período precisa ser depois do começo.";
  if (start > isoDay(today)) return "O período precisa ter começado.";
  if ((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / DAY > 366) return "Escolha um período de até um ano.";
  return null;
}

// Nível de apoio de um objetivo numa data: o último registro de aula até ali,
// ou o nível do início do objetivo quando ainda não havia registro.
export function supportAt(entries: ReadonlyArray<{ date: Date; supportLevel: number }>, limit: Date, fallback: number | null): number | null {
  const before = entries.filter((entry) => entry.date <= limit).sort((a, b) => a.date.getTime() - b.date.getTime());
  return before.length ? before[before.length - 1].supportLevel : fallback;
}

// Itens mais citados (o que funcionou nos registros), sem repetir.
export function topItems(items: string[], limit = 5): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const raw of items) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const current = counts.get(key);
    counts.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit).map((item) => item.label);
}

export const lessSupport = (objective: ReportObjective) => objective.supportEnd !== null && objective.supportEnd < objective.supportStart;

// Rascunho do parecer, para o AEE ler, corrigir e completar antes de validar.
export function draftOpinion(data: ReportData): string {
  const name = data.student.name.split(" ")[0];
  const parts: string[] = [];
  const when = `Entre ${brDate(data.period.start)} e ${brDate(data.period.end)}`;
  const absences = `${data.aee.absences} ${data.aee.absences === 1 ? "falta" : "faltas"}`;
  parts.push(data.aee.done
    ? `${when}, ${name} participou de ${data.aee.done} ${data.aee.done === 1 ? "atendimento" : "atendimentos"} no AEE${data.aee.absences ? `, com ${absences}` : ", sem faltas"}.`
    : data.aee.absences
      ? `${when}, ${name} não teve atendimento do AEE realizado: foram ${absences}.`
      : `${when}, não há atendimentos do AEE registrados para ${name}.`);
  const followed = data.objectives.filter((objective) => objective.records > 0);
  const advanced = data.objectives.filter(lessSupport);
  if (data.objectives.length) {
    parts.push(advanced.length
      ? `Em ${advanced.length} de ${data.objectives.length} objetivos, passou a precisar de menos apoio: ${advanced.map((objective) => objective.description.replace(/\.$/, "")).join("; ")}.`
      : followed.length ? `Os ${data.objectives.length} objetivos do plano seguem em acompanhamento, ainda sem redução do apoio no período.` : "Os objetivos do plano ainda não têm registros de aula neste período.");
  }
  const improvedAreas = (data.assessment ?? []).filter((row) => row.start !== null && row.end !== null && row.end < row.start).map((row) => row.label.toLowerCase());
  if (improvedAreas.length) parts.push(`Na sondagem, passou a precisar de menos apoio em ${improvedAreas.join(", ")}.`);
  if (data.strategies.length) parts.push(`O que mais ajudou: ${data.strategies.join(", ")}.`);
  if (data.familyNotes) parts.push(`A família registrou ${data.familyNotes} ${data.familyNotes === 1 ? "observação" : "observações"} de casa no período.`);
  // Sem ponto depois do colchete: quem completa termina a frase.
  parts.push("Próximos passos: [complete com o que a equipe combinou para o próximo período]");
  return parts.join("\n\n");
}

// Parecer pronto para validar: escrito (não só o rascunho) e sem o marcador a completar.
export function opinionProblem(opinion: string): string | null {
  const text = opinion.trim();
  if (text.length < 80) return "Escreva o parecer do período (pelo menos algumas frases).";
  if (text.includes("[complete")) return "Complete o trecho entre colchetes antes de validar.";
  return null;
}
