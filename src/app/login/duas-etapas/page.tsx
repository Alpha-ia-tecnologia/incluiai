import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser, getPendingLogin } from "@/lib/auth";
import { startTwoFactorSetup, verifySecondStep } from "@/actions/two-factor";
import { CodeForm } from "@/components/two-factor-forms";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { primaryButtonCls } from "@/components/form-styles";
import { LoginStepFrame } from "@/components/login-step-frame";

export const dynamic = "force-dynamic";

// Segunda etapa do login (seção 14): a senha já foi conferida; falta o código
// do aplicativo. Quem precisa das duas etapas e ainda não ligou (REQUIRE_2FA)
// liga aqui mesmo, antes de entrar.
export default async function SecondStepPage() {
  if (await getCurrentUser()) redirect("/");
  const pending = await getPendingLogin();
  if (!pending) redirect("/login");
  if (pending.user.mustChangePassword) redirect("/login/nova-senha");
  const { user } = pending;
  const setup = !user.totpEnabledAt;

  return (
    <LoginStepFrame
      badge="Verificação em duas etapas"
      icon={<ShieldCheck size={14} strokeWidth={1.7} aria-hidden="true" />}
      title={setup ? "Proteja sua conta antes de entrar" : "Confirme que é você"}
      lede={setup
        ? "A equipe da escola e da rede lida com dados de estudantes, por isso a entrada pede, além da senha, um código do celular. Leva dois minutos."
        : `A senha de ${user.email} está certa. Agora digite o código de 6 números do aplicativo autenticador.`}
    >
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
    </LoginStepFrame>
  );
}
