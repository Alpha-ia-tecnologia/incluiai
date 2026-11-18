import { Building2, Database, Palette, ShieldCheck, Sprout } from "lucide-react";
import { platformDb } from "@/lib/prisma";
import { PLATFORM_ROLE } from "@/lib/tenancy-core";
import { LoginForm } from "@/components/login-form";
import { Character } from "@/components/character";
import { DEMO_PASSWORD } from "../../../prisma/demo-data.mjs";

const POINTS = [
  { icon: Database, text: "Um banco de dados só do município" },
  { icon: Palette, text: "A marca do município: logo e cores" },
  { icon: Building2, text: "O endereço próprio e a primeira conta da Secretaria" },
];

export async function PlatformLogin() {
  const demo = await platformDb().user.findFirst({ where: { role: PLATFORM_ROLE, demo: true, deactivatedAt: null }, select: { email: true } });
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-3 sm:p-6 lg:p-8">
      <div className="grid w-full max-w-[1180px] overflow-hidden rounded-3xl bg-paper p-2 shadow-frame sm:p-3 lg:grid-cols-[1fr_1fr]">
        <section className="flex flex-col px-5 py-6 sm:px-10 sm:py-9 xl:px-16">
          <p className="inline-flex w-fit items-center gap-3 text-ink">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-paper"><Sprout size={23} strokeWidth={1.7} aria-hidden="true" /></span>
            <span className="font-display text-2xl font-semibold tracking-tight">IncluiEdu<span className="text-ink-soft">.</span></span>
          </p>
          <div className="mx-auto w-full max-w-[400px] py-12 sm:py-16">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-surface-muted px-3.5 py-2 text-xs text-ink">
              <ShieldCheck size={14} strokeWidth={1.7} aria-hidden="true" />
              Administração da plataforma
            </span>
            <h1 className="font-display text-3xl font-bold leading-[1.12] tracking-[-0.045em] text-ink sm:text-4xl">Entre para cuidar dos municípios.</h1>
            <p className="mb-8 mt-4 text-sm leading-relaxed text-ink-soft">Por aqui entra só quem administra a plataforma. As equipes das escolas e das Secretarias entram pelo endereço do próprio município.</p>
            <LoginForm />
          </div>
        </section>
        <aside className="surface-navy flex flex-col rounded-2xl px-5 py-8 sm:rounded-3xl sm:px-8 sm:py-10 xl:px-10" aria-labelledby="plataforma-titulo">
          <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <p className="font-display text-3xl font-bold leading-[1.14] tracking-[-0.045em] text-on-navy sm:text-4xl">Cada município, um ambiente.</p>
            <Character variant="planning" className="w-full" preload />
          </div>
          <h2 id="plataforma-titulo" className="mb-4 mt-9 text-sm font-medium text-on-navy">O que cada município recebe</h2>
          <ul className="grid gap-2.5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-2xl bg-paper-raised p-4 text-sm text-ink">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-soft"><Icon size={17} strokeWidth={1.6} aria-hidden="true" /></span>
                {text}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-on-navy-soft">
            {demo
              ? <>Conta de demonstração: <strong className="rounded-md bg-paper-raised px-1.5 py-0.5 font-mono font-medium text-ink">{demo.email}</strong>, senha <strong className="rounded-md bg-paper-raised px-1.5 py-0.5 font-mono font-medium text-ink">{DEMO_PASSWORD}</strong>. No primeiro acesso, ela liga a verificação em duas etapas.</>
              : "Os dados dos estudantes ficam só no banco de cada município: a administração da plataforma não os vê."}
          </p>
        </aside>
      </div>
    </main>
  );
}
