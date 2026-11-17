import { PLATFORM_ROLE } from "./tenancy-core.ts";

export const ROLE_KEYS = ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao", "secretaria", "familia", "terapeuta", PLATFORM_ROLE] as const;
export type Role = (typeof ROLE_KEYS)[number];

export type Scope = "escola" | "rede" | "vinculo" | "plataforma";
export type Group = "professor" | "escola" | "rede" | "familia" | "terapeuta" | "plataforma";
export type TeachingContext = "sala_comum" | "aee";

export type Capability =
  | "pedagogical"
  | "editRecord"
  | "seeClinical"
  | "validateReports"
  | "planDua"
  | "validateDua"
  | "coordinateDua"
  | "duaIndicators"
  | "recordAee"
  | "management"
  | "adminTasks"
  | "dossier"
  | "importCensus"
  | "configureCensus"
  | "seeNames"
  | "teamNotices"
  | "familyPortal"
  | "intersectorReports"
  | "twoFactor";

type RoleSpec = {
  label: string;
  short?: string;
  group: Group;
  teaches?: TeachingContext;
  can: readonly Capability[];
  assigns: readonly Role[];
};

const TABLE: Record<Role, RoleSpec> = {
  professor_sala: {
    label: "Professor(a) da sala comum", group: "professor", teaches: "sala_comum",
    can: ["pedagogical", "editRecord", "planDua", "validateDua", "seeNames", "twoFactor"],
    assigns: [],
  },
  professor_aee: {
    label: "Professor(a) do AEE", group: "professor", teaches: "aee",
    can: ["pedagogical", "editRecord", "seeClinical", "validateReports", "planDua", "validateDua", "recordAee", "dossier", "seeNames", "teamNotices", "twoFactor"],
    assigns: [],
  },
  apoio: {
    label: "Profissional de apoio", group: "professor",
    can: ["pedagogical", "editRecord", "planDua", "seeNames", "twoFactor"],
    assigns: [],
  },
  coordenacao: {
    label: "Coordenação pedagógica", group: "escola",
    can: ["pedagogical", "editRecord", "seeClinical", "validateReports", "planDua", "validateDua", "coordinateDua", "duaIndicators", "recordAee", "management", "dossier", "importCensus", "seeNames", "teamNotices", "twoFactor"],
    assigns: ["professor_sala", "professor_aee", "apoio", "familia", "terapeuta"],
  },
  gestao: {
    label: "Gestão escolar", group: "escola",
    can: ["pedagogical", "editRecord", "planDua", "validateDua", "coordinateDua", "duaIndicators", "recordAee", "management", "adminTasks", "dossier", "importCensus", "seeNames", "twoFactor"],
    assigns: ["professor_sala", "professor_aee", "apoio", "coordenacao", "familia", "terapeuta"],
  },
  secretaria: {
    label: "Secretaria de Educação", group: "rede",
    can: ["pedagogical", "duaIndicators", "management", "adminTasks", "dossier", "configureCensus", "twoFactor"],
    assigns: ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao", "secretaria"],
  },
  familia: {
    label: "Família", group: "familia",
    can: ["familyPortal", "seeNames"],
    assigns: [],
  },
  terapeuta: {
    label: "Terapeuta (rede de saúde)", short: "Terapeuta", group: "terapeuta",
    can: ["intersectorReports", "seeNames"],
    assigns: [],
  },
  [PLATFORM_ROLE]: {
    label: "Administração da plataforma", group: "plataforma",
    can: ["twoFactor"],
    assigns: [],
  },
};

const SCOPE_OF_GROUP: Record<Group, Scope> = { professor: "escola", escola: "escola", rede: "rede", familia: "vinculo", terapeuta: "vinculo", plataforma: "plataforma" };

export const isRole = (value: string): value is Role => (ROLE_KEYS as readonly string[]).includes(value);

export const roleLabel = (role: string, { short = false } = {}): string =>
  isRole(role) ? (short && TABLE[role].short) || TABLE[role].label : role;

export const can = (role: string, capability: Capability): boolean => isRole(role) && TABLE[role].can.includes(capability);

export const rolesWith = (capability: Capability): Role[] => ROLE_KEYS.filter((role) => can(role, capability));

export const roleGroup = (role: Role): Group => TABLE[role].group;

export const roleScope = (role: Role): Scope => SCOPE_OF_GROUP[TABLE[role].group];

export const isLinkedRole = (role: string): boolean => isRole(role) && roleScope(role) === "vinculo";

export const isPlatformRole = (role: string): boolean => isRole(role) && roleScope(role) === "plataforma";

export const teachingContext = (role: Role): TeachingContext | null => TABLE[role].teaches ?? null;

export const assignableRoles = (role: string): readonly Role[] => (isRole(role) ? TABLE[role].assigns : []);

export const isAccountManager = (role: string): boolean => assignableRoles(role).length > 0;

export function accountSchool(role: string): "obrigatoria" | "opcional" | "nenhuma" {
  if (!isRole(role) || roleScope(role) !== "escola") return "nenhuma";
  return can(role, "management") ? "opcional" : "obrigatoria";
}
