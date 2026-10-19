"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Home, Users, Layers, Route, Sparkles, Library, BarChart3, School, Heart, Stethoscope, CircleHelp, CalendarDays, Menu, X, UserCog } from "lucide-react";
import type { NavigationItem } from "@/lib/navigation";

const ICONS = { home: Home, students: Users, planning: Layers, journey: Route, assistant: Sparkles, resources: Library, calendar: CalendarDays, network: BarChart3, schools: School, accounts: UserCog, family: Heart, care: Stethoscope, help: CircleHelp };

export function MobileNavigation({ links }: { links: NavigationItem[] }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const primary = links.length > 4 ? links.filter((link) => link.section === "routine").slice(0, 3) : links;
  const hasMore = links.length > primary.length;
  const active = (link: NavigationItem) => link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
  return (
    <nav aria-label="Navegação no celular" className="mobile-nav">
      {primary.map((link) => {
        const Icon = ICONS[link.icon];
        return <Link key={link.href} href={link.href} aria-current={active(link) ? "page" : undefined} className="mobile-nav-item"><Icon size={20} aria-hidden /><span>{link.shortLabel}</span></Link>;
      })}
      {hasMore ? (
        <details key={pathname} ref={menu} className="mobile-menu group" onKeyDown={(event) => {
          if (event.key === "Escape" && menu.current) {
            menu.current.open = false;
            menu.current.querySelector("summary")?.focus();
          }
        }}>
          <summary data-active={links.some((link) => !primary.includes(link) && active(link)) || undefined} className="mobile-nav-item list-none [&::-webkit-details-marker]:hidden">
            <Menu size={20} className="group-open:hidden" aria-hidden />
            <X size={20} className="hidden group-open:block" aria-hidden />
            <span className="group-open:hidden">Menu</span><span className="hidden group-open:block">Fechar</span>
          </summary>
          <div className="mobile-menu-panel">
            <p className="mb-3 px-2 text-sm font-semibold">Para onde você quer ir?</p>
            {links.map((link) => {
              const Icon = ICONS[link.icon];
              return <Link key={link.href} href={link.href} aria-current={active(link) ? "page" : undefined} onClick={() => { if (menu.current) menu.current.open = false; }} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-brand-soft aria-[current=page]:bg-brand aria-[current=page]:text-white"><Icon size={19} className="shrink-0" aria-hidden />{link.label}</Link>;
            })}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
