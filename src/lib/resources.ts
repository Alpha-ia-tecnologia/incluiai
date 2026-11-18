import "server-only";
import { db } from "./prisma";
import type { SessionUser } from "./auth";
import { can } from "./roles";
import { UserError } from "./user-error";
import { textContains } from "./db-text";

export async function searchResources(filters: { q: string; stage?: string; type?: string }) {
  const prisma = await db();
  return prisma.resource.findMany({
    where: {
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.type ? { resourceType: filters.type } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: textContains(filters.q) },
              { description: textContains(filters.q) },
              { skillArea: textContains(filters.q) },
              { accessibilityNeed: textContains(filters.q) },
            ],
          }
        : {}),
    },
    include: { _count: { select: { activities: true } } },
    orderBy: [{ timesUsed: "desc" }, { title: "asc" }],
  });
}

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
