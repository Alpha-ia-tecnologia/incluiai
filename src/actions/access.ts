"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NOMINAL_ACCESS_HOURS, canAccessStudent, getCurrentUser, needsNominalJustification } from "@/lib/auth";
import { recordChange } from "@/lib/access-log";

export type NominalAccessState = { error?: string };

// Acesso nominal da Secretaria (seções 10 e 14): motivo obrigatório; vale 8 horas
// e entra no histórico de acessos que a família consulta.
export async function requestNominalAccess(studentId: string, _previous: NominalAccessState, formData: FormData): Promise<NominalAccessState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (!student || !canAccessStudent(user, student.schoolId, student.id)) return { error: "Estudante não encontrado no seu acesso." };
  if (!needsNominalJustification(user.role)) redirect(`/estudantes/${studentId}`);
  const reason = String(formData.get("reason") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  if (!reason) return { error: "Escolha o motivo do acesso." };
  if (detail.length < 10) return { error: "Descreva o motivo em pelo menos uma frase." };
  const text = `${reason}: ${detail}`.slice(0, 300);
  await prisma.accessGrant.create({ data: { userId: user.id, studentId, reason: text, expiresAt: new Date(Date.now() + NOMINAL_ACCESS_HOURS * 60 * 60 * 1000) } });
  await recordChange(user, studentId, "acesso justificado", text);
  redirect(`/estudantes/${studentId}`);
}
