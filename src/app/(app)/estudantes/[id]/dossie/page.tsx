import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Printer, Scale, Users } from "lucide-react";
import { canEditStudentRecord, canSeePedagogicalDetail, isStaffOrNetwork, requireStudentPage } from "@/lib/auth";
import { loadEvidence } from "@/lib/dossier";
import { visibleTabs } from "@/lib/student-tab-list";
import { PageHeader } from "@/components/ui";
import { DataBoard, StatTile } from "@/components/data-viz";
import { EvidenceList } from "@/components/dossier/evidence-list";
import { secondaryButtonCls } from "@/components/form-styles";
import { Assurances, HowToRead } from "@/components/explain";

export const dynamic = "force-dynamic";

// Dossiê de evidências (item 8 do plano): cada exigência das normas, se o
// registro está na plataforma e onde, para a equipe se preparar e a rede conferir.
export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudentPage(id, "Dossiê de evidências");
  if (!canSeePedagogicalDetail(user.role) || !isStaffOrNetwork(user.role)) redirect(`/estudantes/${id}`);
  const [evidence] = await loadEvidence({ id });
  if (!evidence) notFound();
  const tabs = new Set(visibleTabs({ showCaseStudy: true, readOnly: !canEditStudentRecord(user.role) }).map((tab) => tab.slug));
  const { ok, conferir, pendente } = evidence.summary;
  return (
    <>
      <PageHeader level={2}
        title="Dossiê de evidências"
        actions={<Link href={`/estudantes/${id}/dossie/imprimir`} className={secondaryButtonCls}><Printer size={16} aria-hidden /> Imprimir ou salvar em PDF</Link>}
      />
      <div className="grid min-w-0 max-w-3xl gap-6">
        <div className="grid min-w-0 gap-2">
          <DataBoard className="sm:grid-cols-3">
            <StatTile label="Em dia" value={ok} />
            <StatTile label="Para conferir" value={conferir} />
            <StatTile label="Pendentes" value={pendente} />
          </DataBoard>
          <HowToRead>
            <p>Cada item é uma exigência do Decreto nº 12.686/2025 (com a redação do Decreto nº 12.773/2025) ou da Portaria MEC nº 421/2026, com o artigo ao lado.</p>
            <dl className="mt-2 grid gap-1">
              <div><dt className="inline font-medium text-ink">Em dia: </dt><dd className="inline">o registro está na plataforma e no prazo.</dd></div>
              <div><dt className="inline font-medium text-ink">Conferir: </dt><dd className="inline">registro incompleto ou prazo vencido.</dd></div>
              <div><dt className="inline font-medium text-ink">Pendente: </dt><dd className="inline">o registro ainda não existe.</dd></div>
              <div><dt className="inline font-medium text-ink">Informação: </dt><dd className="inline">não entra na conta.</dd></div>
            </dl>
          </HowToRead>
        </div>
        <EvidenceList groups={evidence.groups} studentId={id} tabs={tabs} />
        <Assurances
          label="Limites do dossiê"
          items={[
            { icon: Users, text: "Não substitui a análise da equipe" },
            { icon: Scale, text: "Não é parecer jurídico" },
          ]}
        />
      </div>
    </>
  );
}
