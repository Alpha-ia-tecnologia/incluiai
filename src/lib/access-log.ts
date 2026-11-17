import "server-only";
import { db } from "./prisma";

type Actor = { id: string; name: string; role: string };

const VIEW_INTERVAL_MS = 30 * 60 * 1000;

export async function recordView(user: Actor, studentId: string, section: string): Promise<void> {
  const prisma = await db();
  const since = new Date(Date.now() - VIEW_INTERVAL_MS);
  const recent = await prisma.accessLog.findFirst({ where: { studentId, actorId: user.id, action: "visualizou", detail: section, createdAt: { gte: since } }, select: { id: true } });
  if (recent) return;
  await prisma.accessLog.create({ data: { studentId, actorId: user.id, actor: user.name, role: user.role, action: "visualizou", detail: section } });
}

export async function recordChange(user: Actor, studentId: string, action: string, detail: string): Promise<void> {
  const prisma = await db();
  await prisma.accessLog.create({ data: { studentId, actorId: user.id, actor: user.name, role: user.role, action, detail: detail.slice(0, 200) } });
}

export const SUMMARY_VIEW_DETAILS = ["Resumo", "Visão geral do prontuário"];
