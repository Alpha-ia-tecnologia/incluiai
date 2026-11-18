import type { StudentAlert } from "./insights";

const ALERT_QUESTION: Record<StudentAlert["kind"], string> = {
  sem_plano: "O plano precisa ser revisado ou os prazos ajustados?",
  plano_vencido: "O plano precisa ser revisado ou os prazos ajustados?",
  sem_registro: "O que explica a ausência de registros recentes? Como retomar o acompanhamento?",
  queda_participacao: "A queda de participação é situacional? Vale revisar o nível de apoio ou o interesse âncora?",
};

export function meetingQuestions(input: {
  alerts: Pick<StudentAlert, "kind">[];
  stalledObjectives: string[];
  workedStrategies: string[];
  hasFamilyNote: boolean;
  hasIntersector: boolean;
}): string[] {
  const q: string[] = [];
  for (const alert of input.alerts) q.push(ALERT_QUESTION[alert.kind]);
  for (const obj of input.stalledObjectives) {
    q.push(`O objetivo "${obj}" está sem avanço — o próximo passo está grande demais? Vale fracionar?`);
  }
  if (input.workedStrategies.length > 0) {
    q.push(`As estratégias que funcionaram (${input.workedStrategies.slice(0, 3).join(", ")}) podem ser generalizadas para outros contextos?`);
  }
  if (input.hasIntersector) q.push("Como incorporar as orientações do relatório de articulação intersetorial no planejamento?");
  if (!input.hasFamilyNote) q.push("O que a família tem observado em casa? Como aproximar o registro familiar?");
  if (q.length === 0) q.push("O acompanhamento está estável — quais metas ampliar para o próximo ciclo?");
  return q;
}
