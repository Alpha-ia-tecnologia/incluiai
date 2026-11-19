import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/prisma";
import { requireFamilyPortal } from "@/lib/page-context";
import { familyMaterialWhere } from "@/lib/policy";
import { MaterialView } from "@/components/materials/material-view";
import { PrintButton } from "@/components/print-button";
import { parseJson } from "@/lib/format";
import { withoutCodes, withoutCodesDeep } from "@/lib/without-codes";

export default async function FamilyMaterialPage({ params }: { params: Promise<{ id: string; materialId: string }> }) {
  const prisma = await db();
  const { id, materialId } = await params;
  await requireFamilyPortal(id, "Material de apoio (portal da família)");
  const material = await prisma.material.findFirst({
    where: { id: materialId, studentId: id, ...familyMaterialWhere },
    include: { images: { select: { cardIndex: true, altText: true, createdAt: true } } },
  });
  if (!material) notFound();
  const objective = material.objectiveId
    ? await prisma.objective.findFirst({ where: { id: material.objectiveId, plan: { studentId: id } }, select: { description: true } })
    : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/familia/${id}#materiais`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline">
          <ArrowLeft size={16} aria-hidden /> Voltar para o acompanhamento
        </Link>
        <PrintButton label="Imprimir material" />
      </div>
      <h1 className="mb-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink">Material de apoio para casa</h1>
      <MaterialView
        studentId={id}
        material={{ ...material, title: withoutCodes(material.title), content: JSON.stringify(withoutCodesDeep(parseJson<unknown>(material.content, {}))) }}
        objective={objective ? withoutCodes(objective.description) : null}
        imagesOn={false}
        canEdit={false}
        printHref={null}
      />
    </>
  );
}
