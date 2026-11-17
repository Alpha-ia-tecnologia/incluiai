import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "./prisma";
import { activeGrant, getCurrentUser, type SessionUser } from "./auth";
import { recordView } from "./access-log";
import { canAccessStudent, isFamilyOf, studentPathFor } from "./policy";
import { can } from "./roles";
import { isTabVisible } from "./student-tab-list";
import { DuaError } from "./dua/shared";
import { loadPlanning } from "./dua/plannings";

async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

async function studentInView(user: SessionUser, studentId: string) {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { school: true } });
  if (!student) notFound();
  if (!canAccessStudent(user, student)) redirect("/");
  const grant = can(user.role, "seeNames") ? null : await activeGrant(user, studentId);
  if (!can(user.role, "seeNames") && !grant) redirect(`/acesso-nominal/${studentId}`);
  return { student, grant };
}

// O layout sozinho não basta: em navegação parcial ele não roda de novo.
export const studentContext = cache(async (studentId: string) => {
  const user = await requireUser();
  const { student, grant } = await studentInView(user, studentId);
  if (!can(user.role, "pedagogical")) redirect(studentPathFor(user, studentId));
  return {
    user, student, grant,
    can: {
      edit: can(user.role, "editRecord"),
      dua: can(user.role, "planDua"),
      clinical: can(user.role, "seeClinical"),
      recordAee: can(user.role, "recordAee"),
      validateReports: can(user.role, "validateReports"),
    },
  };
});

export type StudentContext = Awaited<ReturnType<typeof studentContext>>;
type StudentGuard = { tab: string } | { need: keyof StudentContext["can"]; otherwise: string };

export async function requireStudentPage(studentId: string, section: string, guard?: StudentGuard): Promise<StudentContext> {
  const context = await studentContext(studentId);
  if (guard && "tab" in guard && !isTabVisible(guard.tab, context.can)) redirect(`/estudantes/${studentId}`);
  if (guard && "need" in guard && !context.can[guard.need]) redirect(guard.otherwise);
  await recordView(context.user, studentId, section);
  return context;
}

export async function orNotFound<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
}

export const planningContext = cache(async (planningId: string) => {
  const user = await requireUser();
  return { user, ...(await orNotFound(loadPlanning(user, planningId))) };
});

const familyPortalContext = cache(async (studentId: string) => {
  const user = await requireUser();
  const { student } = await studentInView(user, studentId);
  if (!can(user.role, "familyPortal") && !can(user.role, "pedagogical")) redirect(studentPathFor(user, studentId));
  return { user, student };
});

export async function requireFamilyPortal(studentId: string, section: string) {
  const context = await familyPortalContext(studentId);
  if (!isFamilyOf(context.user, studentId)) await recordView(context.user, studentId, section);
  return context;
}
