import { redirect } from "next/navigation";
import { canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { canRecordAeeSession, listAeeSessions } from "@/lib/aee-sessions";
import { AEE_SESSION_STATUSES, AEE_SESSION_STATUS_LABEL, type AeeSessionStatus } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { AeeSessionForm } from "@/components/aee-session-form";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<AeeSessionStatus, "green" | "amber" | "neutral"> = { realizado: "green", falta: "amber", cancelamento: "neutral" };

// Data local do servidor no formato do <input type="date">.
function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Atendimentos AEE (seção 5, CA10): frequência separada da aprendizagem. Toda a
// equipe pedagógica vê; registram o professor do AEE e a coordenação.
export default async function AeeSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Família e terapeuta voltam ao resumo. O layout já conferiu o acesso ao estudante.
  if (!canSeePedagogicalDetail(user.role) || !isStaffOrNetwork(user.role)) redirect(`/estudantes/${id}`);

  const { sessions, summary } = await listAeeSessions(user, id);
  const canRecord = canRecordAeeSession(user);

  return (
    <>
      <PageHeader title="Atendimentos AEE" lede="Frequência do atendimento educacional especializado: se o atendimento foi realizado, se houve falta ou cancelamento." />

      <div className="grid min-w-0 max-w-3xl gap-6">
        <Card className="min-w-0 bg-sky-soft/60">
          <SectionTitle>Frequência não é aprendizagem</SectionTitle>
          <div className="grid gap-2 text-sm leading-relaxed text-ink">
            <p>Realizado, falta e cancelamento ficam separados. Falta e cancelamento sempre têm o motivo registrado.</p>
            <p>Comparecer ao atendimento não é evidência de aprendizagem: o registro mostra que o encontro aconteceu, não o que o estudante aprendeu. A aprendizagem é registrada nas evidências das atividades e no diário de acompanhamento.</p>
          </div>
        </Card>

        <section aria-labelledby="aee-resumo" className="min-w-0">
          <h2 id="aee-resumo" className="mb-3 text-lg font-semibold text-ink">Resumo</h2>
          <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            {AEE_SESSION_STATUSES.map((status) => (
              <div key={status} className="min-w-0 rounded-xl bg-surface-muted p-4">
                <dt className="text-sm text-ink-soft">{AEE_SESSION_STATUS_LABEL[status]}</dt>
                <dd className="mt-1 font-display text-3xl font-medium text-ink">{summary[status]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-soft">Contagem dos registros listados abaixo.</p>
        </section>

        {canRecord ? (
          <Card className="min-w-0">
            <SectionTitle>Registrar atendimento</SectionTitle>
            <AeeSessionForm studentId={id} today={todayInput()} />
          </Card>
        ) : (
          <p className="text-sm text-ink-soft">A frequência do AEE é registrada pelo professor do AEE ou pela coordenação.</p>
        )}

        <section aria-labelledby="aee-registros" className="min-w-0">
          <h2 id="aee-registros" className="mb-1 text-lg font-semibold text-ink">Registros</h2>
          <p className="mb-4 text-sm text-ink-soft">Os mais recentes aparecem primeiro.</p>
          {sessions.length ? (
            <ul className="grid min-w-0 gap-3">
              {sessions.map((session) => {
                const status = session.status as AeeSessionStatus;
                return (
                  <li key={session.id} className="min-w-0">
                    <Card className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-ink">{formatDate(session.date)}</h3>
                        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{AEE_SESSION_STATUS_LABEL[status] ?? session.status}</Badge>
                      </div>
                      {session.reason ? <p className="mt-2 break-words text-sm text-ink"><span className="font-medium">Motivo: </span>{session.reason}</p> : null}
                      {session.note ? <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-soft"><span className="font-medium text-ink">Observação: </span>{session.note}</p> : null}
                      <p className="mt-2 text-xs text-ink-soft">Registrado por {session.authorName}</p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Nenhum atendimento registrado" hint={canRecord ? "Use o formulário acima depois de cada atendimento previsto." : undefined} />
          )}
        </section>
      </div>
    </>
  );
}
