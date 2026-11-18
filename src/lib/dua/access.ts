import { canAccessSchool } from "../policy.ts";
import { can, type Role } from "../roles.ts";
import { parseJson } from "../format.ts";

export type DuaUser = { id: string; role: Role; schoolId: string | null };
export type PlanningRef = { ownerId: string; schoolId: string | null; sharing: string; collaborators: string };
export type PlanningAccess = { read: boolean; edit: boolean; validate: boolean; share: boolean; owner: boolean };

const sameSchool = (user: DuaUser, schoolId: string | null) => !schoolId || canAccessSchool(user, schoolId);

type Collaborator = { id: string; name: string };

export function readCollaborators(stored: string | null | undefined): Collaborator[] {
  const parsed = parseJson<unknown>(stored, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    const id = String(item?.id ?? "");
    return id ? [{ id, name: String(item.name ?? "") }] : [];
  });
}

export const writeCollaborators = (list: readonly Collaborator[]) => JSON.stringify(list.map(({ id, name }) => ({ id, name })));
export const collaboratorIds = (stored: string | null | undefined) => readCollaborators(stored).map((item) => item.id);
// O banco guarda a lista como texto JSON e o SQLite não consulta dentro dele: procura-se o id
// entre aspas, exatamente como JSON.stringify o grava em writeCollaborators.
export const collaboratorWhere = (userId: string) => ({ collaborators: { contains: JSON.stringify(userId) } });

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
  const ors: object[] = [{ ownerId: user.id }, collaboratorWhere(user.id), { sharing: "compartilhado", ...schoolScope }];
  if (can(user.role, "coordinateDua")) ors.push(schoolScope);
  return { OR: ors };
}
