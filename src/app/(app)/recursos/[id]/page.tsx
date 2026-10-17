import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { registerResourceUse } from "@/actions/resources";
import { CONTEXTS, STAGES } from "@/lib/scale";
import { parseJson } from "@/lib/format";
import { PageHeader, Card, SectionTitle, Badge, KpiCard } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import {
  ArrowLeft, ThumbsUp, ThumbsDown, Repeat, Clock, Target,
  PackageOpen, ListChecks, SlidersHorizontal, ClipboardCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  plano_de_aula: "Plano de aula",
  atividade: "Atividade",
  caa: "Comunicação alternativa",
  tecnologia_assistiva: "Tecnologia assistiva",
  video_formacao: "Vídeo de formação",
  experiencia_exitosa: "Experiência exitosa",
};
const COMPLEXITY_LABELS: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffOrNetwork(user.role)) redirect("/");

  const resource = await prisma.resource.findUnique({
    where: { id },
    include: { activities: { orderBy: [{ position: "asc" }, { title: "asc" }] } },
  });
  if (!resource) notFound();

  const successRate = resource.timesUsed > 0 ? Math.round((resource.positiveOutcomes / resource.timesUsed) * 100) : null;

  return (
    <>
      <Link href="/recursos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-brand-strong">
        <ArrowLeft size={14} aria-hidden /> Banco de recursos
      </Link>
      <PageHeader
        title={resource.title}
        lede={resource.description}
        actions={
          <>
            <Badge tone="brand">{TYPE_LABELS[resource.resourceType] ?? resource.resourceType}</Badge>
            <PrintButton label="Imprimir atividades" />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard icon={Repeat} value={resource.timesUsed} label="Aplicações na rede" />
        <KpiCard icon={ThumbsUp} tone="green" value={resource.positiveOutcomes} pct={successRate} label="Com boa resposta" sub={successRate === null ? "Sem aplicações registradas" : undefined} />
        <Card>
          <SectionTitle>Classificação</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{STAGES[resource.stage] ?? resource.stage}</Badge>
            <Badge>{resource.skillArea}</Badge>
            <Badge tone="amber">{resource.accessibilityNeed}</Badge>
            <Badge>Complexidade {COMPLEXITY_LABELS[resource.complexity] ?? resource.complexity}</Badge>
          </div>
        </Card>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle>Atividades correspondentes</SectionTitle>
        <span className="text-xs text-ink-soft">{resource.activities.length} propostas prontas para aplicar</span>
      </div>

      <div className="space-y-5">
        {resource.activities.map((activity, index) => {
          const materials = parseJson<string[]>(activity.materials, []);
          const steps = parseJson<string[]>(activity.steps, []);
          const adaptations = parseJson<string[]>(activity.adaptations, []);
          const activityRate = activity.timesUsed > 0
            ? Math.round((activity.positiveOutcomes / activity.timesUsed) * 100)
            : null;
          const register = registerResourceUse.bind(null, resource.id, activity.id);

          return (
            <Card key={activity.id}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft font-mono text-sm font-semibold text-brand-strong" aria-hidden>
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ink">{activity.title}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="brand">{CONTEXTS[activity.context] ?? activity.context}</Badge>
                      <Badge><Clock size={11} aria-hidden /> {activity.durationMinutes} minutos</Badge>
                      <Badge><Repeat size={11} aria-hidden /> {activity.timesUsed} aplicações</Badge>
                      {activityRate !== null ? <Badge tone="green">{activityRate}% de boa resposta</Badge> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-5">
                  <section>
                    <SectionTitle><span className="flex items-center gap-1.5"><Target size={13} aria-hidden /> Objetivo</span></SectionTitle>
                    <p className="text-sm leading-relaxed text-ink">{activity.objective}</p>
                  </section>
                  <section>
                    <SectionTitle><span className="flex items-center gap-1.5"><PackageOpen size={13} aria-hidden /> Materiais</span></SectionTitle>
                    <ul className="space-y-1.5 text-sm text-ink">
                      {materials.map((material) => <li key={material} className="flex gap-2"><span className="text-brand" aria-hidden>•</span>{material}</li>)}
                    </ul>
                  </section>
                  <section>
                    <SectionTitle><span className="flex items-center gap-1.5"><SlidersHorizontal size={13} aria-hidden /> Adaptações de acesso</span></SectionTitle>
                    <ul className="space-y-1.5 text-sm text-ink">
                      {adaptations.map((adaptation) => <li key={adaptation} className="flex gap-2"><span className="text-brand" aria-hidden>•</span>{adaptation}</li>)}
                    </ul>
                  </section>
                </div>

                <div className="space-y-5">
                  <section>
                    <SectionTitle><span className="flex items-center gap-1.5"><ListChecks size={13} aria-hidden /> Como aplicar</span></SectionTitle>
                    <ol className="space-y-2">
                      {steps.map((step, stepIndex) => (
                        <li key={step} className="flex gap-2.5 text-sm leading-relaxed text-ink">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-[10px] font-semibold text-brand-strong">{stepIndex + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="rounded-lg border border-green/30 bg-green-soft/50 p-3.5">
                    <SectionTitle><span className="flex items-center gap-1.5"><ClipboardCheck size={13} aria-hidden /> Evidência a observar</span></SectionTitle>
                    <p className="text-sm leading-relaxed text-ink">{activity.evidenceCriterion}</p>
                  </section>
                </div>
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-xs text-ink-soft">Depois de aplicar, registre a resposta observada nesta atividade:</p>
                <div className="flex flex-wrap gap-2">
                  <form action={register}>
                    <input type="hidden" name="worked" value="sim" />
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-green-soft px-4 py-2 text-sm font-medium text-green hover:opacity-80">
                      <ThumbsUp size={15} aria-hidden /> Teve boa resposta
                    </button>
                  </form>
                  <form action={register}>
                    <input type="hidden" name="worked" value="nao" />
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-coral-soft px-4 py-2 text-sm font-medium text-coral hover:opacity-80">
                      <ThumbsDown size={15} aria-hidden /> Precisa de ajuste
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
