import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { isImageGenerationEnabled } from "@/lib/images/openai-images";
import { MaterialView } from "@/components/materials/material-view";
import { CreatedNotice } from "@/components/materials/created-notice";

export const dynamic = "force-dynamic";

type Query = { criado?: string | string[]; imagens?: string | string[]; falhas?: string | string[] };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

// Página de um material: o material inteiro, com as ações da equipe (aprovar,
// desenhar imagens, levar atividade, imprimir e excluir). Mesma regra da
// galeria: a equipe pedagógica edita; família e terapeuta só leem.
export default async function MaterialPage({ params, searchParams }: { params: Promise<{ id: string; materialId: string }>; searchParams: Promise<Query> }) {
  const [{ id, materialId }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Só material DESTE estudante: o id do material sozinho não basta.
  const material = await prisma.material.findFirst({
    where: { id: materialId, studentId: id },
    include: { images: { select: { cardIndex: true, altText: true, createdAt: true } }, student: { select: { schoolId: true } } },
  });
  if (!material) notFound();
  // O layout do estudante já confere o acesso; a página confere de novo, perto dos dados.
  if (!canAccessStudent(user, material.student.schoolId, id)) redirect("/");
  const team = isStaffOrNetwork(user.role) && canSeePedagogicalDetail(user.role);
  const imagesOn = isImageGenerationEnabled();
  const objective = material.objectiveId
    ? await prisma.objective.findFirst({ where: { id: material.objectiveId, plan: { studentId: id } }, select: { description: true } })
    : null;

  // Aviso de criado (vem do redirect de generateMaterial): o texto sai daqui,
  // não da URL, que só diz como foi feito e quantas imagens saíram.
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
