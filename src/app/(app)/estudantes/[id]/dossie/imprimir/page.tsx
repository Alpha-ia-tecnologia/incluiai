import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { canSeePedagogicalDetail, isStaffOrNetwork, requireStudentPage } from "@/lib/auth";
import { loadEvidence } from "@/lib/dossier";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { EvidenceList } from "@/components/dossier/evidence-list";
import { FEDERAL_SOURCE_LINE } from "@/lib/federal-guidance";

export const dynamic = "force-dynamic";

export default async function PrintDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudentPage(id, "Impressão do dossiê de evidências");
  if (!canSeePedagogicalDetail(user.role) || !isStaffOrNetwork(user.role)) redirect(`/estudantes/${id}`);
  const [evidence] = await loadEvidence({ id });
  if (!evidence) notFound();
  const { ok, conferir, pendente } = evidence.summary;
  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/estudantes/${id}/dossie`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Voltar para o dossiê</Link>
        <PrintButton label="Imprimir ou salvar em PDF" />
      </div>
      <article aria-labelledby="dossie-titulo" className="grid min-w-0 gap-6">
        <header className="min-w-0">
          <p className="text-sm text-ink-soft">{evidence.school} · {evidence.className}</p>
          <h2 id="dossie-titulo" className="mt-1 break-words font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Dossiê de evidências: {evidence.name}</h2>
          <p className="mt-1 text-sm text-ink-soft">Gerado em {formatDate(new Date())} por {user.name}. {ok} em dia, {conferir} para conferir e {pendente} {pendente === 1 ? "pendente" : "pendentes"}.</p>
          <p className="mt-1 text-xs text-ink-soft">Orientação do Governo Federal: {FEDERAL_SOURCE_LINE}. O decreto está com a redação do Decreto nº 12.773/2025.</p>
        </header>
        <EvidenceList groups={evidence.groups} studentId={id} />
      </article>
    </div>
  );
}
