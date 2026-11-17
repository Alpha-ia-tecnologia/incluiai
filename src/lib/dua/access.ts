export type DuaUser = { id: string; role: string; schoolId: string | null };
export type PlanningRef = { ownerId: string; schoolId: string | null; sharing: string; collaborators: string };
export type PlanningAccess = { read: boolean; edit: boolean; validate: boolean; share: boolean; owner: boolean };

const PLANNERS = new Set(["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"]);
const VALIDATORS = new Set(["professor_sala", "professor_aee", "coordenacao", "gestao"]);
const COORDINATION = new Set(["coordenacao", "gestao"]);
const INDICATOR_ROLES = new Set(["coordenacao", "gestao", "secretaria"]);

export const canPlanDua = (user: Pick<DuaUser, "role">) => PLANNERS.has(user.role);
export const canSeeDuaIndicators = (user: Pick<DuaUser, "role">) => INDICATOR_ROLES.has(user.role);

const sameSchool = (user: DuaUser, schoolId: string | null) => !user.schoolId || !schoolId || user.schoolId === schoolId;

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
  if (!canPlanDua(user)) return none;
  const owner = planning.ownerId === user.id;
  const collaborator = collaboratorIds(planning.collaborators).includes(user.id);
  const coordination = COORDINATION.has(user.role) && sameSchool(user, planning.schoolId);
  const team = planning.sharing === "compartilhado" && sameSchool(user, planning.schoolId);
  const edit = owner || collaborator || coordination;
  return { read: edit || team, edit, validate: edit && VALIDATORS.has(user.role), share: owner || coordination, owner };
}

export function readablePlanningsWhere(user: DuaUser) {
  if (!canPlanDua(user)) return { id: "__nenhum__" };
  const schoolScope = user.schoolId ? { OR: [{ schoolId: user.schoolId }, { schoolId: null }] } : {};
  const ors: object[] = [{ ownerId: user.id }, { collaborators: { contains: `"${user.id}"` } }, { sharing: "compartilhado", ...schoolScope }];
  if (COORDINATION.has(user.role)) ors.push(schoolScope);
  return { OR: ors };
}
