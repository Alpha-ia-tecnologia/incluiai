import { notifyFamily } from "./notifications";
import type { FunctionalProfile, Student } from "@prisma/client";
import { db } from "./prisma";
import { AUDIT_ACTION, recordChange } from "./audit";
import { assertStudentTeam, type SessionUser } from "./auth";
import { parseJson } from "./format";
import { CHANNELS } from "./scale";
import { isActivityContext } from "./pedagogy-rules";
import { activityRow, type ActivityCard } from "./activity-engine";
import { studentAI } from "./agents/capabilities";
import { runAiJob } from "./agents/job";
import { materialContextText } from "./agents/context";
import { runMaterialAgent } from "./agents/material-agent";
import { guidanceForPlan, parseAccepted } from "./health-report";
import { applicableRules } from "./rules";
import { generateMaterialImages } from "./images/material-images";
import { assertImagesAllowed } from "./images/save";
import { UserError } from "./user-error";
import { invalidateStudent } from "./invalidate";
import {
  MATERIAL_KIND_LABEL, checkMaterial, isMaterialKind, normalizeMaterialContent, rulesMaterial,
  type MaterialContent, type ProfileFacts,
} from "./material-content";

export type MaterialRequest = { kind: string; topic: string; context: string; objectiveId?: string | null; withImages: boolean };

export function profileFacts(student: Pick<Student, "name">, profile: FunctionalProfile): ProfileFacts {
  const sensory = parseJson<Record<string, string>>(profile.sensoryProfile, {});
  return {
    firstName: student.name.split(" ")[0],
    expressiveChannel: profile.expressiveChannel,
    expressiveLabel: CHANNELS[profile.expressiveChannel] ?? profile.expressiveChannel,
    receptiveLabel: CHANNELS[profile.receptiveChannel] ?? profile.receptiveChannel,
    commandSteps: profile.commandSteps,
    attentionMinutes: profile.attentionMinutes,
    toleranceMinutes: profile.taskToleranceMinutes,
    interests: parseJson<string[]>(profile.interests, []).filter(Boolean),
    calming: parseJson<string[]>(profile.calmingStrategies, []).filter(Boolean),
    triggers: parseJson<string[]>(profile.triggers, []).filter(Boolean),
    sensitiveTo: Object.entries(sensory).filter(([, level]) => level === "hiper").map(([area]) => area),
    readingSupport: profile.readingSupport,
    fineMotorSupport: profile.fineMotor,
    usesWheelchair: profile.usesWheelchairOrOrthosis,
    strengths: profile.strengths ?? "",
  };
}

export async function createStudentMaterial(user: SessionUser, studentId: string, request: MaterialRequest) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  if (!isMaterialKind(request.kind)) throw new UserError("Escolha o tipo de material.");
  const kind = request.kind;
  const context = isActivityContext(request.context) ? request.context : "aee";
  const topic = request.topic.replace(/\s+/g, " ").trim().slice(0, 160);
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { profile: true, caseStudy: true } });
  const profile = student.profile;
  if (!profile) throw new UserError("Preencha Como aprende antes de gerar materiais.");
  const objective = request.objectiveId
    ? await prisma.objective.findFirst({ where: { id: request.objectiveId, plan: { studentId } }, select: { id: true, dimension: true, action: true, condition: true, criterion: true, currentSupport: true, targetSupport: true, bnccCode: true } })
    : null;
  if (request.objectiveId && !objective) throw new UserError("O objetivo escolhido não é do plano deste estudante.");
  const objectiveText = objective ? `${objective.action}, ${objective.condition}, ${objective.criterion}` : null;
  const facts = profileFacts(student, profile);
  const rules = { kind, toleranceMinutes: facts.toleranceMinutes };

  const { value: result, source, trace } = await runAiJob<{ title: string; content: MaterialContent }>({
    task: "material de apoio",
    madeByRules: "O material foi feito",
    scope: { student: studentId },
    student: studentId,
    run: async (model) => {
      const [entries, reports] = await Promise.all([
        prisma.diaryEntry.findMany({ where: { studentId }, orderBy: { date: "asc" } }),
        prisma.healthReport.findMany({ where: { studentId, reviewedAt: { not: null } }, select: { accepted: true } }),
      ]);
      const contextText = materialContextText({
        student, profile, caseStudyContent: student.caseStudy?.content, objective, entries,
        reportGuidance: guidanceForPlan(reports.map((item) => parseAccepted(item.accepted))),
      });
      return runMaterialAgent({ kind, topic, context, contextText, rules: applicableRules(profile), facts }, model);
    },
    rules: () => {
      const made = rulesMaterial({ kind, topic, context, objective: objectiveText, facts });
      made.content.reviewNotes = checkMaterial(made.content, rules);
      return made;
    },
  });

  const title = `${result.title.replace(/\s+/g, " ").trim().slice(0, 100)} · ${facts.firstName}`;
  const material = await prisma.material.create({
    data: { studentId, kind, title, content: JSON.stringify(result.content), source, topic: topic || null, context, objectiveId: objective?.id ?? null, status: "sugerido", trace: JSON.stringify(trace) },
  });
  await prisma.timelineEvent.create({ data: { studentId, type: "recurso", title: `Material de apoio preparado: ${title}`, description: `${MATERIAL_KIND_LABEL[kind]} com ${result.content.activities.length} atividade(s) para aplicar. Aguarda aprovação da equipe.` } });
  await recordChange(user, studentId, AUDIT_ACTION.created, `Material de apoio (${source === "ia" ? "agentes de IA" : "regras"}): ${MATERIAL_KIND_LABEL[kind]}`);

  let images = { created: 0, errors: [] as string[], requested: false };
  if (request.withImages && (await studentAI(studentId)).images) {
    images = { ...(await generateMaterialImages(material.id, user)), requested: true };
  }
  invalidateStudent(studentId);
  return { material, content: result.content, source, images };
}

async function loadOwnMaterial(user: SessionUser, studentId: string, materialId: string) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const material = await prisma.material.findFirst({ where: { id: materialId, studentId } });
  if (!material) throw new UserError("Material não encontrado para este estudante.", "not_found");
  return material;
}

export async function approveStudentMaterial(user: SessionUser, studentId: string, materialId: string) {
  const prisma = await db();
  const material = await loadOwnMaterial(user, studentId, materialId);
  await prisma.material.update({ where: { id: material.id }, data: { status: "aprovado", approvedBy: user.name, approvedAt: new Date() } });
  await recordChange(user, studentId, AUDIT_ACTION.edited, `Material de apoio aprovado para uso: ${material.title}`);
  await notifyFamily(studentId, "material_aprovado", `/familia/${studentId}#materiais`);
  invalidateStudent(studentId);
}

export async function addMaterialImages(user: SessionUser, studentId: string, materialId: string) {
  const material = await loadOwnMaterial(user, studentId, materialId);
  await assertImagesAllowed(studentId);
  const result = await generateMaterialImages(material.id, user);
  if (!result.created && result.errors.length) throw new UserError(result.errors[0]);
  invalidateStudent(studentId);
  return result;
}

export async function deleteStudentMaterial(user: SessionUser, studentId: string, materialId: string) {
  const prisma = await db();
  const material = await loadOwnMaterial(user, studentId, materialId);
  await prisma.material.delete({ where: { id: material.id } });
  await recordChange(user, studentId, AUDIT_ACTION.deleted, `Material de apoio: ${material.title}`);
  invalidateStudent(studentId);
}

export async function saveMaterialActivity(user: SessionUser, studentId: string, materialId: string, index: number) {
  const prisma = await db();
  const material = await loadOwnMaterial(user, studentId, materialId);
  const content = normalizeMaterialContent(parseJson<unknown>(material.content, {}));
  const activity = content.activities[index];
  if (!activity) throw new UserError("Atividade não encontrada neste material.", "not_found");
  const card: ActivityCard = {
    title: activity.title,
    context: activity.context,
    durationMinutes: activity.durationMinutes,
    materials: [material.title, ...activity.materials],
    steps: activity.steps,
    responseForm: activity.responseForms.join("; "),
    adaptations: content.adaptations.map((item) => ({ text: item.text, rule: item.basis })),
    supportBelow: activity.supportBelow,
    supportTarget: activity.supportTarget,
    supportAbove: activity.supportAbove,
    successCriterion: activity.successCriterion,
    planB: activity.planB,
    classParticipation: activity.classParticipation,
    reviewNotes: content.reviewNotes,
    source: material.source === "ia" ? "ia" : "regras",
  };
  const created = await prisma.activity.create({ data: { studentId, objectiveId: material.objectiveId, ...activityRow(card) } });
  await recordChange(user, studentId, AUDIT_ACTION.created, `Atividade a partir do material: ${activity.title}`);
  invalidateStudent(studentId);
  return created.id;
}
