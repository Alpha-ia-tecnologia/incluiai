import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ShieldCheck, UserPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { manageableAccounts } from "@/lib/accounts";
import { assignableRoles, isAccountManager } from "@/lib/user-admin";
import { ROLES } from "@/lib/scale";
import { formatDate } from "@/lib/format";
import { PageHeader, Badge, ButtonLink, EmptyState } from "@/components/ui";
import { DataBoard, StatTile } from "@/components/data-viz";
import { inputCls, labelCls, quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

type Query = { q?: string | string[]; perfil?: string | string[]; situacao?: string | string[] };
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

// Pessoas e acessos (seções 7 e 14): as contas que a pessoa gerencia — a
// Secretaria, a equipe das escolas; a escola, a equipe dela, as famílias e os
// terapeutas dos estudantes dela.
export default async function AccountsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/login");
  if (!isAccountManager(user.role)) redirect("/");
  const accounts = await manageableAccounts(user);
  const roles = assignableRoles(user);
  const q = one(query.q).trim().toLowerCase();
  const role = roles.includes(one(query.perfil)) ? one(query.perfil) : "";
  const status = ["ativas", "desativadas", "primeiro-acesso"].includes(one(query.situacao)) ? one(query.situacao) : "";
  const shown = accounts.filter((account) =>
    (!q || account.name.toLowerCase().includes(q) || account.email.includes(q))
    && (!role || account.role === role)
    && (!status || (status === "ativas" ? !account.deactivatedAt : status === "desativadas" ? Boolean(account.deactivatedAt) : account.mustChangePassword && !account.deactivatedAt)));
  const active = accounts.filter((account) => !account.deactivatedAt);
  const firstAccess = active.filter((account) => account.mustChangePassword).length;
  const twoFactor = active.filter((account) => account.totpEnabledAt).length;
  const filtering = Boolean(q || role || status);

  return (
    <>
      <PageHeader
        title="Pessoas e acessos"
        lede={user.role === "secretaria"
          ? "Contas da equipe das escolas e da rede: crie, altere, redefina a senha e desative quem saiu. Famílias e terapeutas são cadastrados pela escola."
          : "Contas da equipe da escola, das famílias e dos terapeutas: crie, vincule aos estudantes, redefina a senha e desative quem saiu."}
        actions={<ButtonLink href="/usuarios/nova"><UserPlus size={16} aria-hidden /> Nova conta</ButtonLink>}
      />

      <section aria-label="Resumo das contas" className="mb-6">
        <DataBoard className="sm:grid-cols-3">
          <StatTile label="Contas ativas" value={active.length} hint={accounts.length > active.length ? `${accounts.length - active.length} desativada(s), com o histórico guardado.` : "Nenhuma conta desativada."} />
          <StatTile label="Primeiro acesso pendente" value={firstAccess} tone={firstAccess ? "mid" : "good"} hint="Pessoas que ainda não trocaram a senha temporária." />
          <StatTile label="Com duas etapas" value={active.length ? `${Math.round((twoFactor / active.length) * 100)}%` : "—"} hint={`${twoFactor} de ${active.length} contas ativas entram com o código do celular.`} />
        </DataBoard>
      </section>

      <form method="get" role="search" aria-label="Buscar contas" className="mb-6 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,12rem)_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="busca-conta" className={labelCls}>Nome ou e-mail</label>
          <input id="busca-conta" name="q" type="search" defaultValue={one(query.q)} className={inputCls} />
        </div>
        <div className="min-w-0">
          <label htmlFor="filtro-perfil" className={labelCls}>Perfil</label>
          <select id="filtro-perfil" name="perfil" defaultValue={role} className={inputCls}>
            <option value="">Todos</option>
            {roles.map((value) => <option key={value} value={value}>{ROLES[value] ?? value}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="filtro-situacao" className={labelCls}>Situação</label>
          <select id="filtro-situacao" name="situacao" defaultValue={status} className={inputCls}>
            <option value="">Todas</option>
            <option value="ativas">Ativas</option>
            <option value="primeiro-acesso">Primeiro acesso pendente</option>
            <option value="desativadas">Desativadas</option>
          </select>
        </div>
        <button type="submit" className={quietButtonCls}><Search size={16} aria-hidden /> Filtrar</button>
      </form>

      {shown.length ? (
        <section aria-labelledby="contas-lista" className="min-w-0">
          <h2 id="contas-lista" className="mb-4 font-display text-xl font-medium text-ink">
            Contas <span className="tabular-nums">({filtering ? `${shown.length} de ${accounts.length}` : accounts.length})</span>
          </h2>
          <ul className="grid min-w-0 gap-3">
            {shown.map((account) => (
              <li key={account.id} className="ui-card flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <h3 className="text-sm font-medium text-ink">
                    <Link href={`/usuarios/${account.id}`} className="underline-offset-4 hover:underline">{account.name}</Link>
                  </h3>
                  <p className="break-all text-xs text-ink-soft">{account.email}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {ROLES[account.role] ?? account.role}
                    {account.links.length ? ` · ${account.links.map((link) => link.name.split(" ")[0]).join(", ")}` : account.schoolName ? ` · ${account.schoolName}` : account.role !== "secretaria" ? " · Rede" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {account.deactivatedAt ? <Badge>Desativada</Badge> : account.mustChangePassword ? <Badge tone="amber">Primeiro acesso pendente</Badge> : null}
                  {account.totpEnabledAt && !account.deactivatedAt ? <Badge tone="green"><ShieldCheck size={14} aria-hidden /> Duas etapas</Badge> : null}
                  <span className="text-xs text-ink-soft">{account.lastLoginAt ? `Último acesso: ${formatDate(account.lastLoginAt)}` : "Ainda não entrou"}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState character="planning" title={filtering ? "Nenhuma conta com este filtro" : "Nenhuma conta para gerenciar ainda"} hint={filtering ? "Mude a busca ou os filtros." : "Crie a primeira conta pelo botão Nova conta."} />
      )}
    </>
  );
}
