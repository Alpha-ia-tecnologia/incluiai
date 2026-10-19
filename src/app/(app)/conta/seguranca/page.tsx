import { redirect } from "next/navigation";
import { LogOut, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { currentSessionId, getCurrentUser, twoFactorRequired } from "@/lib/auth";
import { recoveryCodesLeft } from "@/lib/two-factor";
import { formatDate } from "@/lib/format";
import { cancelTwoFactorSetup, disableTwoFactor, endOtherSessions, regenerateRecoveryCodes, startTwoFactorSetup } from "@/actions/two-factor";
import { changeOwnPassword } from "@/actions/account";
import { PasswordForm } from "@/components/password-form";
import { ROLES } from "@/lib/scale";
import { PageHeader, Card, SectionTitle, Badge } from "@/components/ui";
import { CodeForm } from "@/components/two-factor-forms";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { primaryButtonCls, quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

// Segurança da conta (seção 14): verificação em duas etapas e sessões abertas.
export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ aviso?: string | string[] }> }) {
  const [session, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!session) redirect("/login");
  const now = new Date();
  const [user, sessions, current, events] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.id }, select: { email: true, totpEnabledAt: true, totpPendingSecret: true, recoveryCodes: true, passwordChangedAt: true } }),
    prisma.session.count({ where: { userId: session.id, mfaPending: false, expiresAt: { gt: now } } }),
    currentSessionId(),
    prisma.accountEvent.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const required = twoFactorRequired(session.role);
  const codesLeft = recoveryCodesLeft(user.recoveryCodes);
  const usedRecovery = query.aviso === "recuperacao";

  return (
    <>
      <PageHeader title="Segurança da conta" lede="Como você entra na plataforma e onde sua conta está aberta. Os dados dos estudantes ficam mais protegidos quando a entrada pede, além da senha, um código do celular." />

      {usedRecovery && user.totpEnabledAt ? (
        <p role="status" className="mb-6 flex max-w-3xl items-start gap-2 rounded-xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-amber">
          <ShieldAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          Você entrou com um código de recuperação. {codesLeft === 1 ? "Resta 1 código" : `Restam ${codesLeft} códigos`}. Se estiverem acabando, gere novos abaixo.
        </p>
      ) : null}

      <div className="grid max-w-3xl gap-6">
        <Card>
          <SectionTitle>Senha</SectionTitle>
          <p className="mb-4 text-sm leading-relaxed text-ink-soft">
            {user.passwordChangedAt ? `Trocada em ${formatDate(user.passwordChangedAt)}.` : "Ainda é a senha do cadastro."} Ao trocar, as outras sessões da conta são encerradas.
          </p>
          <details className="rounded-2xl bg-surface-muted p-4">
            <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Trocar a senha</summary>
            <div className="mt-4">
              <PasswordForm action={changeOwnPassword} askCurrent button="Trocar a senha" pendingLabel="Trocando…" savedMessage="Senha trocada. As outras sessões foram encerradas." />
            </div>
          </details>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 [&>h2]:mb-0">
            <SectionTitle>Verificação em duas etapas</SectionTitle>
            {user.totpEnabledAt ? <Badge tone="green"><ShieldCheck size={14} aria-hidden /> Ligada</Badge> : <Badge tone="amber"><ShieldOff size={14} aria-hidden /> Desligada</Badge>}
          </div>

          {user.totpEnabledAt ? (
            <div className="grid gap-5">
              <p className="text-sm leading-relaxed text-ink-soft">
                Ligada desde {formatDate(user.totpEnabledAt)}. Ao entrar, depois da senha, a plataforma pede o código do aplicativo autenticador.{" "}
                {codesLeft === 1 ? "Resta 1 código de recuperação." : `Restam ${codesLeft} códigos de recuperação.`}
              </p>
              <details className="rounded-2xl bg-surface-muted p-4" open={usedRecovery && codesLeft <= 3}>
                <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Gerar novos códigos de recuperação</summary>
                <p className="my-3 text-sm leading-relaxed text-ink-soft">Os códigos antigos deixam de valer.</p>
                <CodeForm action={regenerateRecoveryCodes} label="Código do aplicativo (6 números)" button="Gerar novos códigos" pendingLabel="Gerando…" variant="secondary" />
              </details>
              {required ? (
                <p className="text-sm leading-relaxed text-ink-soft">Na sua rede, a verificação em duas etapas é obrigatória para a equipe.</p>
              ) : (
                <details className="rounded-2xl bg-surface-muted p-4">
                  <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Desligar a verificação em duas etapas</summary>
                  <p className="my-3 text-sm leading-relaxed text-ink-soft">A entrada volta a pedir só a senha.</p>
                  <CodeForm action={disableTwoFactor} label="Código do aplicativo ou de recuperação" kind="recovery" button="Desligar" pendingLabel="Desligando…" variant="danger" />
                </details>
              )}
            </div>
          ) : user.totpPendingSecret ? (
            <div className="grid gap-5">
              <TwoFactorSetup secret={user.totpPendingSecret} account={user.email} finish="refresh" />
              <form action={cancelTwoFactorSetup}>
                <button type="submit" className={quietButtonCls}>Cancelar</button>
              </form>
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm leading-relaxed text-ink-soft">
                Com as duas etapas, quem descobrir sua senha ainda não entra: a plataforma pede também um código que muda a cada 30 segundos no seu celular.
                {required ? " Na sua rede, ela é obrigatória para a equipe." : ""}
              </p>
              <form action={startTwoFactorSetup}>
                <button type="submit" className={primaryButtonCls}><ShieldCheck size={16} aria-hidden /> Ligar a verificação em duas etapas</button>
              </form>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Onde sua conta está aberta</SectionTitle>
          <p className="mb-4 text-sm leading-relaxed text-ink-soft">
            {sessions <= 1
              ? "Sua conta está aberta só aqui."
              : `Sua conta está aberta aqui e em mais ${sessions - 1 === 1 ? "1 lugar" : `${sessions - 1} lugares`} (outro navegador ou computador). Esqueceu aberta no computador da escola? Encerre as outras.`}
          </p>
          {sessions > 1 && current ? (
            <form action={endOtherSessions}>
              <button type="submit" className={quietButtonCls}><LogOut size={16} aria-hidden /> Encerrar as outras sessões</button>
            </form>
          ) : null}
        </Card>

        {events.length ? (
          <Card>
            <SectionTitle>Mudanças na sua conta</SectionTitle>
            <p className="mb-4 text-sm leading-relaxed text-ink-soft">Quem criou, alterou ou redefiniu algo na sua conta. Não reconhece alguma mudança? Fale com a coordenação.</p>
            <ol className="grid gap-3">
              {events.map((event) => (
                <li key={event.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-ink">{event.actorId === session.id ? "Você" : <><strong className="font-medium">{event.actorName}</strong> ({ROLES[event.actorRole] ?? event.actorRole})</>} {event.action}</p>
                  {event.detail ? <p className="mt-0.5 text-sm text-ink-soft">{event.detail}</p> : null}
                  <p className="mt-0.5 text-xs text-ink-soft">{formatDate(event.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </div>
    </>
  );
}
