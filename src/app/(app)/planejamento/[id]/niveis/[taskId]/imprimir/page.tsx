import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DuaError, loadPlanningFor } from "@/lib/dua/shared";
import { taskContent } from "@/lib/adapted-tasks";
import { PrintButton } from "@/components/print-button";
import { AdaptedView } from "@/components/adapted/adapted-view";

export const dynamic = "force-dynamic";

// Folha de um nível, para o estudante: sem o nome do nível e sem o apoio do professor.
export default async function PrintLevelPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    await loadPlanningFor(user, id, "read");
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const task = await prisma.adaptedTask.findFirst({ where: { id: taskId, planningId: id } });
  if (!task) notFound();
  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/planejamento/${id}/niveis?lote=${task.batchId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Voltar para os níveis</Link>
        <PrintButton label="Imprimir ou salvar em PDF" />
      </div>
      {task.status !== "aprovada" ? <p className="mb-4 rounded-xl border-2 border-amber-800 px-3 py-2 text-sm font-medium text-amber-900">RASCUNHO: ainda não aprovada pela equipe.</p> : null}
      <AdaptedView content={taskContent(task.content, task.title)} highlight icons forStudent />
    </div>
  );
}
