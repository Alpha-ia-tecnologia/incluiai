import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Home, Users, Layers, Route, Sparkles, BarChart3, Library, Heart, ShieldCheck, Stethoscope, LogOut, School, Sprout, ChevronDown, CircleHelp, CalendarDays, UserCog } from "lucide-react";
import { NavLink } from "./nav-link";
import { MobileNavigation } from "./mobile-navigation";
import { getNavigation } from "@/lib/navigation";
import { logout } from "@/actions/auth";
import { ROLES } from "@/lib/scale";
import { firstName } from "@/lib/format";
import type { SessionUser } from "@/lib/auth";
import { hasApiKey } from "@/lib/env";
import { suggestionsFor } from "@/lib/assistant/labels";
import { AssistantPopup } from "./assistant/assistant-popup";
import { NavigationProgress } from "./navigation-progress";
import { TextSizeControl } from "./text-size-control";

const ICONS = { home: Home, students: Users, planning: Layers, journey: Route, assistant: Sparkles, resources: Library, calendar: CalendarDays, network: BarChart3, schools: School, accounts: UserCog, family: Heart, care: Stethoscope, help: CircleHelp };

export function Shell({ user, children }: { user: SessionUser; children: ReactNode }) {
  // Iniciais sem títulos e observações entre parênteses: "Carla (mãe de Dante)" → "C".
  const initials = user.name.replace(/\([^)]*\)/g, " ").split(/\s+/).filter((part) => /^\p{L}/u.test(part) && !part.includes(".")).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || user.name[0];
  const links = getNavigation(user.role, user.studentIds);
  const home = links[0].href;
  return (
    <div className="app-frame">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <Suspense fallback={null}><NavigationProgress /></Suspense>
      <aside className="nav-rail" aria-label="Menu lateral">
        <Link href={home} aria-label="IncluiEdu — início" className="mb-8 flex items-center gap-2.5 px-2 text-brand">
          <Sprout size={28} aria-hidden /><span className="text-xl font-semibold tracking-tight">IncluiEdu</span>
        </Link>
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-2">
          {links.map((link, index) => {
            const Icon = ICONS[link.icon];
            const groupStart = link.section === "management" && links[index - 1]?.section !== "management";
            return <div key={link.href}>
              {groupStart ? <p className="mb-2 mt-5 px-3 text-xs font-medium text-ink-soft">Gestão da rede</p> : null}
              <NavLink href={link.href} label={link.label} exact={link.exact}><Icon size={20} className="shrink-0" aria-hidden /></NavLink>
            </div>;
          })}
        </nav>
        <div className="mt-6 border-t border-line pt-4">
          <Link href="/conta/seguranca" className="mb-3 flex min-h-6 items-center gap-2 text-xs text-ink-soft hover:text-brand-strong"><ShieldCheck size={15} aria-hidden /> Segurança da conta</Link>
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="mt-1 text-xs text-ink-soft">{ROLES[user.role] ?? user.role}</p>
          <form action={logout} className="mt-3"><button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-ink-soft hover:bg-coral-soft hover:text-coral"><LogOut size={18} aria-hidden /> Sair da plataforma</button></form>
        </div>
      </aside>
      <div className="app-content">
        <header className="shell-header mb-7 flex min-h-12 items-center justify-between gap-2">
          <Link href={home} className="flex items-center gap-2">
            <Sprout size={22} className="text-brand lg:hidden" aria-hidden />
            <span className="font-semibold lg:hidden">IncluiEdu</span>
            <span className="hidden text-sm text-ink-soft lg:inline">Cada pessoa, uma possibilidade.</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/ajuda" className="hidden min-h-11 items-center gap-2 rounded-full px-3 text-sm text-brand hover:bg-brand-soft sm:flex"><CircleHelp size={18} aria-hidden /> Preciso de ajuda</Link>
            <details className="relative z-30">
              <summary className="flex min-h-11 list-none items-center gap-2 rounded-full bg-surface-muted/70 py-1.5 pl-1.5 pr-3 text-sm [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 items-center justify-center rounded-full bg-lilac-warm text-xs font-semibold">{initials}</span>
                <span className="shell-user-name max-w-24 truncate">{firstName(user.name)}</span><ChevronDown size={14} aria-hidden />
              </summary>
              <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-line bg-paper-raised p-4 shadow-e2">
                <p className="text-sm font-medium">{user.name}</p><p className="mt-1 text-xs text-ink-soft">{ROLES[user.role] ?? user.role}</p>
                <Link href="/ajuda" className="mt-3 flex min-h-11 items-center gap-2 rounded-lg p-2 text-sm hover:bg-brand-soft"><CircleHelp size={18} aria-hidden /> Ajuda e primeiros passos</Link>
                <Link href="/conta/seguranca" className="flex min-h-11 items-center gap-2 rounded-lg p-2 text-sm hover:bg-brand-soft"><ShieldCheck size={18} aria-hidden /> Segurança da conta</Link>
                <div className="mt-2 border-t border-line px-2 pt-3"><TextSizeControl /></div>
                <form action={logout} className="mt-2 border-t border-line pt-2"><button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-lg p-2 text-sm hover:bg-coral-soft"><LogOut size={18} aria-hidden /> Sair da plataforma</button></form>
              </div>
            </details>
          </div>
        </header>
        <main id="conteudo" tabIndex={-1} className="min-w-0 outline-none">{children}</main>
      </div>
      <MobileNavigation links={links} />
      <AssistantPopup enabled={hasApiKey("ANTHROPIC_API_KEY")} suggestions={suggestionsFor(user.role)} />
    </div>
  );
}
