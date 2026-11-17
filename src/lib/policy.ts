import { can, roleScope, type Role } from "./roles.ts";

type Viewer = { role: Role; schoolId: string | null; studentIds: string[] };
type Linked = { role: string; studentIds: string[] };
type StudentRef = { id: string; schoolId: string };

export function canAccessSchool(user: Pick<Viewer, "role" | "schoolId">, schoolId: string): boolean {
  switch (roleScope(user.role)) {
    case "rede": return true;
    case "escola": return !user.schoolId || user.schoolId === schoolId;
    case "vinculo":
    case "plataforma": return false;
  }
}

export const canAccessStudent = (user: Viewer, student: StudentRef): boolean =>
  roleScope(user.role) === "vinculo" ? user.studentIds.includes(student.id) : canAccessSchool(user, student.schoolId);

export function studentScopeWhere(user: Viewer): { schoolId?: string; id?: { in: string[] } } {
  switch (roleScope(user.role)) {
    case "rede": return {};
    case "vinculo": return { id: { in: user.studentIds } };
    case "escola": return user.schoolId ? { schoolId: user.schoolId } : {};
    case "plataforma": return { id: { in: [] } };
  }
}

export const canWorkWithStudent = (user: Viewer, student: StudentRef): boolean => can(user.role, "editRecord") && canAccessStudent(user, student);

export const isFamilyOf = (user: Linked, studentId: string): boolean => can(user.role, "familyPortal") && user.studentIds.includes(studentId);

export const isTherapistOf = (user: Linked, studentId: string): boolean => can(user.role, "intersectorReports") && user.studentIds.includes(studentId);

// Contas antigas guardam o vínculo em User.studentId até o primeiro acesso, que o grava em StudentLink.
export function linkedStudentIds(user: { studentId: string | null; studentLinks: { studentId: string }[] }): string[] {
  if (user.studentLinks.length) return user.studentLinks.map((link) => link.studentId);
  return user.studentId ? [user.studentId] : [];
}

export const familyPortalPath = (studentIds: string[]): string => (studentIds.length === 1 ? `/familia/${studentIds[0]}` : "/familia");

export function landingFor(user: Linked): string {
  if (can(user.role, "familyPortal") && user.studentIds.length) return familyPortalPath(user.studentIds);
  if (can(user.role, "intersectorReports") && user.studentIds.length) return "/terapeuta";
  return "/";
}

export function studentPathFor(user: Linked, studentId: string): string {
  if (can(user.role, "familyPortal")) return `/familia/${studentId}`;
  if (can(user.role, "intersectorReports")) return "/terapeuta";
  return `/estudantes/${studentId}`;
}

const SHARED_ACTIVITY_STATUSES = ["aceita", "aplicada"];
export const familyActivityWhere = { context: "casa", status: { in: SHARED_ACTIVITY_STATUSES } };
export const isFamilyActivity = (activity: { context: string; status: string }): boolean =>
  activity.context === familyActivityWhere.context && SHARED_ACTIVITY_STATUSES.includes(activity.status);

export const familyMaterialWhere = { status: "aprovado" };
export const isFamilyMaterial = (material: { status: string }): boolean => material.status === familyMaterialWhere.status;
