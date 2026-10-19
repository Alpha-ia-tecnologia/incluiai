import "server-only";
import { prisma } from "./prisma";
import { isAIEnabled } from "./agents/model";
import { isImageGenerationEnabled } from "./images/openai-images";
import { recordChange } from "./access-log";
import type { SessionUser } from "./auth";

// Autorizações da família (seções 12 e 14 da proposta). Sem autorização:
// - IA: as propostas saem pelas regras da plataforma (nada sai do servidor) e o
//   assistente não consulta o estudante;
// - terapeuta: a conexão com a escola fica em espera (não vê o estudante nem envia relatório).

export type ConsentField = "aiUse" | "therapistLink";
export const CONSENT_LABEL: Record<ConsentField, string> = { aiUse: "Uso de IA", therapistLink: "Conexão com o terapeuta" };

export async function studentConsent(studentId: string): Promise<{ aiUse: boolean; therapistLink: boolean; updatedAt: Date | null; updatedBy: string | null }> {
  const consent = await prisma.consent.findUnique({ where: { studentId } });
  return { aiUse: consent?.aiUse ?? false, therapistLink: consent?.therapistLink ?? false, updatedAt: consent?.updatedAt ?? null, updatedBy: consent?.updatedBy ?? null };
}

// IA configurada E autorizada pela família deste estudante.
export async function aiAllowedFor(studentId: string): Promise<boolean> {
  if (!isAIEnabled()) return false;
  return (await studentConsent(studentId)).aiUse;
}

export async function imagesAllowedFor(studentId: string): Promise<boolean> {
  if (!isImageGenerationEnabled()) return false;
  return (await studentConsent(studentId)).aiUse;
}

// Só a família vinculada ao estudante decide; a decisão entra no histórico de acessos.
export async function setStudentConsent(user: SessionUser, studentId: string, field: ConsentField, value: boolean): Promise<void> {
  if (user.role !== "familia" || !user.studentIds.includes(studentId)) throw new Error("Só a família do estudante decide as autorizações.");
  await prisma.consent.upsert({
    where: { studentId },
    create: { studentId, [field]: value, updatedBy: user.name },
    update: { [field]: value, updatedBy: user.name },
  });
  await recordChange(user, studentId, value ? "autorizou" : "retirou a autorização", CONSENT_LABEL[field]);
}
