"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { NOMINAL_ACCESS_HOURS, getCurrentUser } from "@/lib/auth";
import { canAccessStudent } from "@/lib/policy";
import { can } from "@/lib/roles";
import { AUDIT_ACTION, recordChange } from "@/lib/audit";

export type NominalAccessState = { error?: string };

export async function requestNominalAccess(studentId: string, _previous: NominalAccessState, formData: FormData): Promise<NominalAccessState> {
  const prisma = await db();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (!student || !canAccessStudent(user, student)) return { error: "Estudante não encontrado no seu acesso." };
  if (can(user.role, "seeNames")) redirect(`/estudantes/${studentId}`);
  const reason = String(formData.get("reason") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  if (!reason) return { error: "Escolha o motivo do acesso." };
  if (detail.length < 10) return { error: "Descreva o motivo em pelo menos uma frase." };
  const text = `${reason}: ${detail}`.slice(0, 300);
  await prisma.accessGrant.create({ data: { userId: user.id, studentId, reason: text, expiresAt: new Date(Date.now() + NOMINAL_ACCESS_HOURS * 60 * 60 * 1000) } });
  await recordChange(user, studentId, AUDIT_ACTION.justifiedAccess, text);
  redirect(`/estudantes/${studentId}`);
}
