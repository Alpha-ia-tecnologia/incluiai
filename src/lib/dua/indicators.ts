import "server-only";
import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { parseJson } from "../format";
import { NO_BASE_TEXT, ratio, type AiBlock, type DuaIndicator } from "./domain";
import { canSeeDuaIndicators } from "./access";

// Indicadores de acompanhamento do DUA (seção 9): medidas de USO e DOCUMENTAÇÃO,
// cada uma com período, escopo, unidade e denominador. Denominador zero = "sem
// base para cálculo", nunca 0%. Não há nota, selo nem "conformidade DUA", e nada
// aqui infere melhoria da aprendizagem pela quantidade de registros.
// Só agregados: nenhum nome de estudante sai daqui.

const PLANNER_ROLES = ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"];

export type DuaIndicatorsResult = {
  period: { start: Date | null; end: Date };
  scopeLabel: string;
  indicators: DuaIndicator[];
  decisions: { aceito: number; editado: number; recusado: number; total: number };
  noBaseText: string;
};

export async function duaIndicators(user: SessionUser, scope: { start: Date | null; now: Date; schoolId: string | null; schoolName: string | null }): Promise<DuaIndicatorsResult | null> {
  if (!canSeeDuaIndicators(user)) return null;
  const { start, now, schoolId } = scope;
  const range = start ? { gte: start, lte: now } : { lte: now };
  const planningScope = schoolId ? { schoolId } : {};

  const [enabled, cohort, applications, suggestions] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: PLANNER_ROLES }, ...(schoolId ? { schoolId } : {}) }, select: { id: true } }),
    prisma.duaPlanning.findMany({
      where: { ...planningScope, createdAt: range },
      select: { id: true, versions: { select: { validatedAt: true } }, applications: { select: { createdAt: true } } },
    }),
    prisma.duaApplication.findMany({
      where: { planning: planningScope, state: "concluida", date: range },
      select: { id: true, participantIds: true, evidences: { select: { studentId: true, observation: true } } },
    }),
    prisma.duaSuggestion.findMany({ where: { planning: planningScope, createdAt: range }, select: { blocks: true } }),
  ]);

  // Adoção: profissionais habilitados que trabalharam num planejamento no período.
  const enabledIds = enabled.map((item) => item.id);
  const [auditActors, editors] = await Promise.all([
    prisma.duaAuditEvent.findMany({ where: { actorId: { in: enabledIds }, createdAt: range, planning: planningScope }, distinct: ["actorId"], select: { actorId: true } }),
    prisma.duaPlanningVersion.findMany({ where: { updatedById: { in: enabledIds }, updatedAt: range, planning: planningScope }, distinct: ["updatedById"], select: { updatedById: true } }),
  ]);
  const adopters = new Set([...auditActors.map((item) => item.actorId), ...editors.map((item) => item.updatedById)]);

  // Conclusão e utilização: coorte de planejamentos iniciados no período.
  const validatedByCut = cohort.filter((planning) => planning.versions.some((version) => version.validatedAt && version.validatedAt <= now));
  const usedValidated = validatedByCut.filter((planning) => planning.applications.some((application) => application.createdAt <= now));

  // Documentação individual: participação de um estudante numa aplicação concluída
  // no período, com evidência vinculada (observada ou "sem oportunidade" registrada).
  let pairs = 0;
  let documented = 0;
  for (const application of applications) {
    const participants = parseJson<string[]>(application.participantIds, []);
    pairs += participants.length;
    documented += participants.filter((id) => application.evidences.some((evidence) => evidence.studentId === id && evidence.observation !== "nao_registrado")).length;
  }

  // Revisão das sugestões: distribuição das decisões por bloco revisado.
  const decided = suggestions.flatMap((row) => parseJson<AiBlock[]>(row.blocks, [])).filter((block) => block.decision !== "pendente");
  const decisions = {
    aceito: decided.filter((block) => block.decision === "aceito").length,
    editado: decided.filter((block) => block.decision === "editado").length,
    recusado: decided.filter((block) => block.decision === "recusado").length,
    total: decided.length,
  };

  const indicator = (key: string, label: string, definition: string, unit: string, numerator: number, denominator: number): DuaIndicator => ({ key, label, definition, unit, numerator, denominator, value: ratio(numerator, denominator) });
  return {
    period: { start, end: now },
    scopeLabel: scope.schoolName ?? "Rede municipal (todas as escolas)",
    noBaseText: NO_BASE_TEXT,
    decisions,
    indicators: [
      indicator("adocao", "Adoção do fluxo", "Profissionais distintos que trabalharam num planejamento com DUA no período ÷ profissionais habilitados a planejar no mesmo recorte.", "profissionais", adopters.size, enabledIds.length),
      indicator("conclusao", "Conclusão do planejamento", "Planejamentos iniciados no período que chegaram à validação até hoje ÷ planejamentos iniciados no período.", "planejamentos", validatedByCut.length, cohort.length),
      indicator("utilizacao", "Utilização das atividades", "Planejamentos validados (iniciados no período) com aplicação registrada ÷ planejamentos validados da mesma coorte.", "planejamentos", usedValidated.length, validatedByCut.length),
      indicator("documentacao", "Documentação individual", "Participações de estudantes em aplicações concluídas no período com evidência vinculada ÷ participações em aplicações concluídas no período.", "participações", documented, pairs),
      indicator("revisao", "Revisão das sugestões", "Blocos de sugestão aceitos sem alteração ÷ blocos revisados no período (a distribuição completa aparece ao lado).", "blocos revisados", decisions.aceito, decisions.total),
    ],
  };
}
