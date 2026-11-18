import { db } from "./prisma";
import { rolesWith, type Capability } from "./roles";
import type { NoticeKind } from "./family-contact";

// Sem "server-only": o monitor do Censo grava avisos a partir de src/instrumentation.ts.

const CENSUS_PENDING_NOTICE = "censo_pendencias";
type Notice = { kind: NoticeKind | typeof CENSUS_PENDING_NOTICE; title: string; href: string; studentId?: string };

const recipientFields = { id: true, email: true, notifyByEmail: true } as const;
export type Recipient = { id: string; email: string; notifyByEmail: boolean };

export async function schoolRecipients(schoolId: string, capability: Capability): Promise<Recipient[]> {
  const prisma = await db();
  return prisma.user.findMany({ where: { role: { in: rolesWith(capability) }, schoolId, deactivatedAt: null }, select: recipientFields });
}

export async function familyRecipients(studentId: string): Promise<Recipient[]> {
  const prisma = await db();
  return prisma.user.findMany({ where: { role: { in: rolesWith("familyPortal") }, studentLinks: { some: { studentId } }, deactivatedAt: null }, select: recipientFields });
}

export async function writeNotices(recipients: readonly Recipient[], notice: Notice): Promise<void> {
  if (!recipients.length) return;
  const prisma = await db();
  await prisma.notification.createMany({ data: recipients.map((recipient) => ({ userId: recipient.id, ...notice })) });
}

export async function notifyCensusPending(school: { id: string; name: string }, pending: number): Promise<void> {
  await writeNotices(await schoolRecipients(school.id, "importCensus"), {
    kind: CENSUS_PENDING_NOTICE,
    title: `Censo: ${pending} ${pending === 1 ? "estudante do AEE" : "estudantes do AEE"} com pendência na ${school.name}`,
    href: "/censo",
  });
}
