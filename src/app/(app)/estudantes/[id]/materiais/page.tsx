import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { isAIEnabled } from "@/lib/agents/model";
import { isImageGenerationEnabled } from "@/lib/images/openai-images";
import { PageHeader, Card, SectionTitle, EmptyState } from "@/components/ui";
import { MaterialForm } from "@/components/materials/material-form";
import { MaterialView } from "@/components/materials/material-view";

export const dynamic = "force-dynamic";

// Materiais de apoio do estudante: a IA (ou as regras) cria a partir do perfil
// um material completo — cartões com pictogramas, como usar e atividades para
// aplicar — que fica como sugestão até a equipe aprovar.
export default async function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const team = isStaffOrNetwork(user.role) && canSeePedagogicalDetail(user.role);
  const [profile, materials, objectives] = await Promise.all([
    prisma.functionalProfile.findUnique({ where: { studentId: id }, select: { id: true } }),
    prisma.material.findMany({
      where: { studentId: id },
      orderBy: { createdAt: "desc" },
      include: { images: { select: { cardIndex: true, altText: true, createdAt: true } } },
    }),
    prisma.objective.findMany({ where: { plan: { studentId: id, status: "ativo" } }, select: { id: true, description: true, status: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const objectiveText = new Map(objectives.map((objective) => [objective.id, objective.description]));
  const linkedIds = materials.map((material) => material.objectiveId).filter((value): value is string => Boolean(value) && !objectiveText.has(value!));
  if (linkedIds.length) {
    for (const objective of await prisma.objective.findMany({ where: { id: { in: linkedIds }, plan: { studentId: id } }, select: { id: true, description: true } })) objectiveText.set(objective.id, objective.description);
  }
  const imagesOn = isImageGenerationEnabled();
  const defaultContext = user.role === "professor_sala" ? "sala_comum" : "aee";

  return (
    <>
      <PageHeader
        title="Materiais de apoio"
        lede="Materiais feitos para este estudante, a partir de como ele aprende: cartões com pictogramas, orientações e atividades para aplicar na sala, no AEE e em casa."
      />

      {team ? (
        <Card className="mb-8 max-w-4xl print:hidden">
          <SectionTitle>Criar um material</SectionTitle>
          {!profile ? (
            <p className="text-sm leading-relaxed text-ink-soft">
              Primeiro, conte como o estudante aprende. É dali que saem os cartões, as adaptações e as atividades.{" "}
              <Link href={`/estudantes/${id}/perfil`} className="font-medium text-brand-strong underline underline-offset-4">Preencher Como aprende</Link>
            </p>
          ) : (
            <MaterialForm
              studentId={id}
              objectives={objectives.filter((objective) => objective.status === "ativo").map(({ id: objectiveId, description }) => ({ id: objectiveId, description }))}
              defaultContext={defaultContext}
              aiOn={isAIEnabled()}
              imagesOn={imagesOn}
            />
          )}
        </Card>
      ) : null}

      {materials.length === 0 ? (
        <EmptyState title="Os materiais aparecerão aqui" hint={profile ? "Escolha o tipo e a situação acima e toque em Criar material." : "Preencha Como aprende para começar a criar materiais para este estudante."} />
      ) : (
        <section aria-labelledby="materiais-lista" className="min-w-0">
          <h2 id="materiais-lista" className="mb-4 font-display text-xl font-medium text-ink print:hidden">Materiais deste estudante ({materials.length})</h2>
          <div className="grid min-w-0 gap-6">
            {materials.map((material) => (
              <MaterialView
                key={material.id}
                studentId={id}
                material={material}
                objective={material.objectiveId ? objectiveText.get(material.objectiveId) ?? null : null}
                imagesOn={imagesOn}
                canEdit={team}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
