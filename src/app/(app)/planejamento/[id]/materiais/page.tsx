import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Printer } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { DuaError } from "@/lib/dua/shared";
import { loadPlanning } from "@/lib/dua/plannings";
import { libraryOptions, listMaterials } from "@/lib/dua/materials";
import { listSupports } from "@/lib/dua/supports";
import { REVIEW_STATE_LABEL } from "@/lib/dua/domain";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { ReviewBadge, secondaryCls } from "@/components/dua/dua-ui";
import { NewMaterialForm } from "@/components/dua/materials/new-material-form";
import { ValidateMaterialButton } from "@/components/dua/materials/validate-material-button";
import { MaterialMetaList, materialMeta } from "@/components/dua/materials/material-meta";

export const dynamic = "force-dynamic";

const shorten = (value: string, max = 80) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

// Materiais vinculados à atividade (RF06): cada um com versão de origem,
// finalidade, formato e acessibilidade, escopo, autoria, participação de IA e revisão.
export default async function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let data;
  try {
    const loaded = await loadPlanning(user, id);
    const [materials, supports, library] = await Promise.all([listMaterials(user, id), listSupports(user, id), libraryOptions()]);
    data = { ...loaded, materials, supports, library };
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const { planning, access, versions, materials, supports, library } = data;
  const editableSupports = supports.filter((item) => item.canEdit).map((item) => ({ id: item.id, label: `${item.student.name} — ${shorten(item.data?.support || "apoio sem descrição")}` }));
  const canCreate = access.edit || editableSupports.length > 0;
  const versionState = new Map(versions.map((item) => [item.version, item.state]));
  const defaultVersion = versions.find((item) => item.state === "validado")?.version ?? versions[0]?.version ?? 1;

  return (
    <div className="grid min-w-0 gap-8">
      <section aria-labelledby="materiais-titulo" className="max-w-3xl min-w-0">
        <h2 id="materiais-titulo" className="mb-2 font-display text-xl font-medium text-ink">Materiais da atividade</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Prepare roteiros e apoios em texto selecionável a partir de uma versão do planejamento. Material de versão não validada sai como rascunho e é impresso com o aviso de RASCUNHO.
          Antes de usar com os estudantes, confira o conteúdo e valide.
        </p>
      </section>

      {canCreate ? (
        <Card className="min-w-0">
          <SectionTitle>Preparar um material</SectionTitle>
          <NewMaterialForm
            planningId={planning.id}
            versions={versions.map((item) => ({ version: item.version, state: item.state }))}
            defaultVersion={defaultVersion}
            canCollective={access.edit}
            supports={editableSupports}
            library={library.map((item) => ({ id: item.id, label: item.title }))}
          />
        </Card>
      ) : (
        <p className="max-w-3xl text-sm text-ink-soft">Só quem edita o planejamento, ou responde por um apoio individual, prepara materiais. Você pode abrir e imprimir os que já existem.</p>
      )}

      <section aria-labelledby="lista-materiais-titulo" className="min-w-0">
        <h2 id="lista-materiais-titulo" className="mb-4 font-display text-xl font-medium text-ink">Materiais preparados ({materials.length})</h2>
        {materials.length ? (
          <ul className="grid min-w-0 gap-4">
            {materials.map((material) => {
              const state = versionState.get(material.versionNumber);
              return (
                <li key={material.id} className="min-w-0">
                  <Card className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 break-words text-base font-medium text-ink">{material.title}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        <ReviewBadge state={material.state} />
                        <Badge tone={material.scope === "individual" ? "brand" : "neutral"}>{material.scope === "individual" ? "Individual" : "Coletivo"}</Badge>
                      </div>
                    </div>
                    <MaterialMetaList className="mt-2" items={materialMeta(material, { versionState: state ? REVIEW_STATE_LABEL[state].toLowerCase() : undefined })} />
                    {material.state !== "validado" && state && state !== "validado" ? (
                      <p className="mt-3 text-sm text-ink-soft">A versão {material.versionNumber} ainda não foi validada: valide o planejamento antes de validar este material.</p>
                    ) : null}
                    <div className="mt-4 flex min-w-0 flex-wrap items-start gap-2">
                      <Link href={`/planejamento/${planning.id}/materiais/${material.id}`} className={secondaryCls}>
                        <Printer size={16} aria-hidden /> Abrir para imprimir<span className="sr-only">: {material.title}</span>
                      </Link>
                      {material.state !== "validado" && material.canValidate ? (
                        <ValidateMaterialButton planningId={planning.id} materialId={material.id} revision={material.revision} title={material.title} />
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState character="ideas" title="Nenhum material preparado" hint={canCreate ? "Escolha a versão, o formato e a finalidade no formulário acima." : "Quando a equipe preparar materiais, eles aparecem aqui."} />
        )}
      </section>
    </div>
  );
}
