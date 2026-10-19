import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, twoFactorRequired } from "@/lib/auth";
import { linkableStudents, managedAccount, schoolsFor } from "@/lib/accounts";
import { assignableRoles, isAccountManager } from "@/lib/user-admin";
import { resetAccountPassword, resetAccountTwoFactor, setAccountActive, updateAccount } from "@/actions/users";
import { ROLES } from "@/lib/scale";
import { formatDate } from "@/lib/format";
import { PageHeader, Card, SectionTitle, Badge } from "@/components/ui";
import { AccountForm } from "@/components/accounts/account-form";
import { ResetPassword } from "@/components/accounts/reset-password";
import { dangerButtonCls, linkCls, secondaryButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const when = (date: Date) => date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user) redirect("/login");
  if (!isAccountManager(user.role)) redirect("/");
  // Fora do escopo de quem gerencia, a conta não existe para ela.
  const account = await managedAccount(user, id);
  if (!account) notFound();
  const [schools, students, events] = await Promise.all([
    schoolsFor(user),
    linkableStudents(user),
    prisma.accountEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const active = !account.deactivatedAt;
  const otherSchoolLinks = account.links.filter((link) => user.schoolId && link.schoolId !== user.schoolId);

  return (
    <>
      <Link href="/usuarios" className={`mb-4 inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Pessoas e acessos</Link>
      <PageHeader title={account.name} lede={`${ROLES[account.role] ?? account.role} · ${account.email}`} />
      <div className="mb-6 flex flex-wrap gap-2">
        {active ? <Badge tone="green">Ativa</Badge> : <Badge>Desativada em {formatDate(account.deactivatedAt!)}</Badge>}
        {account.mustChangePassword && active ? <Badge tone="amber">Primeiro acesso pendente</Badge> : null}
        {account.totpEnabledAt ? <Badge tone="brand"><ShieldCheck size={14} aria-hidden /> Duas etapas ligadas</Badge> : null}
        <Badge>{account.lastLoginAt ? `Último acesso: ${formatDate(account.lastLoginAt)}` : "Ainda não entrou"}</Badge>
      </div>

      <div className="grid max-w-3xl gap-6">
        <Card>
          <SectionTitle>Dados da conta</SectionTitle>
          {otherSchoolLinks.length ? (
            <p className="mb-4 text-sm leading-relaxed text-ink-soft">Também vinculada a estudantes de outra escola ({otherSchoolLinks.length}). Esses vínculos ficam como estão: quem cuida deles é a escola de cada estudante.</p>
          ) : null}
          <AccountForm
            mode="edit"
            action={updateAccount.bind(null, id)}
            roles={assignableRoles(user).map((value) => ({ value, label: ROLES[value] ?? value }))}
            schools={schools}
            fixedSchool={Boolean(user.schoolId)}
            students={students.map((student) => ({ id: student.id, name: student.name, detail: `${student.gradeYear} · ${student.className}` }))}
            defaults={{ name: account.name, email: account.email, role: account.role, schoolId: account.schoolId, studentIds: account.links.map((link) => link.studentId) }}
          />
        </Card>

        <Card>
          <SectionTitle>Acesso</SectionTitle>
          <div className="grid gap-5">
            {active ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-ink">Senha esquecida</h3>
                <p className="mb-3 text-sm leading-relaxed text-ink-soft">Gera uma senha temporária e encerra as sessões abertas. A pessoa entra com ela e cria a própria.</p>
                <ResetPassword action={resetAccountPassword.bind(null, id)} />
              </div>
            ) : null}
            {account.totpEnabledAt ? (
              <details className="rounded-2xl bg-surface-muted p-4">
                <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Desligar as duas etapas (celular perdido)</summary>
                <p className="my-3 text-sm leading-relaxed text-ink-soft">
                  Use só se a pessoa perdeu o celular e os códigos de recuperação, depois de confirmar quem ela é.
                  {twoFactorRequired(account.role) ? " No próximo acesso, ela liga de novo com o celular novo (é obrigatório para a equipe)." : " Ela pode ligar de novo em Segurança da conta."}
                </p>
                <form action={resetAccountTwoFactor.bind(null, id)}>
                  <button type="submit" className={secondaryButtonCls}>Desligar as duas etapas</button>
                </form>
              </details>
            ) : null}
            {active ? (
              <details className="rounded-2xl bg-surface-muted p-4">
                <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Desativar a conta</summary>
                <p className="my-3 text-sm leading-relaxed text-ink-soft">A pessoa deixa de entrar na hora (as sessões abertas são encerradas). O histórico dos registros fica guardado, e a conta pode ser reativada.</p>
                <form action={setAccountActive.bind(null, id, false)}>
                  <button type="submit" className={dangerButtonCls}><UserX size={16} aria-hidden /> Desativar a conta</button>
                </form>
              </details>
            ) : (
              <form action={setAccountActive.bind(null, id, true)}>
                <button type="submit" className={secondaryButtonCls}><UserCheck size={16} aria-hidden /> Reativar a conta</button>
              </form>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle>Histórico da conta</SectionTitle>
          {events.length ? (
            <ol className="grid gap-3">
              {events.map((event) => (
                <li key={event.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-ink"><strong className="font-medium">{event.actorName}</strong> ({ROLES[event.actorRole] ?? event.actorRole}) {event.action}</p>
                  {event.detail ? <p className="mt-0.5 text-sm text-ink-soft">{event.detail}</p> : null}
                  <p className="mt-0.5 text-xs text-ink-soft"><time dateTime={event.createdAt.toISOString()}>{when(event.createdAt)}</time></p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-soft">Conta criada antes do histórico. As próximas mudanças aparecem aqui.</p>
          )}
        </Card>
      </div>
    </>
  );
}
