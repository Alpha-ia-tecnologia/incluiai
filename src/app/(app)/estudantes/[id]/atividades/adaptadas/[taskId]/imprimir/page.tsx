import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/auth";
import { taskContent } from "@/lib/adapted-tasks";
import { printSettings } from "@/lib/task-adaptation";
import { parseJson } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { AdaptedView } from "@/components/adapted/adapted-view";

export const dynamic = "force-dynamic";

// Folha para o estudante: sem o apoio do professor, com a letra e as páginas pedidas.
export default async function PrintAdaptedTaskPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  await requireStudentPage(id, "Impressão de atividade adaptada");
  const task = await prisma.adaptedTask.findFirst({ where: { id: taskId, studentId: id } });
  if (!task) notFound();
  const options = parseJson<string[]>(task.options, []);
  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/estudantes/${id}/atividades/adaptadas/${task.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Voltar para a atividade</Link>
        <PrintButton label="Imprimir ou salvar em PDF" />
      </div>
      {task.status !== "aprovada" ? <p className="mb-4 rounded-xl border-2 border-amber-800 px-3 py-2 text-sm font-medium text-amber-900">RASCUNHO: ainda não aprovada pela equipe.</p> : null}
      <AdaptedView content={taskContent(task.content, task.title)} highlight={options.includes("destacar_comando")} icons={options.includes("apoio_visual")} {...printSettings(options)} forStudent />
    </div>
  );
}
