import { familyPortalPath } from "./policy.ts";
import { can, isAccountManager } from "./roles.ts";

export type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: "home" | "students" | "planning" | "journey" | "assistant" | "resources" | "calendar" | "network" | "schools" | "accounts" | "family" | "care" | "help" | "evidence" | "census" | "games" | "ai";
  exact?: boolean;
  section?: "routine" | "management" | "help";
};

export const isActivePath = (pathname: string, href: string, exact = false): boolean =>
  pathname === href || (!exact && pathname.startsWith(`${href}/`));

export function getNavigation(role: string, studentIds: string[] = []): NavigationItem[] {
  const help: NavigationItem = { href: "/ajuda", label: "Ajuda e primeiros passos", shortLabel: "Ajuda", icon: "help", section: "help" };
  const calendar: NavigationItem = { href: "/calendario", label: "Calendário inclusivo", shortLabel: "Calendário", icon: "calendar", section: "routine" };
  const journey: NavigationItem = { href: "/jornada", label: "Minha jornada", shortLabel: "Jornada", icon: "journey", section: "routine" };
  const assistant: NavigationItem = { href: "/assistente", label: "Assistente", shortLabel: "Assistente", icon: "assistant", section: "routine" };
  if (can(role, "familyPortal")) {
    const one = studentIds.length === 1;
    return [
      { href: familyPortalPath(studentIds), label: one ? "Acompanhar meu filho" : "Acompanhar meus filhos", shortLabel: one ? "Meu filho" : "Meus filhos", icon: "family", section: "routine" },
      journey,
      assistant,
      calendar,
      help,
    ];
  }
  if (can(role, "intersectorReports")) {
    return [
      { href: "/terapeuta", label: "Orientações para a escola", shortLabel: "Orientações", icon: "care", section: "routine" },
      journey,
      assistant,
      calendar,
      help,
    ];
  }
  if (!can(role, "pedagogical")) return [];
  const links: NavigationItem[] = [
    { href: "/", label: "Início", shortLabel: "Início", icon: "home", exact: true, section: "routine" },
    { href: "/estudantes", label: "Estudantes", shortLabel: "Estudantes", icon: "students", section: "routine" },
    journey,
    ...(can(role, "planDua") ? [{ href: "/planejamento", label: "Planejamento com DUA", shortLabel: "Planejamento", icon: "planning", section: "routine" } satisfies NavigationItem] : []),
    assistant,
    { href: "/recursos", label: "Banco de recursos", shortLabel: "Recursos", icon: "resources", section: "routine" },
    ...(can(role, "editRecord") ? [{ href: "/jogos", label: "Jogos educativos", shortLabel: "Jogos", icon: "games", section: "routine" } satisfies NavigationItem] : []),
    calendar,
  ];
  const section = can(role, "management") ? "management" : "routine";
  links.push({ href: "/painel", label: "Painel de indicadores", shortLabel: "Painel", icon: "network", section });
  if (can(role, "dossier")) links.push({ href: "/dossie", label: "Dossiê de evidências", shortLabel: "Dossiê", icon: "evidence", section });
  if (can(role, "importCensus") || can(role, "configureCensus")) links.push({ href: "/censo", label: "Censo Escolar", shortLabel: "Censo", icon: "census", section: "management" });
  if (can(role, "management")) links.push({ href: "/cadastros", label: "Escolas e turmas", shortLabel: "Cadastros", icon: "schools", section: "management" });
  if (isAccountManager(role)) links.push({ href: "/usuarios", label: "Pessoas e acessos", shortLabel: "Acessos", icon: "accounts", section: "management" });
  if (can(role, "configureAi")) links.push({ href: "/configuracao-ia", label: "Configuração da IA", shortLabel: "IA", icon: "ai", section: "management" });
  return [...links, help];
}
