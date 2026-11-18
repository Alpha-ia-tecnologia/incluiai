import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/prisma";
import { planningContext } from "@/lib/page-context";
import { taskContent } from "@/lib/adapted-tasks";
import { PrintButton } from "@/components/print-button";
import { AdaptedView } from "@/components/adapted/adapted-view";

export default async function PrintLevelPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const prisma = await db();
  const { id, taskId } = await params;
  await planningContext(id);
  const task = await prisma.adaptedTask.findFirst({ where: { id: taskId, planningId: id } });
  if (!task) notFound();
  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/planejamento/${id}/niveis?lote=${task.batchId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Voltar para os níveis</Link>
        <PrintButton label="Imprimir ou salvar em PDF" />
      </div>
      {task.status !== "aprovada" ? <p className="mb-4 rounded-xl border-2 border-amber px-3 py-2 text-sm font-medium text-amber">RASCUNHO: ainda não aprovada pela equipe.</p> : null}
      <AdaptedView content={taskContent(task.content, task.title)} highlight icons forStudent />
    </div>
  );
}
