import Link from "next/link";
import { studentAI } from "@/lib/agents/capabilities";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { MaterialView } from "@/components/materials/material-view";
import { CreatedNotice } from "@/components/created-notice";

type Query = { criado?: string | string[]; imagens?: string | string[]; falhas?: string | string[] };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function MaterialPage({ params, searchParams }: { params: Promise<{ id: string; materialId: string }>; searchParams: Promise<Query> }) {
  const prisma = await db();
  const [{ id, materialId }, query] = await Promise.all([params, searchParams]);
  const { can } = await requireStudentPage(id, "Material de apoio");
  const material = await prisma.material.findFirst({
    where: { id: materialId, studentId: id },
    include: { images: { select: { cardIndex: true, altText: true, createdAt: true } } },
  });
  if (!material) notFound();
  const team = can.edit;
  const imagesOn = (await studentAI(id)).images;
  const objective = material.objectiveId
    ? await prisma.objective.findFirst({ where: { id: material.objectiveId, plan: { studentId: id } }, select: { description: true } })
    : null;

  const created = one(query.criado);
  const imageCount = Number.parseInt(one(query.imagens), 10);
  const notice = created === "ia" || created === "regras"
    ? [
        `Material criado ${created === "ia" ? "pelos agentes de IA" : "pelas regras da plataforma"}.`,
        material.status === "aprovado" ? "" : "Revise e aprove antes de usar.",
        Number.isFinite(imageCount) && imageCount >= 0 ? `${imageCount} ${imageCount === 1 ? "imagem pronta" : "imagens prontas"}.` : "",
        one(query.falhas) === "1" ? (team && imagesOn ? "Algumas imagens não saíram agora: toque em Desenhar para tentar de novo." : "Algumas imagens não saíram agora.") : "",
      ].filter(Boolean).join(" ")
    : null;

  return (
    <>
      <Link href={`/estudantes/${id}/materiais#material-${material.id}`} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline print:hidden">
        <ArrowLeft size={16} aria-hidden /> Voltar para os materiais
      </Link>
      {notice ? <CreatedNotice>{notice}</CreatedNotice> : null}
      <MaterialView studentId={id} material={material} objective={objective?.description ?? null} imagesOn={imagesOn} canEdit={team} />
    </>
  );
}
