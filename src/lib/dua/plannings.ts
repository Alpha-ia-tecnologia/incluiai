import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { parseJson } from "../format";
import {
  BARRIER_CATEGORIES, BARRIER_STATUSES, DUA_PRINCIPLES, collectiveCopy, emptyDuaContent, emptyStrategyDetails, normalizeContent, validationProblems,
  type DuaContent, type DuaOrigin, type OriginKind, type ReviewState, type Sharing,
} from "./domain";
import { canPlanDua, collaboratorIds, planningAccess, readablePlanningsWhere } from "./access";
import { DuaError, NOT_FOUND, audit, clip, contentOf, latestVersion, loadPlanningFor } from "./shared";

// Planejamento coletivo e suas versões (RF02, seção 7). Validada, a versão não
// muda: toda gravação é condicional (estado ≠ validado e mesma revisão), o que
// também avisa quando outro profissional salvou antes.

const MAX_CONTENT = 200_000;
const MAX_ITEMS = 40;

export type PlanningSummary = {
  id: string;
  title: string;
  ownerName: string;
  className: string | null;
  sharing: Sharing;
  updatedAt: Date;
  version: number;
  state: ReviewState;
  validatedVersion: number | null;
  applications: number;
  objective: string;
  canEdit: boolean;
  mine: boolean;
};

const normalizeText = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Busca por título, objetivo, barreira ou opção (evolução prevista no descritivo).
function matches(content: DuaContent, query: string) {
  const haystack = normalizeText([content.title, content.objective.learning, content.objective.curriculum, ...content.barriers.map((item) => item.description), ...content.strategies.map((item) => item.description)].join(" \n "));
  return normalizeText(query).split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

export async function listPlannings(user: SessionUser, filters: { query?: string; mine?: boolean } = {}): Promise<PlanningSummary[]> {
  if (!canPlanDua(user)) return [];
  const rows = await prisma.duaPlanning.findMany({
    where: readablePlanningsWhere(user),
    include: { versions: { select: { version: true, state: true, content: true }, orderBy: { version: "desc" } }, _count: { select: { applications: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows
    .map((row) => ({ row, access: planningAccess(user, row) }))
    .filter(({ row, access }) => access.read && (!filters.mine || row.ownerId === user.id || collaboratorIds(row.collaborators).includes(user.id)))
    .map(({ row, access }) => ({ row, access, latest: row.versions[0], content: contentOf(row.versions[0] ?? { content: "" }) }))
    .filter(({ content }) => !filters.query?.trim() || matches(content, filters.query))
    .map(({ row, access, latest, content }) => ({
      id: row.id,
      title: row.title,
      ownerName: row.ownerName,
      className: row.className,
      sharing: row.sharing as Sharing,
      updatedAt: row.updatedAt,
      version: latest?.version ?? 1,
      state: (latest?.state ?? "rascunho") as ReviewState,
      validatedVersion: row.versions.find((version) => version.state === "validado")?.version ?? null,
      applications: row._count.applications,
      objective: content.objective.learning,
      canEdit: access.edit,
      mine: row.ownerId === user.id,
    }));
}

// Turmas da escola de quem planeja (vínculo por nome, como no cadastro de estudantes).
export async function classOptions(user: SessionUser) {
  const classes = await prisma.schoolClass.findMany({ where: user.schoolId ? { schoolId: user.schoolId } : {}, select: { name: true, gradeYear: true, school: { select: { name: true } } }, orderBy: { name: "asc" } });
  return classes.map((item) => ({ value: item.name, label: user.schoolId ? `${item.name}${item.gradeYear ? ` · ${item.gradeYear}` : ""}` : `${item.name} · ${item.school.name}` }));
}

async function checkedClassName(user: SessionUser, className: string) {
  if (!className) return null;
  const known = await prisma.schoolClass.findFirst({ where: { name: className, ...(user.schoolId ? { schoolId: user.schoolId } : {}) }, select: { id: true } });
  if (!known) throw new DuaError("Escolha uma turma cadastrada na sua escola.");
  return className;
}

export async function createPlanning(user: SessionUser, input: { title: string; className?: string; reuseFromId?: string }) {
  if (!canPlanDua(user)) throw new DuaError("Seu perfil não planeja atividades com DUA.", "sem_permissao");
  const title = clip(input.title, 160);
  if (title.length < 3) throw new DuaError("Dê um título à atividade (ao menos 3 letras).");
  const className = await checkedClassName(user, clip(input.className, 80));

  let content: DuaContent = emptyDuaContent(title);
  let reusedFromId: string | null = null;
  if (input.reuseFromId) {
    // Reaproveitar (CA08): só o conteúdo coletivo, da última versão validada (ou da última).
    const { planning } = await loadPlanningFor(user, input.reuseFromId, "read");
    const source = (await prisma.duaPlanningVersion.findFirst({ where: { planningId: planning.id, state: "validado" }, orderBy: { version: "desc" } })) ?? (await latestVersion(planning.id));
    content = collectiveCopy(contentOf(source), title);
    reusedFromId = planning.id;
  }

  const planning = await prisma.duaPlanning.create({
    data: {
      title,
      ownerId: user.id,
      ownerName: user.name,
      schoolId: user.schoolId,
      className,
      reusedFromId,
      versions: { create: { version: 1, state: "rascunho", content: JSON.stringify(content), createdById: user.id, createdByName: user.name, updatedById: user.id, updatedByName: user.name } },
    },
  });
  await audit(user, planning.id, reusedFromId ? "reaproveitou" : "criou", "planejamento", { versionNumber: 1, detail: reusedFromId ? "Conteúdo coletivo copiado de outro planejamento (sem apoios, evidências ou materiais individuais)." : undefined });
  return planning.id;
}

export async function loadPlanning(user: SessionUser, planningId: string) {
  const { planning, access } = await loadPlanningFor(user, planningId, "read");
  const versions = await prisma.duaPlanningVersion.findMany({ where: { planningId }, orderBy: { version: "desc" } });
  const current = versions[0];
  if (!current) throw new DuaError(NOT_FOUND, "nao_encontrado");
  return {
    planning: { ...planning, collaboratorList: parseJson<Array<{ id: string; name: string }>>(planning.collaborators, []) },
    access,
    current: { ...current, content: contentOf(current), state: current.state as ReviewState },
    versions: versions.map((version) => ({ id: version.id, version: version.version, state: version.state as ReviewState, validatedAt: version.validatedAt, validatedByName: version.validatedByName, updatedAt: version.updatedAt, updatedByName: version.updatedByName })),
    validated: versions.filter((version) => version.state === "validado").map((version) => ({ id: version.id, version: version.version, content: contentOf(version) })),
  };
}

// ----------------------------------------------------------------- gravação do rascunho

const ids = (value: unknown) => (Array.isArray(value) ? value.map((item) => clip(item, 64)).filter(Boolean).slice(0, MAX_ITEMS) : []);
const texts = (value: unknown, max = 300) => (Array.isArray(value) ? value.map((item) => clip(item, max)).filter(Boolean).slice(0, MAX_ITEMS) : []);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

// Limpa o que veio da tela e preserva a origem gravada de cada item: a tela não
// consegue marcar um item como "sugestão revisada" nem apagar essa marca.
export function reconcileContent(previous: DuaContent, incoming: Partial<DuaContent>, authorKind: OriginKind): DuaContent {
  const raw = normalizeContent(incoming as DuaContent);
  const previousOrigins = new Map<string, DuaOrigin>([...previous.barriers, ...previous.strategies].map((item) => [item.id, item.origin]));
  const originOf = (id: string): DuaOrigin => previousOrigins.get(id) ?? { kind: authorKind };
  const uniqueId = (() => {
    const seen = new Set<string>();
    return (id: unknown) => {
      let value = clip(id, 64);
      if (!value || seen.has(value)) value = randomUUID();
      seen.add(value);
      return value;
    };
  })();
  const criteria = raw.criteria.slice(0, MAX_ITEMS).map((item) => ({ id: uniqueId(item.id), description: clip(item.description, 600) }));
  const barriers = raw.barriers.slice(0, MAX_ITEMS).map((item) => {
    const id = uniqueId(item.id);
    return { id, description: clip(item.description, 600), category: oneOf(item.category, BARRIER_CATEGORIES, "outra"), status: oneOf(item.status, BARRIER_STATUSES, "prevista"), origin: originOf(id) };
  });
  const strategies = raw.strategies.slice(0, MAX_ITEMS).map((item) => {
    const id = uniqueId(item.id);
    const details = { ...emptyStrategyDetails(), ...(item.details ?? {}) };
    return {
      id,
      description: clip(item.description, 1200),
      principles: [...new Set((item.principles ?? []).filter((principle) => DUA_PRINCIPLES.includes(principle)))],
      barrierIds: ids(item.barrierIds),
      criterionIds: ids(item.criterionIds),
      resources: texts(item.resources),
      context: clip(item.context, 300),
      details: { what: clip(details.what, 600), purpose: clip(details.purpose, 600), when: clip(details.when, 300), how: clip(details.how, 600) },
      origin: originOf(id),
    };
  });
  return {
    title: clip(raw.title, 160),
    objective: { learning: clip(raw.objective.learning, 2000), curriculum: clip(raw.objective.curriculum, 300) },
    criteria,
    context: { audience: clip(raw.context.audience, 300), organization: clip(raw.context.organization, 1200), resources: texts(raw.context.resources), notes: clip(raw.context.notes, 2000) },
    barriers,
    strategies,
    followUp: clip(raw.followUp, 2000),
  };
}

export type SaveResult =
  | { ok: true; revision: number; savedAt: string }
  | { ok: false; reason: "conflito"; revision: number; updatedByName: string; updatedAt: string; content: DuaContent }
  | { ok: false; reason: "validado"; message: string };

export async function saveDraft(user: SessionUser, planningId: string, input: { version: number; revision: number; content: Partial<DuaContent> }): Promise<SaveResult> {
  const { planning, access } = await loadPlanningFor(user, planningId, "edit");
  if (JSON.stringify(input.content ?? {}).length > MAX_CONTENT) throw new DuaError("O planejamento ficou grande demais para salvar. Divida em duas atividades.");
  const current = await prisma.duaPlanningVersion.findUnique({ where: { planningId_version: { planningId, version: input.version } } });
  if (!current) throw new DuaError(NOT_FOUND, "nao_encontrado");
  if (current.state === "validado") return { ok: false, reason: "validado", message: "Esta versão foi validada e não muda mais. Abra uma nova versão para editar." };
  const content = reconcileContent(contentOf(current), input.content ?? {}, access.owner ? "professor" : "colaboracao");
  const updated = await prisma.duaPlanningVersion.updateMany({
    where: { id: current.id, revision: input.revision, state: { not: "validado" } },
    data: { content: JSON.stringify(content), revision: { increment: 1 }, updatedById: user.id, updatedByName: user.name },
  });
  if (updated.count === 0) {
    const latest = await prisma.duaPlanningVersion.findUniqueOrThrow({ where: { id: current.id } });
    if (latest.state === "validado") return { ok: false, reason: "validado", message: "Esta versão acabou de ser validada e não muda mais. Abra uma nova versão para editar." };
    return { ok: false, reason: "conflito", revision: latest.revision, updatedByName: latest.updatedByName, updatedAt: latest.updatedAt.toISOString(), content: contentOf(latest) };
  }
  if (content.title && content.title !== planning.title) await prisma.duaPlanning.update({ where: { id: planningId }, data: { title: content.title } });
  else await prisma.duaPlanning.update({ where: { id: planningId }, data: { updatedAt: new Date() } });
  return { ok: true, revision: input.revision + 1, savedAt: new Date().toISOString() };
}

// ----------------------------------------------------------------- revisão, validação e versões

async function transition(user: SessionUser, planningId: string, version: number, revision: number, from: ReviewState[], data: Record<string, unknown>) {
  const current = await prisma.duaPlanningVersion.findUnique({ where: { planningId_version: { planningId, version } } });
  if (!current) throw new DuaError(NOT_FOUND, "nao_encontrado");
  const latest = await latestVersion(planningId);
  if (latest.id !== current.id) throw new DuaError("Há uma versão mais nova deste planejamento. Atualize a página.", "conflito");
  if (!from.includes(current.state as ReviewState)) throw new DuaError(current.state === "validado" ? "Esta versão já está validada." : "Esta versão não está no estado esperado. Atualize a página.", "conflito");
  const updated = await prisma.duaPlanningVersion.updateMany({ where: { id: current.id, revision, state: { in: from } }, data: { ...data, revision: { increment: 1 } } });
  if (updated.count === 0) throw new DuaError("Outro profissional alterou esta versão agora há pouco. Atualize a página e confira antes de continuar.", "conflito");
  return current;
}

export async function submitForReview(user: SessionUser, planningId: string, version: number, revision: number) {
  await loadPlanningFor(user, planningId, "edit");
  await transition(user, planningId, version, revision, ["rascunho"], { state: "em_revisao", submittedAt: new Date(), updatedById: user.id, updatedByName: user.name });
  await audit(user, planningId, "enviou para revisão", "versao", { versionNumber: version });
}

export async function returnToDraft(user: SessionUser, planningId: string, version: number, revision: number) {
  await loadPlanningFor(user, planningId, "edit");
  await transition(user, planningId, version, revision, ["em_revisao"], { state: "rascunho", updatedById: user.id, updatedByName: user.name });
  await audit(user, planningId, "voltou para rascunho", "versao", { versionNumber: version });
}

// "Validar para aplicação" (RF05): decisão pedagógica registrada com autoria, data
// e versão. Não altera matrícula, classificação nem dados censitários (CA12).
export async function validateVersion(user: SessionUser, planningId: string, version: number, revision: number) {
  await loadPlanningFor(user, planningId, "validate");
  const current = await prisma.duaPlanningVersion.findUnique({ where: { planningId_version: { planningId, version } } });
  if (!current) throw new DuaError(NOT_FOUND, "nao_encontrado");
  const problems = validationProblems(contentOf(current));
  if (problems.length) throw new DuaError("Ainda falta completar o planejamento para validar.", "invalido", problems);
  await transition(user, planningId, version, revision, ["rascunho", "em_revisao"], { state: "validado", validatedAt: new Date(), validatedById: user.id, validatedByName: user.name, updatedById: user.id, updatedByName: user.name });
  await audit(user, planningId, "validou para aplicação", "versao", { versionNumber: version });
}

// Editar depois de validar abre a versão seguinte; as aplicações continuam presas à versão usada (CA07).
export async function openNewVersion(user: SessionUser, planningId: string) {
  await loadPlanningFor(user, planningId, "edit");
  const latest = await latestVersion(planningId);
  if (latest.state !== "validado") return latest.version;
  try {
    await prisma.duaPlanningVersion.create({
      data: { planningId, version: latest.version + 1, state: "rascunho", content: latest.content, createdById: user.id, createdByName: user.name, updatedById: user.id, updatedByName: user.name },
    });
  } catch {
    // Outro profissional abriu a mesma versão ao mesmo tempo: segue com ela.
    return (await latestVersion(planningId)).version;
  }
  await audit(user, planningId, "abriu nova versão", "versao", { versionNumber: latest.version + 1, detail: `Copiada da versão ${latest.version}, que continua validada.` });
  return latest.version + 1;
}

// Compartilhar é decisão separada da validação e exige uma versão validada.
export async function setSharing(user: SessionUser, planningId: string, sharing: Sharing) {
  await loadPlanningFor(user, planningId, "share");
  if (sharing === "compartilhado") {
    const validated = await prisma.duaPlanningVersion.count({ where: { planningId, state: "validado" } });
    if (!validated) throw new DuaError("Valide o planejamento antes de compartilhar com a equipe.");
  }
  await prisma.duaPlanning.update({ where: { id: planningId }, data: sharing === "compartilhado" ? { sharing, sharedAt: new Date(), sharedBy: user.name } : { sharing, sharedAt: null, sharedBy: null } });
  await audit(user, planningId, sharing === "compartilhado" ? "compartilhou com a equipe" : "deixou de compartilhar", "planejamento");
}

// Colaboradores: profissionais que planejam, da mesma escola do planejamento.
export async function collaboratorOptions(user: SessionUser, planningId: string) {
  const { planning } = await loadPlanningFor(user, planningId, "read");
  const users = await prisma.user.findMany({
    where: { role: { in: ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"] }, id: { not: planning.ownerId }, ...(planning.schoolId ? { OR: [{ schoolId: planning.schoolId }, { schoolId: null }] } : {}) },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export async function setCollaborators(user: SessionUser, planningId: string, userIds: string[]) {
  await loadPlanningFor(user, planningId, "share");
  const allowed = new Map((await collaboratorOptions(user, planningId)).map((item) => [item.id, item]));
  const chosen = [...new Set(userIds)].filter((id) => allowed.has(id)).map((id) => ({ id, name: allowed.get(id)!.name }));
  await prisma.duaPlanning.update({ where: { id: planningId }, data: { collaborators: JSON.stringify(chosen) } });
  await audit(user, planningId, "definiu colaboradores", "planejamento", { detail: chosen.length ? chosen.map((item) => item.name).join(", ") : "Sem colaboradores" });
}

export async function planningHistory(user: SessionUser, planningId: string) {
  await loadPlanningFor(user, planningId, "read");
  const [versions, events] = await Promise.all([
    prisma.duaPlanningVersion.findMany({ where: { planningId }, orderBy: { version: "desc" } }),
    prisma.duaAuditEvent.findMany({ where: { planningId }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return {
    versions: versions.map((version) => ({ ...version, content: contentOf(version) })),
    events,
  };
}

