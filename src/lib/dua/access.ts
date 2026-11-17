import { canAccessSchool } from "../policy.ts";
import { can, type Role } from "../roles.ts";

export type DuaUser = { id: string; role: Role; schoolId: string | null };
export type PlanningRef = { ownerId: string; schoolId: string | null; sharing: string; collaborators: string };
export type PlanningAccess = { read: boolean; edit: boolean; validate: boolean; share: boolean; owner: boolean };

const sameSchool = (user: DuaUser, schoolId: string | null) => !schoolId || canAccessSchool(user, schoolId);

export function collaboratorIds(collaborators: string): string[] {
  try {
    const parsed = JSON.parse(collaborators) as Array<{ id?: unknown }>;
    return Array.isArray(parsed) ? parsed.map((item) => String(item?.id ?? "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function planningAccess(user: DuaUser, planning: PlanningRef): PlanningAccess {
  const none = { read: false, edit: false, validate: false, share: false, owner: false };
  if (!can(user.role, "planDua")) return none;
  const owner = planning.ownerId === user.id;
  const collaborator = collaboratorIds(planning.collaborators).includes(user.id);
  const coordination = can(user.role, "coordinateDua") && sameSchool(user, planning.schoolId);
  const team = planning.sharing === "compartilhado" && sameSchool(user, planning.schoolId);
  const edit = owner || collaborator || coordination;
  return { read: edit || team, edit, validate: edit && can(user.role, "validateDua"), share: owner || coordination, owner };
}

export function readablePlanningsWhere(user: DuaUser) {
  if (!can(user.role, "planDua")) return { id: "__nenhum__" };
  const schoolScope = user.schoolId ? { OR: [{ schoolId: user.schoolId }, { schoolId: null }] } : {};
  const ors: object[] = [{ ownerId: user.id }, { collaborators: { contains: `"${user.id}"` } }, { sharing: "compartilhado", ...schoolScope }];
  if (can(user.role, "coordinateDua")) ors.push(schoolScope);
  return { OR: ors };
}
