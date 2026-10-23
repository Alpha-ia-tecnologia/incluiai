import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, BookOpen, Building2, GraduationCap, Heart, School, ShieldCheck, Sparkles, Sprout, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/login-form";
import { Character } from "@/components/character";

export const dynamic = "force-dynamic";

// Um cartão por perfil. Com contas de demonstração no banco, o cartão mostra o
// e-mail; num banco real, diz o que cada perfil acompanha.
const PROFILES = [
  { role: "secretaria", label: "Secretaria de Educação", scope: "A rede inteira e os indicadores", icon: Building2, color: "var(--sky-soft)" },
  { role: "coordenacao", label: "Coordenação pedagógica", scope: "Os estudantes e o painel da escola", icon: School, color: "var(--sage-soft)" },
  { role: "professor_sala", label: "Professor(a) da sala comum", scope: "A turma e o planejamento com DUA", icon: GraduationCap, color: "var(--teal-soft)" },
  { role: "professor_aee", label: "Professor(a) do AEE", scope: "Estudo de caso, plano e atendimentos", icon: BookOpen, color: "var(--peach-soft)" },
  { role: "terapeuta", label: "Terapeuta (rede de saúde)", scope: "O perfil funcional do paciente", icon: Heart, color: "var(--rose-soft)" },
  { role: "familia", label: "Família", scope: "O acompanhamento do filho(a)", icon: Users, color: "var(--brand-soft)" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const demoAccounts = await prisma.user.findMany({ where: { demo: true, deactivatedAt: null }, select: { email: true, role: true } });
  const demo = demoAccounts.length > 0;
  const cards = PROFILES.flatMap((profile) => {
    if (!demo) return [{ ...profile, key: profile.role, detail: profile.scope }];
    const account = demoAccounts.find((item) => item.role === profile.role);
    return account ? [{ ...profile, key: account.email, detail: account.email }] : [];
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-3 sm:p-6 lg:p-8">
      <div className="grid w-full max-w-[1320px] overflow-hidden rounded-3xl bg-paper p-2 shadow-[0_24px_80px_-36px_rgba(80,50,110,0.24)] sm:rounded-3xl sm:p-3 lg:grid-cols-[1fr_1fr]">
        <section className="flex flex-col px-5 py-6 sm:px-10 sm:py-9 xl:px-16">
          <Link href="/login" className="inline-flex w-fit items-center gap-3 text-ink">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-paper">
              <Sprout size={23} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight">IncluiEdu<span className="text-ink-soft">.</span></span>
          </Link>

          <div className="mx-auto w-full max-w-[400px] py-12 sm:py-16 lg:py-20">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3.5 py-2 text-xs text-ink">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
              Um espaço para cada possibilidade
            </span>
            <h1 className="font-display text-3xl font-bold leading-[1.12] tracking-[-0.045em] text-ink sm:text-4xl">
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

        <aside className="flex flex-col rounded-2xl bg-[var(--surface-muted)] px-5 py-8 sm:rounded-3xl sm:px-8 sm:py-10 xl:px-10" aria-labelledby="demo-title">
          <div className="mb-8 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-paper-raised px-3.5 py-2 text-xs text-ink">
              <Sparkles size={14} strokeWidth={1.7} aria-hidden="true" />
              Educação que aproxima
            </span>
            <span className="flex size-9 items-center justify-center rounded-full border border-ink/15" aria-hidden="true">
              <ArrowUpRight size={19} strokeWidth={1.6} />
            </span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-[minmax(0,1fr)_144px] xl:grid-cols-[minmax(0,1fr)_180px]">
            <p className="font-display text-3xl font-bold leading-[1.14] tracking-[-0.045em] text-ink sm:text-4xl lg:text-3xl xl:text-4xl">Muitas conexões.<br />Um só propósito.</p>
            <Character variant="care" className="w-full" preload />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">Toda trajetória é única. Juntos, construímos caminhos para que cada estudante possa aprender e se desenvolver.</p>

          <div className="mb-4 mt-9 flex flex-wrap items-end justify-between gap-3">
            <h2 id="demo-title" className="text-sm font-medium text-ink">{demo ? "Explore a plataforma" : "Um espaço para cada perfil"}</h2>
            <span className="text-xs text-ink-soft">{demo ? "Contas de demonstração" : "Quem usa a plataforma"}</span>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {cards.map(({ key, label, detail, icon: Icon, color }) => (
              <li key={key} className="min-w-0 rounded-2xl p-4 text-ink" style={{ backgroundColor: color }}>
                <span className="mb-4 flex size-8 items-center justify-center rounded-full bg-white/75">
                  <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <p className="text-sm font-medium leading-snug">{label}</p>
                <p className={`mt-1.5 text-xs leading-relaxed text-ink/75 ${demo ? "break-all" : ""}`}>{detail}</p>
              </li>
            ))}
          </ul>
          {demo ? (
            <p className="mt-5 text-xs leading-relaxed text-ink-soft">
              Cada perfil tem seu espaço. A senha de todas as contas é <strong className="rounded-md bg-paper-raised px-1.5 py-0.5 font-mono font-medium text-ink">demo123</strong>.
            </p>
          ) : (
            <p className="mt-5 text-xs leading-relaxed text-ink-soft">
              Primeiro acesso? A conta é criada pela Secretaria de Educação ou pela gestão da escola, que entrega uma senha temporária; na primeira entrada, você cria a sua. Esqueceu a senha? Peça uma nova a quem criou a sua conta.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
