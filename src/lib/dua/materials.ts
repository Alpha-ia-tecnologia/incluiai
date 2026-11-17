import "server-only";
import { db } from "../prisma";
import { studentForbidden, type SessionUser } from "../auth";
import { UserError } from "../user-error";
import { canWorkWithStudent } from "../policy";
import { can } from "../roles";
import { parseJson } from "../format";
import {
  MATERIAL_ACCESSIBILITY, MATERIAL_FORMATS, MATERIAL_FORMAT_LABEL, buildActivityScript, buildSupportScript,
  type DuaSupportData, type MaterialFormat, type MaterialScope, type MaterialSection,
} from "./domain";
import { planningAccess } from "./access";
import { audit, clip, contentOf, loadPlanningFor } from "./shared";
import { AUDIT_ACTION, recordChange } from "../audit";

export type MaterialInput = { versionNumber: number; format: string; purpose: string; scope: string; supportId: string; resourceId: string };

export async function createMaterial(user: SessionUser, planningId: string, input: MaterialInput) {
  const prisma = await db();
  const { planning, access } = await loadPlanningFor(user, planningId, "read");
  if (!MATERIAL_FORMATS.includes(input.format as MaterialFormat)) throw new UserError("Escolha o formato do material.");
  const format = input.format as MaterialFormat;
  const scope: MaterialScope = input.scope === "individual" ? "individual" : "coletivo";
  const purpose = clip(input.purpose, 600);
  if (!purpose) throw new UserError("Diga a finalidade pedagógica do material.");
  const version = await prisma.duaPlanningVersion.findUnique({ where: { planningId_version: { planningId, version: input.versionNumber } } });
  if (!version) throw new UserError("Versão não encontrada.", "not_found");
  const content = contentOf(version);

  let studentId: string | null = null;
  let supportId: string | null = null;
  let sections: MaterialSection[];
  if (scope === "individual") {
    const support = await prisma.duaSupport.findUnique({ where: { id: input.supportId }, include: { student: { select: { id: true, schoolId: true } } } });
    if (!support || support.planningId !== planningId || !canWorkWithStudent(user, support.student)) throw studentForbidden();
    if (!access.edit && support.responsibleId !== user.id) throw new UserError("Só quem responde pelo apoio ou edita o planejamento prepara o material individual.", "forbidden");
    studentId = support.studentId;
    supportId = support.id;
    sections = buildSupportScript(content, format, parseJson<DuaSupportData>(support.data, null as never));
  } else {
    if (!access.edit) throw new UserError("Só quem edita o planejamento prepara materiais da turma.", "forbidden");
    sections = buildActivityScript(content, format);
  }

  let resourceId: string | null = null;
  if (format === "anexo") {
    const resource = await prisma.resource.findUnique({ where: { id: input.resourceId }, select: { id: true, title: true, description: true } });
    if (!resource) throw new UserError("Escolha o material da biblioteca a anexar.");
    resourceId = resource.id;
    sections = [{ heading: resource.title, items: [resource.description] }, ...sections];
  }
  if (!sections.length) throw new UserError("O planejamento ainda não tem conteúdo suficiente para este material (objetivo, opções ou critérios).");

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
  if (studentId) await recordChange(user, studentId, AUDIT_ACTION.created, `Material individual da atividade com DUA "${planning.title}"`);
  return material.id;
}

async function loadMaterialFor(user: SessionUser, materialId: string) {
  const prisma = await db();
  const material = await prisma.duaMaterial.findUnique({ where: { id: materialId }, include: { planning: true, student: { select: { id: true, name: true, schoolId: true } } } });
  if (!material) throw new UserError("Material não encontrado.", "not_found");
  const access = planningAccess(user, material.planning);
  if (!access.read || (material.student && !canWorkWithStudent(user, material.student))) throw new UserError("Material não encontrado.", "not_found");
  return { material, access };
}

export async function validateMaterial(user: SessionUser, materialId: string, revision: number) {
  const prisma = await db();
  const { material } = await loadMaterialFor(user, materialId);
  if (!(await canValidateMaterial(user, material))) throw new UserError("Você não pode validar este material.", "forbidden");
  const version = await prisma.duaPlanningVersion.findUnique({ where: { planningId_version: { planningId: material.planningId, version: material.versionNumber } }, select: { state: true } });
  if (version?.state !== "validado") throw new UserError("Valide antes a versão do planejamento de onde o material saiu.");
  const updated = await prisma.duaMaterial.updateMany({ where: { id: materialId, revision }, data: { state: "validado", validatedAt: new Date(), validatedById: user.id, validatedByName: user.name, revision: { increment: 1 } } });
  if (!updated.count) throw new UserError("Outro profissional alterou este material agora há pouco. Atualize a página.", "conflict");
  await audit(user, material.planningId, "validou material", "material", { objectId: materialId, versionNumber: material.versionNumber });
  if (material.studentId) await recordChange(user, material.studentId, AUDIT_ACTION.edited, `Material individual validado na atividade com DUA "${material.planning.title}"`);
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
  canValidate: boolean;
};

type MaterialRow = Awaited<ReturnType<typeof loadMaterialFor>>["material"];

async function canValidateMaterial(user: SessionUser, row: MaterialRow) {
  const prisma = await db();
  if (planningAccess(user, row.planning).validate) return true;
  if (!row.supportId || !can(user.role, "validateDua")) return false;
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
  const prisma = await db();
  await loadPlanningFor(user, planningId, "read");
  const rows = await prisma.duaMaterial.findMany({ where: { planningId }, include: { planning: true, student: { select: { id: true, name: true, schoolId: true } } }, orderBy: { createdAt: "desc" } });
  const visible = rows.filter((row) => !row.student || canWorkWithStudent(user, row.student));
  return Promise.all(visible.map(async (row) => viewOf(row, await canValidateMaterial(user, row))));
}

export async function getMaterial(user: SessionUser, materialId: string): Promise<MaterialView> {
  const { material } = await loadMaterialFor(user, materialId);
  return viewOf(material, await canValidateMaterial(user, material));
}

export async function libraryOptions() {
  const prisma = await db();
  return prisma.resource.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" }, take: 300 });
}
