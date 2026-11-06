import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Building2, GraduationCap, Heart, School, ShieldCheck, Sprout, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { Character } from "@/components/character";

export const dynamic = "force-dynamic";

const DEMO_ACCOUNTS = [
  { role: "Secretaria de Educação", email: "secretaria@municipio.gov.br", icon: Building2, color: "var(--sky-soft)" },
  { role: "Coordenação pedagógica", email: "coordenacao@escola.edu.br", icon: School, color: "var(--sage-soft)" },
  { role: "Professor(a) da sala comum", email: "professor@escola.edu.br", icon: GraduationCap, color: "var(--teal-soft)" },
  { role: "Professor(a) do AEE", email: "aee@escola.edu.br", icon: BookOpen, color: "var(--peach-soft)" },
  { role: "Terapeuta (rede de saúde)", email: "terapeuta@clinica.com.br", icon: Heart, color: "var(--rose-soft)" },
  { role: "Família", email: "familia@email.com", icon: Users, color: "var(--brand-soft)" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-3 sm:p-6 lg:p-8">
      <div className="grid w-full max-w-[1320px] overflow-hidden rounded-xl bg-paper p-2 shadow-[0_24px_80px_-36px_rgba(80,50,110,0.24)] sm:rounded-xl sm:p-3 lg:grid-cols-[1fr_1fr]">
        <section className="flex flex-col px-5 py-6 sm:px-10 sm:py-9 xl:px-16">
          <Link href="/login" className="inline-flex w-fit items-center gap-3 text-ink">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-paper">
              <Sprout size={23} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span className="font-display text-2xl font-bold">IncluiEdu<span className="text-ink-soft">.</span></span>
          </Link>

          <div className="mx-auto w-full max-w-[400px] py-12 sm:py-16 lg:py-20">
            <h1 className="font-display text-[36px] font-bold leading-[1.12] tracking-[-0.045em] text-ink sm:text-[44px]">
              Que bom ter<br />você por aqui.
            </h1>
            <p className="mb-8 mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">Entre na plataforma e acompanhe os próximos passos de uma educação mais inclusiva.</p>
            <LoginForm />
          </div>

          <p className="mt-auto flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
            <ShieldCheck size={16} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Conectando escolas, profissionais e famílias.<br className="hidden sm:block" /> Cuidando de cada trajetória.</span>
          </p>
        </section>

        <aside className="flex flex-col rounded-xl bg-[var(--surface-muted)] px-5 py-8 sm:rounded-xl sm:px-8 sm:py-10 xl:px-10" aria-labelledby="demo-title">

          <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-[minmax(0,1fr)_144px] xl:grid-cols-[minmax(0,1fr)_180px]">
            <p className="font-display text-[28px] font-bold leading-[1.14] tracking-[-0.045em] text-ink sm:text-[36px] lg:text-[30px] xl:text-[36px]">Muitas conexões.<br />Um só propósito.</p>
            <Character variant="care" className="w-full" preload />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">Toda trajetória é única. Juntos, construímos caminhos para que cada estudante possa aprender e se desenvolver.</p>

          <div className="mb-4 mt-9 flex flex-wrap items-end justify-between gap-3">
            <h2 id="demo-title" className="text-sm font-medium text-ink">Explore a plataforma</h2>
            <span className="text-xs text-ink-soft">Contas de demonstração</span>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map(({ role, email, icon: Icon, color }) => (
              <li key={email} className="min-w-0 rounded-xl p-4 text-ink" style={{ backgroundColor: color }}>
                <span className="mb-4 flex size-8 items-center justify-center rounded-full bg-white/75">
                  <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <p className="text-[13px] font-medium leading-snug">{role}</p>
                <p className="mt-1.5 break-all text-xs leading-relaxed text-ink/75">{email}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-ink-soft">
            Cada perfil tem seu espaço. A senha de todas as contas é <strong className="rounded-md bg-paper-raised px-1.5 py-0.5 font-mono font-medium text-ink">demo123</strong>.
          </p>
        </aside>
      </div>
    </main>
  );
}
