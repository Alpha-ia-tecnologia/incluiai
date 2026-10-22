export type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: "home" | "students" | "planning" | "journey" | "assistant" | "resources" | "calendar" | "network" | "schools" | "accounts" | "family" | "care" | "help" | "evidence" | "census";
  exact?: boolean;
  section?: "routine" | "management" | "help";
};

const PLANNER_ROLES = new Set(["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"]);

export function getNavigation(role: string, studentIds: string[] = []): NavigationItem[] {
  const help: NavigationItem = { href: "/ajuda", label: "Ajuda e primeiros passos", shortLabel: "Ajuda", icon: "help", section: "help" };
  const calendar: NavigationItem = { href: "/calendario", label: "Calendário inclusivo", shortLabel: "Calendário", icon: "calendar", section: "routine" };
  const journey: NavigationItem = { href: "/jornada", label: "Minha jornada", shortLabel: "Jornada", icon: "journey", section: "routine" };
  const assistant: NavigationItem = { href: "/assistente", label: "Assistente", shortLabel: "Assistente", icon: "assistant", section: "routine" };
  if (role === "familia") {
    return [
      // Mais de um filho vinculado: a lista do portal da família, para escolher.
      studentIds.length === 1
        ? { href: `/familia/${studentIds[0]}`, label: "Acompanhar meu filho", shortLabel: "Meu filho", icon: "family", section: "routine" }
        : { href: "/familia", label: "Acompanhar meus filhos", shortLabel: "Meus filhos", icon: "family", section: "routine" },
      journey,
      assistant,
      calendar,
      help,
    ];
  }
  if (role === "terapeuta") {
    return [
      { href: "/terapeuta", label: "Orientações para a escola", shortLabel: "Orientações", icon: "care", section: "routine" },
      journey,
      assistant,
      calendar,
      help,
    ];
  }
  const links: NavigationItem[] = [
    { href: "/", label: "Início", shortLabel: "Início", icon: "home", exact: true, section: "routine" },
    { href: "/estudantes", label: "Estudantes", shortLabel: "Estudantes", icon: "students", section: "routine" },
    journey,
    // Planejamento com DUA: equipe que planeja atividades (a secretaria acompanha pelos indicadores).
    ...(PLANNER_ROLES.has(role) ? [{ href: "/planejamento", label: "Planejamento com DUA", shortLabel: "Planejamento", icon: "planning", section: "routine" } satisfies NavigationItem] : []),
    assistant,
    { href: "/recursos", label: "Atividades e recursos", shortLabel: "Recursos", icon: "resources", section: "routine" },
    calendar,
  ];
  const dashboard: NavigationItem = { href: "/painel", label: "Painel de indicadores", shortLabel: "Painel", icon: "network" };
  // Dossiê de evidências (item 8): a coordenação e a rede conferem; o AEE prepara.
  const dossier: NavigationItem = { href: "/dossie", label: "Dossiê de evidências", shortLabel: "Dossiê", icon: "evidence" };
  if (["secretaria", "gestao", "coordenacao"].includes(role)) {
    links.push(
      { ...dashboard, section: "management" },
      { ...dossier, section: "management" },
      // Censo Escolar (Educacenso): importação, conciliação e dupla matrícula do AEE.
      { href: "/censo", label: "Censo Escolar", shortLabel: "Censo", icon: "census", section: "management" },
      { href: "/cadastros", label: "Escolas e turmas", shortLabel: "Cadastros", icon: "schools", section: "management" },
      { href: "/usuarios", label: "Pessoas e acessos", shortLabel: "Acessos", icon: "accounts", section: "management" },
    );
  } else {
    links.push({ ...dashboard, section: "routine" });
    if (role === "professor_aee") links.push({ ...dossier, section: "routine" });
  }
  return [...links, help];
}
