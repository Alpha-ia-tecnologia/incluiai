import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { DuaError } from "@/lib/dua/shared";
import { loadPlanning } from "@/lib/dua/plannings";
import { SHARING_LABEL, type Sharing } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui";
import { PlanningTabs } from "@/components/dua/planning-tabs";
import { ReviewBadge } from "@/components/dua/dua-ui";

// Cabeçalho comum do planejamento. A permissão é conferida a cada página (e em
// cada ação): quem está fora do recorte recebe "não encontrado".
export default async function PlanningLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let loaded;
  try {
    loaded = await loadPlanning(user, id);
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const { planning, current } = loaded;

  return (
    <>
      <Link href="/planejamento" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline print:hidden">
        <ArrowLeft size={16} aria-hidden /> Voltar para o planejamento
      </Link>
      <div className="mb-4 rounded-2xl bg-surface-muted p-4 sm:p-5 print:hidden">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-strong">Atividade com DUA</p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">{planning.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Responsável: {planning.ownerName}
          {planning.className ? ` · ${planning.className}` : ""}
          {planning.collaboratorList.length ? ` · colaboração: ${planning.collaboratorList.map((item) => item.name).join(", ")}` : ""}
          {` · atualizado em ${formatDate(current.updatedAt)}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="neutral">Versão {current.version}</Badge>
          <ReviewBadge state={current.state} />
          <Badge tone={planning.sharing === "compartilhado" ? "brand" : "neutral"}>{SHARING_LABEL[planning.sharing as Sharing] ?? planning.sharing}</Badge>
          {current.validatedAt ? <Badge tone="green">Validada por {current.validatedByName} em {formatDate(current.validatedAt)}</Badge> : null}
        </div>
      </div>
      <div className="mb-6">
        <PlanningTabs planningId={planning.id} />
      </div>
      {children}
    </>
  );
}
