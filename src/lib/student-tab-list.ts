import { TRAIL_STEPS } from "./student-journey.ts";

export type StudentTabAccess = { edit: boolean; dua: boolean };
type Need = "ler" | "editar" | "dua";
export type StudentTab = { slug: string; label: string; group: "resumo" | "trilha" | "mais" };
type Section = StudentTab & { need: Need };

const STEP_NEED: Record<(typeof TRAIL_STEPS)[number]["path"], Need> = {
  "estudo-de-caso": "ler", ppi: "ler", perfil: "editar", atividades: "editar", diario: "editar", "linha-do-tempo": "ler",
};

const TABS: Section[] = [
  { slug: "", label: "Resumo", group: "resumo", need: "ler" },
  ...TRAIL_STEPS.map((step): Section => ({ slug: step.path, label: step.label, group: "trilha", need: STEP_NEED[step.path] })),
  { slug: "sondagem", label: "Sondagem", group: "mais", need: "ler" },
  { slug: "atendimentos-aee", label: "Atendimentos AEE", group: "mais", need: "editar" },
  { slug: "materiais", label: "Materiais de apoio", group: "mais", need: "ler" },
  { slug: "relatorios", label: "Relatórios", group: "mais", need: "ler" },
  { slug: "dossie", label: "Dossiê", group: "mais", need: "ler" },
  { slug: "carteirinha", label: "Carteirinha", group: "mais", need: "editar" },
];

// O passo Atividade tem duas vistas; a aba Atividade fica marcada nas duas.
const ACTIVITY_VIEWS: Section[] = [
  { slug: "atividades", label: "Preparar e adaptar", group: "trilha", need: "editar" },
  { slug: "atividades/dua", label: "Planejar com DUA", group: "trilha", need: "dua" },
];

const allowed = (need: Need, can: StudentTabAccess) => need === "ler" || (can.edit && (need === "editar" || can.dua));
const tabOf = ({ slug, label, group }: Section): StudentTab => ({ slug, label, group });

export const STUDENT_TABS: StudentTab[] = TABS.map(tabOf);
export const visibleTabs = (can: StudentTabAccess) => TABS.filter((tab) => allowed(tab.need, can)).map(tabOf);
export const activityViews = (can: StudentTabAccess) => ACTIVITY_VIEWS.filter((view) => allowed(view.need, can)).map(tabOf);
export const isTabVisible = (slug: string, can: StudentTabAccess) =>
  [...TABS, ...ACTIVITY_VIEWS].some((section) => section.slug === slug && allowed(section.need, can));
