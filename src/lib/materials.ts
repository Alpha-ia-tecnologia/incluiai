// Perguntas para reunião (item 9) — aponta o que a equipe precisa discutir,
// sem conclusões automáticas. Determinístico e auditável.
export function meetingQuestions(input: {
  alerts: { message: string }[];
  stalledObjectives: string[];
  workedStrategies: string[];
  hasFamilyNote: boolean;
  hasIntersector: boolean;
}): string[] {
  const q: string[] = [];
  for (const a of input.alerts) {
    if (a.message.includes("plano")) q.push("O plano precisa ser revisado ou os prazos ajustados?");
    else if (a.message.includes("registro")) q.push("O que explica a ausência de registros recentes? Como retomar o acompanhamento?");
    else if (a.message.includes("participação")) q.push("A queda de participação é situacional? Vale revisar o nível de apoio ou o interesse âncora?");
  }
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

// Materiais de apoio (item 17.10): tipos, conteúdo e regras em material-content.ts;
// geração (IA ou regras) em material-generate.ts.
export { MATERIAL_KINDS, type MaterialContent, type MaterialKind } from "./material-content";
