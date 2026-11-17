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

const PEDAGOGICAL_ONLY = new Set(["estudo-de-caso", "sondagem", "dua", "atendimentos-aee", "dossie"]);
const READ_ONLY_TABS = new Set(["", "estudo-de-caso", "sondagem", "ppi", "atendimentos-aee", "linha-do-tempo", "materiais", "relatorios", "dossie"]);

const ESSENTIAL_TABS = new Set(["", "estudo-de-caso", "ppi", "diario", "dossie"]);
export const isEssentialTab = (slug: string) => ESSENTIAL_TABS.has(slug);

export function visibleTabs({ showCaseStudy, showDua = showCaseStudy, readOnly = false }: { showCaseStudy: boolean; showDua?: boolean; readOnly?: boolean }) {
  return STUDENT_TABS.filter((tab) => (showCaseStudy || !PEDAGOGICAL_ONLY.has(tab.slug)) && (showDua || tab.slug !== "dua") && (!readOnly || READ_ONLY_TABS.has(tab.slug)));
}
