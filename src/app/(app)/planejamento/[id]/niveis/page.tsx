import Link from "next/link";
import { CircleCheck, EyeOff, FileDown, Printer, Target } from "lucide-react";
import { db } from "@/lib/prisma";
import { planningContext } from "@/lib/page-context";
import { canReadFiles, isAIEnabled } from "@/lib/agents/capabilities";
import { taskContent } from "@/lib/adapted-tasks";
import { LEVEL_LABEL, type LevelKey } from "@/lib/adapted-tasks-core";
import { formatDate } from "@/lib/dates";
import { adaptTask, saveTask } from "@/actions/adapted-tasks";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { AdaptForm } from "@/components/adapted/adapt-form";
import { AdaptedView } from "@/components/adapted/adapted-view";
import { AdaptedEditor } from "@/components/adapted/adapted-editor";
import { BUTTON_CLS } from "@/components/form-styles";
import { Assurances } from "@/components/explain";
import { ADAPTED_TASK_STATUS, labelOf, toneOf } from "@/lib/scale";
import { levelsHref, readLevelsBatch, type SearchParams } from "@/lib/search-params";

const ORDER: LevelKey[] = ["mais_apoio", "padrao", "desafio"];

export default async function LevelsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const prisma = await db();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { access } = await planningContext(id);
  const tasks = await prisma.adaptedTask.findMany({ where: { planningId: id }, orderBy: { createdAt: "desc" } });
  const batches = [...new Map(tasks.map((task) => [task.batchId, task])).values()];
  const wanted = readLevelsBatch(query);
  const batchId = batches.some((task) => task.batchId === wanted) ? wanted : batches[0]?.batchId;
  const current = ORDER.map((level) => tasks.find((task) => task.batchId === batchId && task.level === level)).filter((task) => task !== undefined);

  return (
    <div className="grid min-w-0 gap-8">
      <section aria-labelledby="niveis-titulo" className="max-w-3xl min-w-0">
        <h2 id="niveis-titulo" className="mb-3 font-display text-xl font-medium text-ink">A mesma atividade em três níveis</h2>
        <Assurances
          label="O que os três níveis mantêm"
          items={[
            { icon: Target, text: "Mesmo objetivo e habilidade da BNCC" },
            { icon: EyeOff, text: "A folha não mostra o nível" },
          ]}
        />
      </section>

      {access.edit ? (
        <Card className="min-w-0">
          <SectionTitle>Gerar os níveis de uma atividade</SectionTitle>
          <AdaptForm action={adaptTask.bind(null, { planningId: id })} canRead={canReadFiles()} aiOn={isAIEnabled()} showOptions={false} adaptLabel="Gerar os três níveis" />
        </Card>
      ) : null}

      {batches.length > 1 ? (
        <nav aria-label="Atividades com níveis" className="flex min-w-0 flex-wrap gap-2">
          {batches.map((task) => (
            <Link key={task.batchId} href={levelsHref(id, task.batchId)} aria-current={task.batchId === batchId ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm ${task.batchId === batchId ? "bg-brand font-medium text-white" : "bg-surface-muted text-ink-soft hover:bg-line"}`}>
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
                    <Badge tone="info">{LEVEL_LABEL[task.level as LevelKey] ?? task.level}</Badge>
                    <Badge tone={toneOf(ADAPTED_TASK_STATUS, task.status)}>{task.status === "aprovada" ? <CircleCheck size={12} aria-hidden /> : null} {labelOf(ADAPTED_TASK_STATUS, task.status)}</Badge>
                    <Badge>{task.source === "ia" ? "Com IA" : "Pelas regras"}</Badge>
                  </div>
                  <AdaptedView content={content} highlight icons />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/planejamento/${id}/niveis/${task.id}/imprimir`} className={BUTTON_CLS.quiet}><Printer size={16} aria-hidden /> Imprimir<span className="sr-only">: {LEVEL_LABEL[task.level as LevelKey]}</span></Link>
                    <a href={`/api/atividades-adaptadas/${task.id}/word`} download className={BUTTON_CLS.quiet}><FileDown size={16} aria-hidden /> Word<span className="sr-only">: {LEVEL_LABEL[task.level as LevelKey]}</span></a>
                  </div>
                  {access.edit && task.status !== "aprovada" ? (
                    <details className="mt-4 rounded-2xl bg-surface-muted p-4">
                      <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Ajustar e aprovar: {LEVEL_LABEL[task.level as LevelKey]}</summary>
                      <div className="mt-4"><AdaptedEditor action={saveTask.bind(null, { planningId: id }, task.id)} content={content} approveLabel="Aprovar este nível" /></div>
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
