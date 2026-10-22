import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser } from "@/lib/auth";
import { MaterialView } from "@/components/materials/material-view";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// Leitura de um material no portal da família: os cartões, como usar e a dica
// para casa, sem as ações da equipe. Só material aprovado pela equipe chega
// aqui (a IA propõe; a equipe revisa antes de a família usar).
export default async function FamilyMaterialPage({ params }: { params: Promise<{ id: string; materialId: string }> }) {
  const { id, materialId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "terapeuta") redirect("/terapeuta");
  const material = await prisma.material.findFirst({
    where: { id: materialId, studentId: id, status: "aprovado" },
    include: { images: { select: { cardIndex: true, altText: true, createdAt: true } }, student: { select: { schoolId: true } } },
  });
  if (!material) notFound();
  if (!canAccessStudent(user, material.student.schoolId, id)) redirect("/");
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
      {/* O título do material é h2 no componente; a página tem o seu h1. */}
      <h1 className="mb-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink">Material de apoio para casa</h1>
      <MaterialView studentId={id} material={material} objective={objective?.description ?? null} imagesOn={false} canEdit={false} printHref={null} />
    </>
  );
}
