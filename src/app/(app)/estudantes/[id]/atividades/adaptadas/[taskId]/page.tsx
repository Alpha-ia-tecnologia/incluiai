import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, FileDown, Printer, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canEditStudentRecord, requireStudentPage } from "@/lib/auth";
import { taskContent } from "@/lib/adapted-tasks";
import { printSettings } from "@/lib/task-adaptation";
import { parseJson, formatDate } from "@/lib/format";
import { removeStudentTask, saveStudentTask } from "@/actions/adapted-tasks";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { BnccTag } from "@/components/bncc-tag";
import { AdaptedView } from "@/components/adapted/adapted-view";
import { AdaptedEditor } from "@/components/adapted/adapted-editor";
import { dangerButtonCls, linkCls, quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

export default async function AdaptedTaskPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const user = await requireStudentPage(id, "Atividade adaptada");
  const task = await prisma.adaptedTask.findFirst({ where: { id: taskId, studentId: id } });
  if (!task) notFound();
  const content = taskContent(task.content, task.title);
  const options = parseJson<string[]>(task.options, []);
  const editing = task.status !== "aprovada" && canEditStudentRecord(user.role);
  const view = { highlight: options.includes("destacar_comando"), icons: options.includes("apoio_visual") };
  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/estudantes/${id}/atividades`} className={`inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Atividades</Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/estudantes/${id}/atividades/adaptadas/${task.id}/imprimir`} className={quietButtonCls}><Printer size={16} aria-hidden /> Imprimir ou salvar em PDF</Link>
          <a href={`/api/atividades-adaptadas/${task.id}/word`} download className={quietButtonCls}><FileDown size={16} aria-hidden /> Baixar em Word</a>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{task.kind === "prova" ? "Prova adaptada" : "Atividade adaptada"}</Badge>
        {task.status === "aprovada" ? <Badge tone="green"><CircleCheck size={12} aria-hidden /> Aprovada por {task.approvedBy} em {formatDate(task.approvedAt!)}</Badge> : <Badge tone="amber">Rascunho: revise antes de usar</Badge>}
        <Badge>{task.source === "ia" ? "Adaptada com IA" : "Adaptada pelas regras"}</Badge>
        {task.bnccCode ? <BnccTag code={task.bnccCode} /> : null}
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <SectionTitle>Original da turma</SectionTitle>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink">{task.sourceText}</p>
        </Card>
        <Card className="min-w-0">
          <SectionTitle>Versão adaptada</SectionTitle>
          <AdaptedView content={content} {...view} />
        </Card>
      </div>
      {content.teacherNotes.length || content.preserved ? (
        <Card className="max-w-3xl">
          <SectionTitle>O que mudou e o que continua igual</SectionTitle>
          {content.teacherNotes.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-ink">{content.teacherNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
          {content.preserved ? <p className="mt-3 text-sm text-ink-soft"><span className="font-medium text-ink">Continua igual:</span> {content.preserved}</p> : null}
        </Card>
      ) : null}
      {editing ? (
        <Card className="max-w-3xl">
          <SectionTitle>Ajustar antes de aprovar</SectionTitle>
          <AdaptedEditor action={saveStudentTask.bind(null, id, task.id)} content={content} />
          <details className="mt-6 rounded-2xl bg-surface-muted p-4">
            <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Excluir esta adaptação</summary>
            <form action={removeStudentTask.bind(null, id, task.id)} className="mt-3">
              <button type="submit" className={dangerButtonCls}><Trash2 size={16} aria-hidden /> Excluir</button>
            </form>
          </details>
        </Card>
      ) : null}
      <p className="text-xs text-ink-soft print:hidden">Impressão: {printSettings(options).largeText ? "letra ampliada" : "letra normal"}{printSettings(options).itemsPerPage ? `, até ${printSettings(options).itemsPerPage} questões por página` : ""}.</p>
    </div>
  );
}
