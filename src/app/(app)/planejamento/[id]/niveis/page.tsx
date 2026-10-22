import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, FileDown, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasApiKey } from "@/lib/env";
import { isAIEnabled } from "@/lib/agents/model";
import { DuaError, loadPlanningFor } from "@/lib/dua/shared";
import { taskContent } from "@/lib/adapted-tasks";
import { LEVEL_LABEL, type LevelKey } from "@/lib/task-adaptation";
import { formatDate } from "@/lib/format";
import { makeLevels, saveLevelTask } from "@/actions/adapted-tasks";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { AdaptForm } from "@/components/adapted/adapt-form";
import { AdaptedView } from "@/components/adapted/adapted-view";
import { AdaptedEditor } from "@/components/adapted/adapted-editor";
import { quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const ORDER: LevelKey[] = ["mais_apoio", "padrao", "desafio"];

// A mesma atividade da turma em três níveis de complexidade (item 5 do plano):
// mesmo tema e mesma habilidade, caminhos diferentes para o mesmo objetivo (DUA).
export default async function LevelsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lote?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  if (!user) redirect("/login");
  let access;
  try {
    ({ access } = await loadPlanningFor(user, id, "read"));
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const tasks = await prisma.adaptedTask.findMany({ where: { planningId: id }, orderBy: { createdAt: "desc" } });
  const batches = [...new Map(tasks.map((task) => [task.batchId, task])).values()];
  const batchId = batches.some((task) => task.batchId === query.lote) ? query.lote : batches[0]?.batchId;
  const current = ORDER.map((level) => tasks.find((task) => task.batchId === batchId && task.level === level)).filter((task) => task !== undefined);

  return (
    <div className="grid min-w-0 gap-8">
      <section aria-labelledby="niveis-titulo" className="max-w-3xl min-w-0">
        <h2 id="niveis-titulo" className="mb-2 font-display text-xl font-medium text-ink">A mesma atividade em três níveis</h2>
        <p className="text-sm leading-relaxed text-ink-soft">Com mais apoio, padrão e com desafio: mesmo tema, mesmo objetivo e mesma habilidade da BNCC. Cada estudante recebe a versão que o ajuda a participar, e nada na folha diz o nível.</p>
      </section>

      {access.edit ? (
        <Card className="min-w-0">
          <SectionTitle>Gerar os níveis de uma atividade</SectionTitle>
          <AdaptForm action={makeLevels.bind(null, id)} canRead={isAIEnabled() && hasApiKey("ANTHROPIC_API_KEY")} aiOn={isAIEnabled()} showOptions={false} adaptLabel="Gerar os três níveis" />
        </Card>
      ) : null}

      {batches.length > 1 ? (
        <nav aria-label="Atividades com níveis" className="flex min-w-0 flex-wrap gap-2">
          {batches.map((task) => (
            <Link key={task.batchId} href={`/planejamento/${id}/niveis?lote=${task.batchId}`} aria-current={task.batchId === batchId ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm ${task.batchId === batchId ? "bg-brand font-medium text-white" : "bg-surface-muted text-ink-soft hover:bg-line"}`}>
              {task.title} · {formatDate(task.createdAt)}
            </Link>
          ))}
        </nav>
      ) : null}

      {current.length ? (
        <section aria-labelledby="niveis-lote" className="min-w-0">
          <h2 id="niveis-lote" className="mb-4 font-display text-xl font-medium text-ink">{current[0].title}</h2>
          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            {current.map((task) => {
              const content = taskContent(task.content, task.title);
              return (
                <Card key={task.id} className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{LEVEL_LABEL[task.level as LevelKey] ?? task.level}</Badge>
                    {task.status === "aprovada" ? <Badge tone="green"><CircleCheck size={12} aria-hidden /> Aprovada</Badge> : <Badge tone="amber">Rascunho</Badge>}
                    <Badge>{task.source === "ia" ? "Com IA" : "Pelas regras"}</Badge>
                  </div>
                  <AdaptedView content={content} highlight icons />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/planejamento/${id}/niveis/${task.id}/imprimir`} className={quietButtonCls}><Printer size={16} aria-hidden /> Imprimir<span className="sr-only">: {LEVEL_LABEL[task.level as LevelKey]}</span></Link>
                    <a href={`/api/atividades-adaptadas/${task.id}/word`} download className={quietButtonCls}><FileDown size={16} aria-hidden /> Word<span className="sr-only">: {LEVEL_LABEL[task.level as LevelKey]}</span></a>
                  </div>
                  {access.edit && task.status !== "aprovada" ? (
                    <details className="mt-4 rounded-2xl bg-surface-muted p-4">
                      <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Ajustar e aprovar: {LEVEL_LABEL[task.level as LevelKey]}</summary>
                      <div className="mt-4"><AdaptedEditor action={saveLevelTask.bind(null, id, task.id)} content={content} approveLabel="Aprovar este nível" /></div>
                    </details>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="max-w-3xl text-sm text-ink-soft">Nenhuma atividade com níveis ainda.{access.edit ? " Envie a atividade da turma acima." : ""}</p>
      )}
    </div>
  );
}
