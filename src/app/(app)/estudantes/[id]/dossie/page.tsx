import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, Scale, Users } from "lucide-react";
import { requireStudentPage } from "@/lib/page-context";
import { loadEvidence } from "@/lib/dossier";
import { visibleTabs } from "@/lib/student-tab-list";
import { PageHeader } from "@/components/ui";
import { DataBoard, StatTile } from "@/components/data-viz";
import { EvidenceList } from "@/components/dossier/evidence-list";
import { BUTTON_CLS } from "@/components/form-styles";
import { Assurances, HowToRead } from "@/components/explain";
import { FederalGuidance } from "@/components/federal-guidance";

export const dynamic = "force-dynamic";

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { can } = await requireStudentPage(id, "Dossiê de evidências");
  const [evidence] = await loadEvidence({ id });
  if (!evidence) notFound();
  const tabs = new Set(visibleTabs(can).map((tab) => tab.slug));
  const { ok, conferir, pendente } = evidence.summary;
  return (
    <>
      <PageHeader level={2}
        title="Dossiê de evidências"
        actions={<Link href={`/estudantes/${id}/dossie/imprimir`} className={BUTTON_CLS.secondary}><Printer size={16} aria-hidden /> Imprimir ou salvar em PDF</Link>}
      />
      <div className="grid min-w-0 max-w-3xl gap-6">
        <FederalGuidance />
        <div className="grid min-w-0 gap-2">
          <DataBoard className="sm:grid-cols-3">
            <StatTile label="Em dia" value={ok} />
            <StatTile label="Para conferir" value={conferir} />
            <StatTile label="Pendentes" value={pendente} />
          </DataBoard>
          <HowToRead>
            <p>Cada item é uma exigência do Decreto nº 12.686/2025 (com a redação do Decreto nº 12.773/2025), da Portaria MEC nº 421/2026 ou da orientação do INEP para o Censo Escolar, com a fonte ao lado.</p>
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
