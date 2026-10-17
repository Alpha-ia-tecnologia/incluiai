export type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: "home" | "students" | "journey" | "assistant" | "resources" | "calendar" | "network" | "schools" | "family" | "care" | "help";
  exact?: boolean;
  section?: "routine" | "management" | "help";
};

export function getNavigation(role: string, studentId: string | null): NavigationItem[] {
  const help: NavigationItem = { href: "/ajuda", label: "Ajuda e primeiros passos", shortLabel: "Ajuda", icon: "help", section: "help" };
  const calendar: NavigationItem = { href: "/calendario", label: "Calendário inclusivo", shortLabel: "Calendário", icon: "calendar", section: "routine" };
  const journey: NavigationItem = { href: "/jornada", label: "Minha jornada", shortLabel: "Jornada", icon: "journey", section: "routine" };
  const assistant: NavigationItem = { href: "/assistente", label: "Assistente", shortLabel: "Assistente", icon: "assistant", section: "routine" };
  if (role === "familia") {
    return [
      { href: studentId ? `/familia/${studentId}` : "/familia", label: "Acompanhar meu filho", shortLabel: "Meu filho", icon: "family", section: "routine" },
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
    assistant,
    { href: "/recursos", label: "Atividades e recursos", shortLabel: "Recursos", icon: "resources", section: "routine" },
    calendar,
  ];
  const dashboard: NavigationItem = { href: "/painel", label: "Painel de indicadores", shortLabel: "Painel", icon: "network" };
  if (["secretaria", "gestao", "coordenacao"].includes(role)) {
    links.push(
      { ...dashboard, section: "management" },
      { href: "/cadastros", label: "Escolas e turmas", shortLabel: "Cadastros", icon: "schools", section: "management" },
    );
  } else {
    links.push({ ...dashboard, section: "routine" });
  }
  return [...links, help];
}
