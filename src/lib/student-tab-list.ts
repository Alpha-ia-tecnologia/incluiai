export const STUDENT_TABS = [
  { slug: "", label: "Resumo" },
  { slug: "estudo-de-caso", label: "Estudo de caso" },
  { slug: "sondagem", label: "Sondagem" },
  { slug: "perfil", label: "Como aprende" },
  { slug: "ppi", label: "Plano de ensino" },
  { slug: "atividades", label: "Atividades" },
  { slug: "dua", label: "Atividades com DUA" },
  { slug: "diario", label: "Registrar aula" },
  { slug: "atendimentos-aee", label: "Atendimentos AEE" },
  { slug: "linha-do-tempo", label: "Evolução" },
  { slug: "materiais", label: "Materiais de apoio" },
  { slug: "relatorios", label: "Relatórios" },
  { slug: "dossie", label: "Dossiê" },
  { slug: "carteirinha", label: "Carteirinha" },
];

const READ_ONLY_TABS = new Set(["", "estudo-de-caso", "sondagem", "ppi", "linha-do-tempo", "materiais", "relatorios", "dossie"]);

const ESSENTIAL_TABS = new Set(["", "estudo-de-caso", "ppi", "diario", "dossie"]);
export const isEssentialTab = (slug: string) => ESSENTIAL_TABS.has(slug);

export type StudentTabAccess = { edit: boolean; dua: boolean };

export const visibleTabs = (can: StudentTabAccess) =>
  STUDENT_TABS.filter((tab) => (can.edit || READ_ONLY_TABS.has(tab.slug)) && (can.dua || tab.slug !== "dua"));

export const isTabVisible = (slug: string, can: StudentTabAccess) => visibleTabs(can).some((tab) => tab.slug === slug);
