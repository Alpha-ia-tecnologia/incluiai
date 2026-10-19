import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Sprout } from "lucide-react";
import { getCurrentUser, getPendingSecondStep } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { startTwoFactorSetup, verifySecondStep } from "@/actions/two-factor";
import { CodeForm } from "@/components/two-factor-forms";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { primaryButtonCls, quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

// Segunda etapa do login (seção 14): a senha já foi conferida; falta o código
// do aplicativo. Quem precisa das duas etapas e ainda não ligou (REQUIRE_2FA)
// liga aqui mesmo, antes de entrar.
export default async function SecondStepPage() {
  if (await getCurrentUser()) redirect("/");
  const pending = await getPendingSecondStep();
  if (!pending) redirect("/login");
  const { user } = pending;
  const setup = !user.totpEnabledAt;

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
          <ShieldCheck size={14} strokeWidth={1.7} aria-hidden="true" />
          Verificação em duas etapas
        </span>
        <h1 className="font-display text-3xl font-normal leading-[1.12] tracking-[-0.045em] text-ink">
          {setup ? "Proteja sua conta antes de entrar" : "Confirme que é você"}
        </h1>
        <p className="mb-8 mt-3 text-sm leading-relaxed text-ink-soft">
          {setup
            ? "A equipe da escola e da rede lida com dados de estudantes, por isso a entrada pede, além da senha, um código do celular. Leva dois minutos."
            : `A senha de ${user.email} está certa. Agora digite o código de 6 números do aplicativo autenticador.`}
        </p>

        {setup ? (
          user.totpPendingSecret ? (
            <TwoFactorSetup secret={user.totpPendingSecret} account={user.email} finish="enter" />
          ) : (
            <form action={startTwoFactorSetup}>
              <button type="submit" className={primaryButtonCls}><ShieldCheck size={16} aria-hidden /> Começar</button>
            </form>
          )
        ) : (
          <div className="grid gap-6">
            <CodeForm action={verifySecondStep} label="Código do aplicativo (6 números)" button="Entrar" pendingLabel="Conferindo…" />
            <details className="rounded-2xl bg-surface-muted p-4">
              <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Estou sem o celular</summary>
              <div className="mt-4">
                <CodeForm
                  action={verifySecondStep}
                  kind="recovery"
                  variant="secondary"
                  label="Código de recuperação"
                  hint="Um dos códigos que você guardou ao ligar as duas etapas. Cada um vale uma vez."
                  button="Entrar com o código de recuperação"
                  pendingLabel="Conferindo…"
                />
                <p className="mt-4 text-xs leading-relaxed text-ink-soft">Sem o celular e sem os códigos? Peça à coordenação ou à Secretaria para desligar as duas etapas da sua conta.</p>
              </div>
            </details>
          </div>
        )}

        <form action={logout} className="mt-8 border-t border-line pt-5">
          <button type="submit" className={quietButtonCls}>Voltar e entrar com outra conta</button>
        </form>
      </div>
    </main>
  );
}
