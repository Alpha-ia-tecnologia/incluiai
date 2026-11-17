import "server-only";
import { db } from "./prisma";
import { assertStudentTeam, type SessionUser } from "./auth";
import { AUDIT_ACTION, recordChange } from "./audit";
import { canAccessSchool } from "./policy";
import { can } from "./roles";
import { UserError } from "./user-error";
import { invalidateStudent } from "./invalidate";
import { studentAI } from "./agents/capabilities";
import { ILLUSTRATION } from "./agents/descriptors";
import { buildActivityCards, saveSuggestedActivities } from "./agents/generate";
import type { AgentReport } from "./agents/types";
import { assertImagesAllowed, createActivityImage } from "./images/save";

export type ActivityRequest = { objectiveId: string; lessonTopic: string; withImages: boolean };

export async function generateActivities(user: SessionUser, studentId: string, request: ActivityRequest, report?: AgentReport) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { profile: true } });
  const objective = await prisma.objective.findFirst({ where: { id: request.objectiveId, plan: { studentId } } });
  if (!objective) throw new UserError("Objetivo de outro estudante.");
  const { profile } = student;
  if (!profile) throw new UserError("Preencha o perfil funcional antes de gerar atividades.");

  const withImages = request.withImages && (await studentAI(studentId)).images;
  if (withImages) report?.({ agent: ILLUSTRATION, phase: "queued" });
  const cards = await buildActivityCards({ student, profile, objective, lessonTopic: request.lessonTopic }, report);
  const created = await saveSuggestedActivities(studentId, objective.id, cards);
  invalidateStudent(studentId);
  if (!withImages) return { cards, created, images: null };

  report?.({ agent: ILLUSTRATION, phase: "start" });
  const results = await Promise.allSettled(created.map((activity) => createActivityImage(activity.id, "sequencia", user)));
  report?.({ agent: ILLUSTRATION, phase: "end" });
  for (const result of results) {
    if (result.status === "rejected") console.error("[imagens] falha ao gerar imagem da atividade:", result.reason);
  }
  return { cards, created, images: results.filter((result) => result.status === "fulfilled").length };
}

export async function generateClassActivities(user: SessionUser, schoolId: string, className: string, lessonTopic: string): Promise<string[]> {
  const prisma = await db();
  if (!schoolId || !className) throw new UserError("Selecione a turma.");
  if (!can(user.role, "editRecord") || !canAccessSchool(user, schoolId)) throw new UserError("Você não tem permissão para planejar com esta turma.", "forbidden");
  const students = await prisma.student.findMany({
    where: { schoolId, className, status: "ativo" },
    include: {
      profile: true,
      plans: { where: { status: "ativo" }, include: { objectives: { where: { status: "ativo" }, take: 1 } } },
    },
  });
  const done: string[] = [];
  for (const student of students) {
    const { profile } = student;
    const objective = student.plans[0]?.objectives[0];
    if (!profile || !objective) continue;
    await saveSuggestedActivities(student.id, objective.id, await buildActivityCards({ student, profile, objective, lessonTopic }));
    invalidateStudent(student.id);
    done.push(student.id);
  }
  return done;
}

async function assertOwnActivity(user: SessionUser, studentId: string, activityId: string) {
  const prisma = await db();
  await assertStudentTeam(user, studentId);
  const activity = await prisma.activity.findFirst({ where: { id: activityId, studentId }, select: { id: true } });
  if (!activity) throw new UserError("Atividade não encontrada.", "not_found");
}

export async function illustrateActivity(user: SessionUser, studentId: string, activityId: string, kind: string) {
  await assertOwnActivity(user, studentId, activityId);
  await assertImagesAllowed(studentId);
  await createActivityImage(activityId, kind.trim().slice(0, 500) || "sequencia", user);
  invalidateStudent(studentId);
}

export async function removeActivityImage(user: SessionUser, studentId: string, activityId: string) {
  const prisma = await db();
  await assertOwnActivity(user, studentId, activityId);
  const removed = await prisma.activityImage.deleteMany({ where: { activityId } });
  if (removed.count) await recordChange(user, studentId, AUDIT_ACTION.deleted, "Imagem de apoio da atividade");
  invalidateStudent(studentId);
}
