import "server-only";
import { prisma } from "../prisma";
import type { SessionUser } from "../auth";
import { parseJson } from "../format";
import {
  MATERIAL_ACCESSIBILITY, MATERIAL_FORMATS, MATERIAL_FORMAT_LABEL, buildActivityScript, buildSupportScript,
  type DuaSupportData, type MaterialFormat, type MaterialScope, type MaterialSection,
} from "./domain";
import { planningAccess } from "./access";
import { DuaError, STUDENT_FORBIDDEN, audit, canWorkWithStudent, clip, contentOf, loadPlanningFor, studentLog } from "./shared";

// Materiais vinculados à atividade (RF06). Cada um guarda a versão de origem, a
// finalidade, o formato e os recursos de acessibilidade, o escopo (coletivo ou
// individual), o autor, a participação de sugestões revisadas e a revisão.
// Sem validação, a impressão sai marcada como RASCUNHO.

const VALIDATORS = new Set(["professor_sala", "professor_aee", "coordenacao", "gestao"]);

export type MaterialInput = { versionNumber: number; format: string; purpose: string; scope: string; supportId: string; resourceId: string };

export async function createMaterial(user: SessionUser, planningId: string, input: MaterialInput) {
  const { planning, access } = await loadPlanningFor(user, planningId, "read");
  if (!MATERIAL_FORMATS.includes(input.format as MaterialFormat)) throw new DuaError("Escolha o formato do material.");
  const format = input.format as MaterialFormat;
  const scope: MaterialScope = input.scope === "individual" ? "individual" : "coletivo";
  const purpose = clip(input.purpose, 600);
  if (!purpose) throw new DuaError("Diga a finalidade pedagógica do material.");
  const version = await prisma.duaPlanningVersion.findUnique({ where: { planningId_version: { planningId, version: input.versionNumber } } });
  if (!version) throw new DuaError("Versão não encontrada.", "nao_encontrado");
  const content = contentOf(version);

  let studentId: string | null = null;
  let supportId: string | null = null;
  let sections: MaterialSection[];
  if (scope === "individual") {
    // Material individual: a partir do apoio do estudante, dentro do recorte dele.
    const support = await prisma.duaSupport.findUnique({ where: { id: input.supportId }, include: { student: { select: { id: true, schoolId: true } } } });
    if (!support || support.planningId !== planningId || !canWorkWithStudent(user, support.student)) throw new DuaError(STUDENT_FORBIDDEN, "sem_permissao");
    if (!access.edit && support.responsibleId !== user.id) throw new DuaError("Só quem responde pelo apoio ou edita o planejamento prepara o material individual.", "sem_permissao");
    studentId = support.studentId;
    supportId = support.id;
    sections = buildSupportScript(content, format, parseJson<DuaSupportData>(support.data, null as never));
  } else {
    if (!access.edit) throw new DuaError("Só quem edita o planejamento prepara materiais da turma.", "sem_permissao");
    sections = buildActivityScript(content, format);
  }

  let resourceId: string | null = null;
  if (format === "anexo") {
    const resource = await prisma.resource.findUnique({ where: { id: input.resourceId }, select: { id: true, title: true, description: true } });
    if (!resource) throw new DuaError("Escolha o material da biblioteca a anexar.");
    resourceId = resource.id;
    sections = [{ heading: resource.title, items: [resource.description] }, ...sections];
  }
  if (!sections.length) throw new DuaError("O planejamento ainda não tem conteúdo suficiente para este material (objetivo, opções ou critérios).");

  const withReviewedSuggestion = content.strategies.some((item) => item.origin.kind === "ia");
  const material = await prisma.duaMaterial.create({
    data: {
      planningId,
      versionNumber: version.version,
      format,
      title: `${MATERIAL_FORMAT_LABEL[format]} — ${content.title || planning.title}`,
      purpose,
      scope,
      studentId,
      supportId,
      resourceId,
      content: JSON.stringify(sections),
      accessibility: JSON.stringify(MATERIAL_ACCESSIBILITY[format]),
      aiParticipation: withReviewedSuggestion ? "conteudo_com_sugestao_revisada" : "nenhuma",
      authorId: user.id,
      authorName: user.name,
    },
  });
  await audit(user, planningId, "preparou material", "material", { objectId: material.id, versionNumber: version.version, detail: `${MATERIAL_FORMAT_LABEL[format]} (${scope})` });
  if (studentId) await studentLog(user, studentId, "criou", `Material individual da atividade com DUA "${planning.title}"`);
  return material.id;
}

async function loadMaterialFor(user: SessionUser, materialId: string) {
  const material = await prisma.duaMaterial.findUnique({ where: { id: materialId }, include: { planning: true, student: { select: { id: true, name: true, schoolId: true } } } });
  if (!material) throw new DuaError("Material não encontrado.", "nao_encontrado");
  const access = planningAccess(user, material.planning);
  if (!access.read || (material.student && !canWorkWithStudent(user, material.student))) throw new DuaError("Material não encontrado.", "nao_encontrado");
  return { material, access };
}

// Validação profissional para uso pedagógico: só de material de versão validada.
export async function validateMaterial(user: SessionUser, materialId: string, revision: number) {
  const { material, access } = await loadMaterialFor(user, materialId);
  let allowed = access.validate;
  if (!allowed && material.supportId) {
    const support = await prisma.duaSupport.findUnique({ where: { id: material.supportId }, select: { responsibleId: true } });
    allowed = support?.responsibleId === user.id && VALIDATORS.has(user.role);
  }
  if (!allowed) throw new DuaError("Você não pode validar este material.", "sem_permissao");
  const version = await prisma.duaPlanningVersion.findUnique({ where: { planningId_version: { planningId: material.planningId, version: material.versionNumber } }, select: { state: true } });
  if (version?.state !== "validado") throw new DuaError("Valide antes a versão do planejamento de onde o material saiu.");
  const updated = await prisma.duaMaterial.updateMany({ where: { id: materialId, revision }, data: { state: "validado", validatedAt: new Date(), validatedById: user.id, validatedByName: user.name, revision: { increment: 1 } } });
  if (!updated.count) throw new DuaError("Outro profissional alterou este material agora há pouco. Atualize a página.", "conflito");
  await audit(user, material.planningId, "validou material", "material", { objectId: materialId, versionNumber: material.versionNumber });
  if (material.studentId) await studentLog(user, material.studentId, "editou", `Material individual validado na atividade com DUA "${material.planning.title}"`);
}

export type MaterialView = {
  id: string;
  planningId: string;
  planningTitle: string;
  versionNumber: number;
  format: MaterialFormat;
  title: string;
  purpose: string;
  scope: MaterialScope;
  student: { id: string; name: string } | null;
  sections: MaterialSection[];
  accessibility: string[];
  aiParticipation: string;
  state: "rascunho" | "validado";
  revision: number;
  authorName: string;
  validatedByName: string | null;
  validatedAt: Date | null;
  createdAt: Date;
  // Quem está lendo pode validar? (o servidor confere de novo ao validar)
  canValidate: boolean;
};

type MaterialRow = Awaited<ReturnType<typeof loadMaterialFor>>["material"];

// Mesma regra de validateMaterial: quem valida o planejamento, ou o responsável pelo apoio (com papel de validação).
async function canValidateMaterial(user: SessionUser, row: MaterialRow) {
  if (planningAccess(user, row.planning).validate) return true;
  if (!row.supportId || !VALIDATORS.has(user.role)) return false;
  const support = await prisma.duaSupport.findUnique({ where: { id: row.supportId }, select: { responsibleId: true } });
  return support?.responsibleId === user.id;
}

const viewOf = (row: MaterialRow, canValidate: boolean): MaterialView => ({
  id: row.id,
  planningId: row.planningId,
  planningTitle: row.planning.title,
  versionNumber: row.versionNumber,
  format: row.format as MaterialFormat,
  title: row.title,
  purpose: row.purpose,
  scope: row.scope as MaterialScope,
  student: row.student ? { id: row.student.id, name: row.student.name } : null,
  sections: parseJson<MaterialSection[]>(row.content, []),
  accessibility: parseJson<string[]>(row.accessibility, []),
  aiParticipation: row.aiParticipation,
  state: row.state as MaterialView["state"],
  revision: row.revision,
  authorName: row.authorName,
  validatedByName: row.validatedByName,
  validatedAt: row.validatedAt,
  createdAt: row.createdAt,
  canValidate,
});

export async function listMaterials(user: SessionUser, planningId: string): Promise<MaterialView[]> {
  await loadPlanningFor(user, planningId, "read");
  const rows = await prisma.duaMaterial.findMany({ where: { planningId }, include: { planning: true, student: { select: { id: true, name: true, schoolId: true } } }, orderBy: { createdAt: "desc" } });
  const visible = rows.filter((row) => !row.student || canWorkWithStudent(user, row.student));
  return Promise.all(visible.map(async (row) => viewOf(row, await canValidateMaterial(user, row))));
}

export async function getMaterial(user: SessionUser, materialId: string): Promise<MaterialView> {
  const { material } = await loadMaterialFor(user, materialId);
  return viewOf(material, await canValidateMaterial(user, material));
}

// Materiais da biblioteca municipal que podem ser anexados.
export async function libraryOptions() {
  return prisma.resource.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" }, take: 300 });
}
