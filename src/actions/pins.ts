"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";

// Fixa ou solta um estudante no mural (Início) da própria pessoa. Fixado, ele
// sobe para o topo com a tachinha; não muda nada para o resto da equipe.
export async function togglePin(studentId: string) {
  const user = await getCurrentUser();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (!user || !student || !isStaffOrNetwork(user.role) || !canAccessStudent(user, student.schoolId, student.id)) {
    throw new Error("Você não tem acesso a este estudante.");
  }
  const where = { userId_studentId: { userId: user.id, studentId } };
  const pinned = await prisma.pinnedStudent.findUnique({ where, select: { id: true } });
  if (pinned) await prisma.pinnedStudent.delete({ where });
  else await prisma.pinnedStudent.create({ data: { userId: user.id, studentId } });
  revalidatePath("/");
}
