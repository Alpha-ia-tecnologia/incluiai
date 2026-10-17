import { notFound, redirect } from "next/navigation";
import { ChevronDown, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { DuaError } from "@/lib/dua/shared";
import { collaboratorOptions, loadPlanning, planningHistory } from "@/lib/dua/plannings";
import { EXECUTION_STATE_LABEL, type ExecutionState, type ReviewState } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";
import { ROLES } from "@/lib/scale";
import { Card, SectionTitle } from "@/components/ui";
import { ReviewBadge } from "@/components/dua/dua-ui";
import { VersionSummary } from "@/components/dua/history/version-summary";
import { CollaboratorsForm } from "@/components/dua/history/collaborators-form";

export const dynamic = "force-dynamic";

const OBJECT_TYPE_LABEL: Record<string, string> = {
  planejamento: "Planejamento",
  versao: "Versão",
  aplicacao: "Aplicação",
  apoio: "Apoio individual",
  evidencia: "Evidência",
  material: "Material",
  sugestao: "Sugestão",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const roleLabel = (role: string) => ROLES[role] ?? role;

// O detalhe da mudança de situação vem com o código do estado; aqui vira texto.
const detailText = (action: string, detail: string | null) => {
  if (!detail) return null;
  if (action === "mudou a situação da aplicação") return `Nova situação: ${EXECUTION_STATE_LABEL[detail as ExecutionState] ?? detail}`;
  return detail;
};

// Versões e histórico (seção 7): cada versão com estado, autoria e validação, e
// os eventos do planejamento (quem, papel, ação, objeto, versão e quando).
export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let data;
  try {
    const loaded = await loadPlanning(user, id);
    const [history, options] = await Promise.all([planningHistory(user, id), loaded.access.share ? collaboratorOptions(user, id) : Promise.resolve([])]);
    data = { ...loaded, history, options };
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const { planning, access, history, options } = data;

  return (
    <div className="grid min-w-0 gap-8">
      <section aria-labelledby="versoes-titulo" className="min-w-0">
        <h2 id="versoes-titulo" className="mb-2 font-display text-xl font-medium text-ink">Versões</h2>
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-soft">
          Uma versão validada não muda mais. Editar depois da validação abre a versão seguinte, e cada aplicação e material continua ligado à versão de onde saiu.
        </p>
        <ol className="grid min-w-0 gap-3">
          {history.versions.map((version) => {
            const state = version.state as ReviewState;
            return (
              <li key={version.id} className="min-w-0">
                <Card className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="text-base font-medium text-ink">Versão {version.version}</h3>
                    <ReviewBadge state={state} />
                    {state === "validado" ? <span className="inline-flex items-center gap-1 text-xs text-ink-soft"><Lock size={12} aria-hidden /> não muda mais</span> : null}
                  </div>
                  <dl className="mt-2 grid min-w-0 gap-1 text-sm">
                    <div className="min-w-0"><dt className="inline font-medium text-ink">Criada: </dt><dd className="inline text-ink-soft">por {version.createdByName} em {formatDate(version.createdAt)}</dd></div>
                    <div className="min-w-0"><dt className="inline font-medium text-ink">Última edição: </dt><dd className="inline text-ink-soft">por {version.updatedByName} em {dateTime.format(version.updatedAt)}</dd></div>
                    {version.submittedAt ? <div className="min-w-0"><dt className="inline font-medium text-ink">Enviada para revisão: </dt><dd className="inline text-ink-soft">em {formatDate(version.submittedAt)}</dd></div> : null}
                    {version.validatedAt ? <div className="min-w-0"><dt className="inline font-medium text-ink">Validada: </dt><dd className="inline text-ink-soft">por {version.validatedByName ?? "—"} em {dateTime.format(version.validatedAt)}</dd></div> : null}
                  </dl>
                  <details className="group mt-3 rounded-xl border border-line bg-paper">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-brand-strong [&::-webkit-details-marker]:hidden">
                      <ChevronDown size={16} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
                      Ver o conteúdo da versão {version.version} (somente leitura)
                    </summary>
                    <div className="border-t border-line p-3">
                      <VersionSummary content={version.content} />
                    </div>
                  </details>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <Card className="min-w-0">
        <SectionTitle>Colaboração</SectionTitle>
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-soft">
          Colaboradores editam o planejamento com o responsável ({planning.ownerName}); professores, coordenação e gestão colaboradores também podem validar.
          O restante da equipe da escola, inclusive a da turma, só lê o planejamento quando ele está compartilhado.
        </p>
        {access.share ? (
          <CollaboratorsForm
            planningId={planning.id}
            options={options.map((item) => ({ id: item.id, name: item.name, roleLabel: roleLabel(item.role) }))}
            selected={planning.collaboratorList.map((item) => item.id)}
          />
        ) : (
          <>
            <p className="text-sm text-ink">{planning.collaboratorList.length ? `Colaboram: ${planning.collaboratorList.map((item) => item.name).join(", ")}.` : "Sem colaboradores."}</p>
            <p className="mt-1 text-xs text-ink-soft">Só o responsável ou a coordenação definem quem colabora.</p>
          </>
        )}
      </Card>

      <section aria-labelledby="eventos-titulo" className="min-w-0">
        <h2 id="eventos-titulo" className="mb-2 font-display text-xl font-medium text-ink">Histórico de ações</h2>
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-soft">Quem fez o quê, em qual versão e quando. Nomes de estudantes não aparecem aqui: o histórico é lido por toda a equipe do planejamento.</p>
        {history.events.length ? (
          <ol className="grid min-w-0 max-w-3xl gap-2">
            {history.events.map((event) => {
              const detail = detailText(event.action, event.detail);
              return (
                <li key={event.id} className="min-w-0 rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 break-words text-ink">
                      <span className="font-medium">{event.actorName}</span> <span className="text-ink-soft">({roleLabel(event.role)})</span> {event.action}
                    </p>
                    <time dateTime={event.createdAt.toISOString()} className="shrink-0 text-xs text-ink-soft">{dateTime.format(event.createdAt)}</time>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {OBJECT_TYPE_LABEL[event.objectType] ?? event.objectType}{event.versionNumber ? ` · versão ${event.versionNumber}` : ""}
                  </p>
                  {detail ? <p className="mt-1 break-words text-ink-soft">{detail}</p> : null}
                </li>
              );
            })}
          </ol>
        ) : <p className="text-sm text-ink-soft">Nenhuma ação registrada ainda.</p>}
      </section>
    </div>
  );
}
