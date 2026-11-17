import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, LogOut, Plus, Sprout } from "lucide-react";
import { requirePlatformUser } from "@/lib/auth";
import { ROLES } from "@/lib/scale";
import { logout } from "@/actions/auth";
import { NavLink } from "@/components/nav-link";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requirePlatformUser();
  return (
    <div className="app-frame">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <aside className="nav-rail" aria-label="Menu lateral">
        <Link href="/plataforma" aria-label="IncluiEdu — administração da plataforma" className="mb-8 flex items-center gap-3 px-2.5 text-on-navy">
          <Sprout size={32} className="shrink-0 text-accent-sky" aria-hidden />
          <span><span className="block text-2xl font-semibold tracking-tight">IncluiEdu</span><span className="block text-sm text-on-navy-soft">Administração da plataforma</span></span>
        </Link>
        <nav aria-label="Navegação da plataforma" className="flex flex-1 flex-col gap-1.5">
          <NavLink href="/plataforma" label="Municípios" exact><Building2 size={22} className="shrink-0" aria-hidden /></NavLink>
          <NavLink href="/plataforma/novo" label="Novo município"><Plus size={22} className="shrink-0" aria-hidden /></NavLink>
        </nav>
        <div className="mt-6 border-t border-navy-line pt-4">
          <p className="truncate text-base font-medium">{user.name}</p>
          <p className="mt-1 text-sm text-on-navy-soft">{ROLES[user.role]}</p>
          <form action={logout} className="mt-3"><button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-base text-on-navy-soft hover:bg-navy-hover hover:text-on-navy"><LogOut size={20} aria-hidden /> Sair da plataforma</button></form>
        </div>
      </aside>
      <div className="app-content">
        <div className="surface-navy mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl px-4 py-3 lg:hidden">
          <Link href="/plataforma" className="flex min-h-11 items-center gap-2 font-semibold"><Sprout size={22} className="text-accent-sky" aria-hidden /> IncluiEdu</Link>
          <nav aria-label="Navegação da plataforma no celular" className="flex flex-wrap items-center gap-1">
            <Link href="/plataforma" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-on-navy-soft hover:bg-navy-hover hover:text-on-navy">Municípios</Link>
            <Link href="/plataforma/novo" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-on-navy-soft hover:bg-navy-hover hover:text-on-navy">Novo município</Link>
            <form action={logout}><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-on-navy-soft hover:bg-navy-hover hover:text-on-navy"><LogOut size={18} aria-hidden /> Sair</button></form>
          </nav>
        </div>
        <main id="conteudo" tabIndex={-1} className="min-w-0 outline-none">{children}</main>
      </div>
    </div>
  );
}
