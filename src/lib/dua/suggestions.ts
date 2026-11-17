import "server-only";
import { aiAllowedFor } from "../consent";
import { randomUUID } from "node:crypto";
import { db } from "../prisma";
import type { SessionUser } from "../auth";
import { parseJson } from "../format";
import { AGENT_MODEL, DEEPSEEK_MODEL, createAgentModel, isAIEnabled } from "../agents/model";
import { createAnonymizer, nameTokens, type Anonymizer } from "../agents/anonymize";
import { checkBlocks, prepareContext, rulesBlocks, type DuaAiContext, type RawBlocks } from "./checks";
import { runDuaSuggestionAgents, type DuaAgentsResult } from "./suggestion-agents";
import { describeAgentError } from "../agents/generate";
import {
  DUA_PRINCIPLES, PRINCIPLE_LABEL, suggestionStateAfter,
  type AiBlock, type AiCheck, type AiPurpose, type AiState, type DuaContent, type DuaPrinciple, type DuaSupportData,
} from "./domain";
import { planningAccess } from "./access";
import { DuaError, audit, basisHashOf, canWorkWithStudent, clip, contentOf, latestVersion, loadPlanningFor, studentLog } from "./shared";

export const DUA_PROMPT_VERSION = "dua-sugestoes-2026-11-v2";

async function knownNames(schoolId: string | null) {
  const prisma = await db();
  const [students, users, schools] = await Promise.all([
    prisma.student.findMany({ where: schoolId ? { schoolId } : {}, select: { name: true, guardianName: true } }),
    prisma.user.findMany({ select: { name: true } }),
    prisma.school.findMany({ select: { name: true } }),
  ]);
  const people = [...students.map((item) => item.name), ...students.map((item) => item.guardianName), ...users.map((item) => item.name)].filter(Boolean);
  return { students: students.map((item) => item.name), guardians: students.map((item) => item.guardianName).filter(Boolean), professionals: users.map((item) => item.name), schools: schools.map((item) => item.name), people };
}

function duaAnonymizer(names: Awaited<ReturnType<typeof knownNames>>, studentName: string): Anonymizer {
  const parts = (list: string[]) => list.flatMap((name) => [name, ...nameTokens(name)]);
  return createAnonymizer({
    student: studentName,
    classmates: parts(names.students.filter((name) => name !== studentName)),
    family: parts(names.guardians),
    professionals: parts(names.professionals),
    schools: names.schools,
  });
}

export async function requestSuggestion(user: SessionUser, planningId: string, input: { purpose: AiPurpose; supportId?: string; profileFields?: string[]; requestId: string }) {
  const prisma = await db();
  const requestId = clip(input.requestId, 80);
  if (!requestId) throw new DuaError("Pedido sem identificador. Atualize a página e tente de novo.");
  const existing = await prisma.duaSuggestion.findUnique({ where: { requestId } });
  if (existing) {
    if (existing.planningId !== planningId || existing.requestedById !== user.id) throw new DuaError("Pedido inválido.", "conflito");
    return existing.id;
  }

  const { planning, access } = await loadPlanningFor(user, planningId, "read");
  const version = await latestVersion(planningId);
  const content = contentOf(version);
  let support: { id: string; studentId: string; data: DuaSupportData; student: { id: string; name: string; schoolId: string } } | null = null;
  if (input.purpose === "apoio_individual") {
    const row = await prisma.duaSupport.findUnique({ where: { id: input.supportId ?? "" }, include: { student: { select: { id: true, name: true, schoolId: true } } } });
    if (!row || row.planningId !== planningId || !canWorkWithStudent(user, row.student)) throw new DuaError("Apoio não encontrado.", "nao_encontrado");
    if (!access.edit && row.responsibleId !== user.id) throw new DuaError("Só quem responde pelo apoio pede sugestão para ele.", "sem_permissao");
    support = { id: row.id, studentId: row.studentId, data: parseJson<DuaSupportData>(row.data, null as never), student: row.student };
  } else if (!access.edit) {
    throw new DuaError("Só quem edita o planejamento pede sugestões de opções.", "sem_permissao");
  }
  if (!content.objective.learning.trim()) throw new DuaError("Escreva o objetivo de aprendizagem antes de pedir sugestões: elas partem dele.");

  const profile = support ? support.data.profileRefs.filter((ref) => (input.profileFields ?? []).includes(ref.field)) : [];
  const context: DuaAiContext = {
    purpose: input.purpose,
    objective: content.objective,
    criteria: content.criteria.filter((item) => item.description.trim()).map(({ id, description }) => ({ id, description })),
    barriers: content.barriers.filter((item) => item.description.trim()).map(({ id, description, category, status }) => ({ id, description, category, status })),
    organization: content.context.organization,
    resources: content.context.resources,
    existingStrategies: content.strategies.map((item) => ({ description: item.description, principles: item.principles })),
    individual: support ? { barrier: support.data.barrier.description, support: support.data.support, purpose: support.data.purpose, profile: profile.map(({ label, value }) => ({ label, value })) } : null,
  };

  const names = await knownNames(support?.student.schoolId ?? planning.schoolId ?? user.schoolId);
  const anonymizer = duaAnonymizer(names, support?.student.name ?? "");
  const basisHash = basisHashOf(content);
  const base = {
    planningId, requestId, purpose: input.purpose, supportId: support?.id ?? null, studentId: support?.studentId ?? null,
    versionNumber: version.version, revision: version.revision, basisHash, profileFields: JSON.stringify(profile.map((ref) => ({ field: ref.field, version: ref.version }))),
    promptVersion: DUA_PROMPT_VERSION, requestedById: user.id, requestedByName: user.name,
  };

  const useAI = support ? await aiAllowedFor(support.studentId) : isAIEnabled();
  let state: AiState = "aguardando_revisao";
  let provider = useAI ? "ia" : "regras";
  let model: string | null = useAI ? null : "regras-dua-v1";
  let raw: RawBlocks | null = null;
  let review: DuaAgentsResult["review"] | null = null;
  let error: string | null = null;
  let removed = 0;

  if (useAI) {
    const prepared = prepareContext(context, anonymizer, names.people, names.schools);
    if (!prepared.ok) {
      state = "bloqueado";
      error = `O contexto ainda tinha dados que identificam pessoas (${prepared.reasons.join(", ")}). Nada foi enviado. Revise os textos do planejamento.`;
    } else {
      removed = prepared.removed;
      const agents = createAgentModel(anonymizer);
      try {
        ({ raw, review } = await runDuaSuggestionAgents({
          prompt: `Contexto pedagógico sem dados pessoais (${input.purpose === "apoio_individual" ? "apoio individual" : "opções para a turma"}):\n${prepared.prompt}`,
          context, people: names.people, schools: names.schools,
        }, agents.model));
        const viaDeepSeek = agents.deepseekAgents().length > 0;
        model = viaDeepSeek ? DEEPSEEK_MODEL : AGENT_MODEL;
        if (viaDeepSeek && support) await studentLog({ ...user, name: "Agentes de IA", role: "sistema" }, support.studentId, "enviou", "Informações pedagógicas, sem dados pessoais, enviadas ao DeepSeek (sugestão de apoio na atividade com DUA)");
      } catch (failure) {
        state = "falhou";
        error = `A IA não respondeu (${describeAgentError(failure)}). O preenchimento manual continua disponível.`;
      }
    }
  } else {
    provider = "regras";
    raw = rulesBlocks(context);
  }

  let blocks: AiBlock[] = [];
  let checks: AiCheck[] = [];
  if (raw) {
    ({ blocks, checks } = checkBlocks(raw, context, names.people, names.schools));
    if (!blocks.length) { state = "falhou"; error = "A resposta não trouxe nenhuma sugestão aproveitável."; }
    if (review) {
      checks.push({
        name: "Revisão pelos agentes",
        passed: review.pending.length === 0,
        detail: review.pending.length
          ? `Depois de uma correção, o revisor ainda apontou pontos em: ${review.pending.map((principle) => PRINCIPLE_LABEL[principle].toLowerCase()).join(", ")}. Eles aparecem nos blocos.`
          : `Analista, um especialista por princípio do DUA e revisor: nenhum ponto pendente${review.rounds > 1 ? ", depois de uma correção" : ""}.`,
      });
    }
  }
  const suggestion = await prisma.duaSuggestion.create({
    data: { ...base, provider, model, state, checks: JSON.stringify(checks), blocks: JSON.stringify(blocks), removedCount: removed, error },
  });
  await audit(user, planningId, "pediu sugestão", "sugestao", { objectId: suggestion.id, versionNumber: version.version, detail: `${provider === "ia" ? `IA (${model ?? "sem resposta"})` : "regras da plataforma"} · ${state}` });
  if (support) await studentLog(user, support.studentId, "criou", `Sugestão para revisão pedida para o apoio na atividade com DUA "${planning.title}"`);
  return suggestion.id;
}

export type SuggestionView = {
  id: string;
  purpose: AiPurpose;
  supportId: string | null;
  studentName: string | null;
  versionNumber: number;
  provider: string;
  model: string | null;
  promptVersion: string;
  state: AiState;
  checks: AiCheck[];
  blocks: AiBlock[];
  removedCount: number;
  error: string | null;
  requestedByName: string;
  createdAt: Date;
  stale: boolean;
};

export async function listSuggestions(user: SessionUser, planningId: string): Promise<SuggestionView[]> {
  const prisma = await db();
  await loadPlanningFor(user, planningId, "read");
  const [rows, version] = await Promise.all([
    prisma.duaSuggestion.findMany({ where: { planningId }, include: { student: { select: { id: true, name: true, schoolId: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    latestVersion(planningId),
  ]);
  const currentHash = basisHashOf(contentOf(version));
  return rows.filter((row) => !row.student || canWorkWithStudent(user, row.student)).map((row) => ({
    id: row.id,
    purpose: row.purpose as AiPurpose,
    supportId: row.supportId,
    studentName: row.student?.name ?? null,
    versionNumber: row.versionNumber,
    provider: row.provider,
    model: row.model,
    promptVersion: row.promptVersion,
    state: row.state as AiState,
    checks: parseJson<AiCheck[]>(row.checks, []),
    blocks: parseJson<AiBlock[]>(row.blocks, []),
    removedCount: row.removedCount,
    error: row.error,
    requestedByName: row.requestedByName,
    createdAt: row.createdAt,
    stale: row.state === "aguardando_revisao" && row.basisHash !== currentHash,
  }));
}

export type BlockDecisionInput = {
  decision: "aceito" | "editado" | "recusado";
  strategy?: string;
  principles?: DuaPrinciple[];
  includeCriterion?: boolean;
  reason?: string;
  confirmStale?: boolean;
};

export async function decideBlock(user: SessionUser, suggestionId: string, blockId: string, input: BlockDecisionInput) {
  const prisma = await db();
  const row = await prisma.duaSuggestion.findUnique({ where: { id: suggestionId }, include: { planning: true, student: { select: { id: true, schoolId: true } } } });
  if (!row) throw new DuaError("Sugestão não encontrada.", "nao_encontrado");
  const access = planningAccess(user, row.planning);
  if (!access.read || (row.student && !canWorkWithStudent(user, row.student))) throw new DuaError("Sugestão não encontrada.", "nao_encontrado");
  const blocks = parseJson<AiBlock[]>(row.blocks, []);
  const block = blocks.find((item) => item.id === blockId);
  if (!block) throw new DuaError("Bloco não encontrado.", "nao_encontrado");
  if (block.decision !== "pendente") throw new DuaError("Este bloco já foi decidido.", "conflito");
  if (row.state !== "aguardando_revisao") throw new DuaError("Esta sugestão não aguarda revisão.", "conflito");
  const accepting = input.decision !== "recusado";
  if (accepting && block.flags.blocked) throw new DuaError("Este bloco foi barrado pelas verificações e só pode ser recusado.");

  const version = await latestVersion(row.planningId);
  const content: DuaContent = contentOf(version);
  if (accepting && basisHashOf(content) !== row.basisHash && !input.confirmStale) {
    throw new DuaError("O objetivo, os critérios ou as barreiras mudaram depois desta sugestão. Confira de novo e confirme antes de aceitar.", "conflito");
  }
  const strategyText = clip(input.decision === "editado" ? input.strategy : block.strategy, 1200);
  const principles = input.decision === "editado" && input.principles?.length ? [...new Set(input.principles.filter((item) => DUA_PRINCIPLES.includes(item)))] : block.principles;
  if (accepting && (!strategyText || !principles.length)) throw new DuaError("Descreva a opção e escolha o princípio antes de aceitar.");

  if (accepting && row.purpose === "opcoes") {
    if (!access.edit) throw new DuaError("Só quem edita o planejamento incorpora sugestões.", "sem_permissao");
    if (version.state === "validado") throw new DuaError("A versão atual está validada. Abra uma nova versão para incorporar a sugestão.", "conflito");
    const origin = { kind: "ia" as const, suggestionId: row.id, blockId: block.id };
    let barrierIds = block.barrierConsidered.barrierId ? [block.barrierConsidered.barrierId] : [];
    if (!barrierIds.length && block.barrierConsidered.hypothesis) {
      const id = randomUUID();
      content.barriers.push({ id, description: block.barrierConsidered.hypothesis, category: "outra", status: "hipotese", origin });
      barrierIds = [id];
    }
    const criterionIds: string[] = [];
    if (input.includeCriterion && block.criterionProposal) {
      const id = randomUUID();
      content.criteria.push({ id, description: block.criterionProposal });
      criterionIds.push(id);
    }
    content.strategies.push({
      id: randomUUID(), description: strategyText, principles, barrierIds, criterionIds, resources: block.resources,
      context: "", details: { what: "", purpose: block.justification, when: "", how: "" }, origin,
    });
    const saved = await prisma.duaPlanningVersion.updateMany({
      where: { id: version.id, revision: version.revision, state: { not: "validado" } },
      data: { content: JSON.stringify(content), revision: { increment: 1 }, updatedById: user.id, updatedByName: user.name },
    });
    if (!saved.count) throw new DuaError("O rascunho foi alterado agora há pouco. Atualize a página e decida de novo.", "conflito");
  }

  if (accepting && row.purpose === "apoio_individual") {
    const support = await prisma.duaSupport.findUnique({ where: { id: row.supportId ?? "" } });
    if (!support || (!access.edit && support.responsibleId !== user.id)) throw new DuaError("Só quem responde pelo apoio incorpora a sugestão.", "sem_permissao");
    const data = parseJson<DuaSupportData>(support.data, null as never);
    const next: DuaSupportData = { ...data, support: [data.support.trim(), strategyText].filter(Boolean).join("\n"), origin: data.origin.kind === "ia" ? data.origin : { kind: "ia", suggestionId: row.id, blockId: block.id } };
    const saved = await prisma.duaSupport.updateMany({ where: { id: support.id, revision: support.revision }, data: { data: JSON.stringify(next), state: "rascunho", validatedAt: null, validatedById: null, validatedByName: null, revision: { increment: 1 } } });
    if (!saved.count) throw new DuaError("O apoio foi alterado agora há pouco. Atualize a página e decida de novo.", "conflito");
  }

  const decided: AiBlock = { ...block, decision: input.decision, decidedBy: { id: user.id, name: user.name }, decidedAt: new Date().toISOString(), reason: clip(input.reason, 600) || null, ...(input.decision === "editado" ? { strategy: strategyText, principles } : {}) };
  const nextBlocks = blocks.map((item) => (item.id === blockId ? decided : item));
  const updated = await prisma.duaSuggestion.updateMany({ where: { id: row.id, blocks: row.blocks }, data: { blocks: JSON.stringify(nextBlocks), state: suggestionStateAfter(nextBlocks) } });
  if (!updated.count) throw new DuaError("Outra decisão foi registrada agora há pouco. Atualize a página.", "conflito");
  await audit(user, row.planningId, `${input.decision === "recusado" ? "recusou" : input.decision === "editado" ? "aceitou com edição" : "aceitou"} bloco de sugestão`, "sugestao", { objectId: row.id, versionNumber: version.version });
}
