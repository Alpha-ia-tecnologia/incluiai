import "server-only";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

// Registro de leitura (seção 14): quem abriu qual parte da ficha do estudante.
// Uma linha por pessoa, estudante e aba a cada 30 minutos, para o histórico que
// a família consulta mostrar acessos, não cada clique.
const VIEW_INTERVAL_MS = 30 * 60 * 1000;

export async function recordView(user: SessionUser, studentId: string, section: string): Promise<void> {
  const since = new Date(Date.now() - VIEW_INTERVAL_MS);
  const recent = await prisma.accessLog.findFirst({ where: { studentId, actorId: user.id, action: "visualizou", detail: section, createdAt: { gte: since } }, select: { id: true } });
  if (recent) return;
  await prisma.accessLog.create({ data: { studentId, actorId: user.id, actor: user.name, role: user.role, action: "visualizou", detail: section } });
}

// Alteração feita pela equipe (decisão de atividade, objetivo, registro de aula).
export async function recordChange(user: SessionUser, studentId: string, action: string, detail: string): Promise<void> {
  await prisma.accessLog.create({ data: { studentId, actorId: user.id, actor: user.name, role: user.role, action, detail: detail.slice(0, 200) } });
}
