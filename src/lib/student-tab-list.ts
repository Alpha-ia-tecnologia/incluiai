// Abas da ficha do estudante e quem vê cada uma. Fica fora do componente de
// cliente para as páginas do servidor (o dossiê) usarem as mesmas regras.

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
];

// Seções que ficam ocultas para quem não acessa o detalhe pedagógico (família e terapeuta).
const PEDAGOGICAL_ONLY = new Set(["estudo-de-caso", "sondagem", "dua", "atendimentos-aee", "dossie"]);
// Leitura sem edição (Secretaria com motivo registrado): as abas de consulta.
const READ_ONLY_TABS = new Set(["", "estudo-de-caso", "sondagem", "ppi", "atendimentos-aee", "linha-do-tempo", "materiais", "relatorios", "dossie"]);

// showCaseStudy = pode ver o detalhe pedagógico (estudo de caso, DUA e frequência do AEE).
// showDua, quando informado, esconde só a aba do DUA de quem vê o detalhe mas não planeja (secretaria).
export function visibleTabs({ showCaseStudy, showDua = showCaseStudy, readOnly = false }: { showCaseStudy: boolean; showDua?: boolean; readOnly?: boolean }) {
  return STUDENT_TABS.filter((tab) => (showCaseStudy || !PEDAGOGICAL_ONLY.has(tab.slug)) && (showDua || tab.slug !== "dua") && (!readOnly || READ_ONLY_TABS.has(tab.slug)));
}
