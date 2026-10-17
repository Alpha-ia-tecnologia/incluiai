import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { DuaError } from "@/lib/dua/shared";
import { getMaterial, type MaterialView } from "@/lib/dua/materials";
import { DRAFT_NOTICE } from "@/lib/dua/domain";
import { PrintButton } from "@/components/print-button";
import { MaterialMetaList, materialMeta } from "@/components/dua/materials/material-meta";

export const dynamic = "force-dynamic";

// Material para ler e imprimir: texto selecionável, estrutura de leitura simples
// (título, dados do material e seções com listas). Sem validação, o aviso de
// RASCUNHO aparece na tela e no papel.
export default async function MaterialPrintPage({ params }: { params: Promise<{ id: string; materialId: string }> }) {
  const { id, materialId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let material: MaterialView;
  try {
    material = await getMaterial(user, materialId);
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  if (material.planningId !== id) notFound();
  const draft = material.state !== "validado";
  const large = material.format === "fonte_ampliada";
  const notice = (
    <p className="rounded-xl border-2 border-current bg-amber-soft px-4 py-3 text-base font-semibold leading-snug text-amber-900">
      {DRAFT_NOTICE}
    </p>
  );

  return (
    <article className="mx-auto min-w-0 max-w-3xl print:max-w-none">
      <div className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/planejamento/${id}/materiais`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline">
          <ArrowLeft size={16} aria-hidden /> Voltar para os materiais
        </Link>
        <PrintButton label="Imprimir material" />
      </div>

      {draft ? <div role="note" aria-label="Aviso de rascunho" className="mb-6">{notice}</div> : null}

      <h1 className="break-words font-display text-2xl font-medium leading-tight text-ink sm:text-3xl">{material.title}</h1>

      <section aria-label="Dados do material" className="mt-4 rounded-xl border border-line p-4 print:break-inside-avoid">
        <MaterialMetaList items={materialMeta(material, { withActivity: true })} />
      </section>

      <div className={`mt-8 grid min-w-0 gap-8 ${large ? "text-xl leading-loose" : "text-base leading-relaxed"}`}>
        {material.sections.map((section, index) => (
          <section key={`${section.heading}-${index}`} className="min-w-0 print:break-inside-avoid">
            <h2 className={`break-words font-display font-medium text-ink ${large ? "text-2xl" : "text-xl"}`}>{section.heading}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-ink">
              {section.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`} className="break-words">{item}</li>)}
            </ul>
          </section>
        ))}
      </div>

      {draft ? <div className="mt-10 print:break-inside-avoid">{notice}</div> : null}
    </article>
  );
}
