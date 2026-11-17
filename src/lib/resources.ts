import "server-only";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { can } from "./roles";
import { UserError } from "./user-error";

export async function registerResourceUse(user: SessionUser, resourceId: string, activityId: string, worked: boolean) {
  const prisma = await db();
  if (!can(user.role, "pedagogical")) throw new UserError("Apenas a equipe escolar pode registrar aplicações.", "forbidden");
  const activity = await prisma.resourceActivity.findFirst({ where: { id: activityId, resourceId }, select: { id: true } });
  if (!activity) throw new UserError("Atividade não pertence a este recurso.", "not_found");
  const counters = { timesUsed: { increment: 1 }, ...(worked ? { positiveOutcomes: { increment: 1 } } : {}) };
  await prisma.$transaction([
    prisma.resource.update({ where: { id: resourceId }, data: counters }),
    prisma.resourceActivity.update({ where: { id: activity.id }, data: counters }),
  ]);
}
