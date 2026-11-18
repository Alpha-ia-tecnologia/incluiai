import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, FileDown, Printer, Trash2 } from "lucide-react";
import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { taskContent } from "@/lib/adapted-tasks";
import { printSettings } from "@/lib/adapted-tasks-core";
import { readList } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { removeStudentTask, saveTask } from "@/actions/adapted-tasks";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { BnccTag } from "@/components/bncc-tag";
import { AdaptedView } from "@/components/adapted/adapted-view";
import { AdaptedEditor } from "@/components/adapted/adapted-editor";
import { ActionForm } from "@/components/action-form";
import { BUTTON_CLS, linkCls } from "@/components/form-styles";
import { ADAPTED_TASK_STATUS, toneOf } from "@/lib/scale";

export default async function AdaptedTaskPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const prisma = await db();
  const { id, taskId } = await params;
  const { can } = await requireStudentPage(id, "Atividade adaptada");
  const task = await prisma.adaptedTask.findFirst({ where: { id: taskId, studentId: id } });
  if (!task) notFound();
  const content = taskContent(task.content, task.title);
  const options = readList(task.options);
  const editing = task.status !== "aprovada" && can.edit;
  const view = { highlight: options.includes("destacar_comando"), icons: options.includes("apoio_visual") };
  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/estudantes/${id}/atividades`} className={`inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Atividades</Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/estudantes/${id}/atividades/adaptadas/${task.id}/imprimir`} className={BUTTON_CLS.quiet}><Printer size={16} aria-hidden /> Imprimir ou salvar em PDF</Link>
          <a href={`/api/atividades-adaptadas/${task.id}/word`} download className={BUTTON_CLS.quiet}><FileDown size={16} aria-hidden /> Baixar em Word</a>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{task.kind === "prova" ? "Prova adaptada" : "Atividade adaptada"}</Badge>
        <Badge tone={toneOf(ADAPTED_TASK_STATUS, task.status)}>{task.status === "aprovada" ? <><CircleCheck size={12} aria-hidden /> {ADAPTED_TASK_STATUS.aprovada.label} por {task.approvedBy} em {formatDate(task.approvedAt!)}</> : `${ADAPTED_TASK_STATUS.rascunho.label}: revise antes de usar`}</Badge>
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
          <AdaptedEditor action={saveTask.bind(null, { studentId: id }, task.id)} content={content} />
          <details className="mt-6 rounded-2xl bg-surface-muted p-4">
            <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Excluir esta adaptação</summary>
            <ActionForm action={removeStudentTask.bind(null, id, task.id)} className="mt-3">
              <button type="submit" className={BUTTON_CLS.danger}><Trash2 size={16} aria-hidden /> Excluir</button>
            </ActionForm>
          </details>
        </Card>
      ) : null}
      <p className="text-xs text-ink-soft print:hidden">Impressão: {printSettings(options).largeText ? "letra ampliada" : "letra normal"}{printSettings(options).itemsPerPage ? `, até ${printSettings(options).itemsPerPage} questões por página` : ""}.</p>
    </div>
  );
}
