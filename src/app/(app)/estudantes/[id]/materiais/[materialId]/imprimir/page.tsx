import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireStudentPage } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { MaterialView } from "@/components/materials/material-view";

export const dynamic = "force-dynamic";

// Versão para imprimir: cartões grandes com linha de recorte, atividades em outra
// página e a marca de SUGESTÃO enquanto a equipe não aprovar o material.
// O acesso ao estudante já foi conferido no layout do estudante.
export default async function PrintMaterialPage({ params }: { params: Promise<{ id: string; materialId: string }> }) {
  const { id, materialId } = await params;
  await requireStudentPage(id, "Impressão de material");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
