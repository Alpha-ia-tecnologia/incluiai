import "server-only";
import { db } from "./prisma";
import { rolesWith } from "./roles";

export type AuditActor = { id: string | null; name: string; role: string };

export const AI_ACTOR: AuditActor = { id: null, name: "Agentes de IA", role: "sistema" };

export const AUDIT_ACTION = {
  viewed: "visualizou",
  created: "criou",
  edited: "editou",
  updated: "atualizou",
  changed: "alterou",
  recorded: "registrou",
  sent: "enviou",
  sentToAi: "enviou à IA",
  attached: "anexou",
  deleted: "excluiu",
  replaced: "trocou",
  accepted: "aceitou",
  declined: "recusou",
  approved: "aprovou",
  validated: "validou",
  reviewed: "revisou",
  closed: "encerrou",
  authorized: "autorizou",
  revoked: "retirou a autorização",
  justifiedAccess: "acesso justificado",
} as const;
type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export const SUMMARY_SECTION = "Resumo";
// Os registros gravados antes da troca do nome da seção dizem "Visão geral do prontuário".
const SUMMARY_VIEW_DETAILS = [SUMMARY_SECTION, "Visão geral do prontuário"];

export const PLAN_PROPOSAL_DETAIL = { ia: "Proposta de plano (agentes de IA)", regras: "Proposta de plano (regras)" } as const;

const VIEW_INTERVAL_MS = 30 * 60 * 1000;

export const auditEntry = (actor: AuditActor, action: AuditAction, detail: string) =>
  ({ actorId: actor.id, actor: actor.name, role: actor.role, action, detail: detail.slice(0, 200) });

export async function recordView(actor: AuditActor & { id: string }, studentId: string, section: string): Promise<void> {
  const prisma = await db();
  const entry = auditEntry(actor, AUDIT_ACTION.viewed, section);
  const since = new Date(Date.now() - VIEW_INTERVAL_MS);
  const recent = await prisma.accessLog.findFirst({ where: { studentId, actorId: actor.id, action: entry.action, detail: entry.detail, createdAt: { gte: since } }, select: { id: true } });
  if (recent) return;
  await prisma.accessLog.create({ data: { studentId, ...entry } });
}

export async function recordChange(actor: AuditActor, studentId: string, action: AuditAction, detail: string): Promise<void> {
  const prisma = await db();
  await prisma.accessLog.create({ data: { studentId, ...auditEntry(actor, action, detail) } });
}

export async function recordDeepSeekUse(studentId: string, purpose = "fallback de IA"): Promise<void> {
  await recordChange(AI_ACTOR, studentId, AUDIT_ACTION.sent, `Informações pedagógicas, sem dados pessoais, enviadas ao DeepSeek (${purpose})`);
}

export async function summarySeenByTeam(studentId: string, after: Date, until: Date | null = null): Promise<Date | null> {
  const prisma = await db();
  const log = await prisma.accessLog.findFirst({
    where: { studentId, detail: { in: SUMMARY_VIEW_DETAILS }, role: { in: rolesWith("pedagogical") }, createdAt: until ? { gt: after, lte: until } : { gt: after } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return log?.createdAt ?? null;
}
