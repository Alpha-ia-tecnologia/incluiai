import Link from "next/link";
import type { ReactNode } from "react";
import { Sprout } from "lucide-react";
import { logout } from "@/actions/auth";
import { quietButtonCls } from "@/components/form-styles";

// Moldura dos passos do login depois da senha (senha nova, duas etapas): a
// marca, o selo do passo, o título e a saída para entrar com outra conta.
export function LoginStepFrame({ badge, icon, title, lede, children }: { badge: string; icon: ReactNode; title: string; lede: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-3 sm:p-6">
      <div className="w-full max-w-xl rounded-3xl bg-paper px-5 py-8 shadow-[0_24px_80px_-36px_rgba(80,50,110,0.24)] sm:px-10 sm:py-10">
        <Link href="/login" className="mb-10 flex w-fit items-center gap-3 text-ink">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-paper">
            <Sprout size={23} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">IncluiEdu<span className="text-ink-soft">.</span></span>
        </Link>

        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3.5 py-2 text-xs text-ink">
          {icon}
          {badge}
        </span>
        <h1 className="font-display text-3xl font-bold leading-[1.12] tracking-[-0.045em] text-ink">{title}</h1>
        <p className="mb-8 mt-3 text-sm leading-relaxed text-ink-soft">{lede}</p>

        {children}

        <form action={logout} className="mt-8 border-t border-line pt-5">
          <button type="submit" className={quietButtonCls}>Voltar e entrar com outra conta</button>
        </form>
      </div>
    </main>
  );
}
