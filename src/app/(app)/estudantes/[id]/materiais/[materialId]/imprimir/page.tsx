import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { PrintButton } from "@/components/print-button";
import { MaterialView } from "@/components/materials/material-view";

export default async function PrintMaterialPage({ params }: { params: Promise<{ id: string; materialId: string }> }) {
  const prisma = await db();
  const { id, materialId } = await params;
  await requireStudentPage(id, "Impressão de material");
  const material = await prisma.material.findFirst({
    where: { id: materialId, studentId: id },
    include: { images: { select: { cardIndex: true, altText: true, createdAt: true } } },
  });
  if (!material) notFound();
  const objective = material.objectiveId
    ? await prisma.objective.findFirst({ where: { id: material.objectiveId, plan: { studentId: id } }, select: { description: true } })
    : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/estudantes/${id}/materiais/${material.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline">
          <ArrowLeft size={16} aria-hidden /> Voltar para o material
        </Link>
        <PrintButton label="Imprimir este material" />
      </div>
      <MaterialView studentId={id} material={material} objective={objective?.description ?? null} imagesOn={false} printMode />
    </>
  );
}
