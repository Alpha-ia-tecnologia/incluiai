import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Printer } from "lucide-react";
import { canEditStudentRecord, canSeePedagogicalDetail, isStaffOrNetwork, requireStudentPage } from "@/lib/auth";
import { loadEvidence } from "@/lib/dossier";
import { visibleTabs } from "@/lib/student-tab-list";
import { PageHeader } from "@/components/ui";
import { DataBoard, StatTile } from "@/components/data-viz";
import { EvidenceList } from "@/components/dossier/evidence-list";
import { secondaryButtonCls } from "@/components/form-styles";

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
        lede="O que o Decreto nº 12.686/2025 e a Portaria MEC nº 421/2026 pedem, item por item: se o registro está na plataforma e onde encontrá-lo."
        actions={<Link href={`/estudantes/${id}/dossie/imprimir`} className={secondaryButtonCls}><Printer size={16} aria-hidden /> Imprimir ou salvar em PDF</Link>}
      />
      <div className="grid min-w-0 max-w-3xl gap-6">
        <DataBoard className="sm:grid-cols-3">
          <StatTile label="Em dia" value={ok} />
          <StatTile label="Para conferir" value={conferir} hint="Registro incompleto ou prazo vencido." />
          <StatTile label="Pendentes" value={pendente} hint="O registro ainda não existe." />
        </DataBoard>
        <EvidenceList groups={evidence.groups} studentId={id} tabs={tabs} />
        <p className="text-xs leading-relaxed text-ink-soft">O dossiê aponta onde está cada registro. Ele não substitui a análise da equipe nem um parecer jurídico.</p>
      </div>
    </>
  );
}
