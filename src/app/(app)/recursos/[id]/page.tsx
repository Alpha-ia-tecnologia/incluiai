import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { registerResourceUse } from "@/actions/resources";
import { CONTEXTS, STAGES } from "@/lib/scale";
import { parseJson } from "@/lib/format";
import { PageHeader, Card, SectionTitle, Badge } from "@/components/ui";
import { DataBoard, DataCard, StatTile } from "@/components/data-viz";
import { BarList, SIGNAL } from "@/components/charts";
import { DonutSummary } from "@/components/viz/donut-summary";
import { percentOf } from "@/lib/series";
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

  const successRate = percentOf(resource.positiveOutcomes, resource.timesUsed);
  // "Precisa de ajuste" em amarelo, não laranja: é sinal para adaptar, não fracasso.
  const outcomes = [
    { key: "boa_resposta", label: "Boa resposta", value: resource.positiveOutcomes, color: SIGNAL.lime },
    { key: "precisa_ajuste", label: "Precisa de ajuste", value: Math.max(0, resource.timesUsed - resource.positiveOutcomes), color: SIGNAL.yellow },
  ];
  const activityRows = resource.activities.map((activity) => {
    const rate = percentOf(activity.positiveOutcomes, activity.timesUsed);
    return { key: activity.id, label: activity.title, value: activity.timesUsed, detail: rate === null ? "sem aplicações" : `${rate}% de boa resposta` };
  });

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

      <DataBoard className="mb-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <StatTile
          label="Aplicações na rede"
          value={resource.timesUsed}
          hint={resource.activities.length > 1 ? `Vezes em que uma das ${resource.activities.length} atividades deste recurso foi aplicada e teve a resposta registrada.` : "Vezes em que este recurso foi aplicado e teve a resposta registrada."}
        />
        <DataCard title="Resposta observada" hint={successRate === null ? undefined : `${resource.positiveOutcomes} de ${resource.timesUsed} aplicações com boa resposta. Resposta do recurso na prática, não nota do estudante.`}>
          <DonutSummary
            id="rosca-resposta"
            segments={outcomes}
            label="Resposta observada nas aplicações"
            center={successRate === null ? undefined : `${successRate}%`}
            caption="boa resposta"
            size={120}
            empty="Sem aplicações registradas: ainda não há percentual de boa resposta."
          />
        </DataCard>
        <DataCard title="Classificação" className="md:col-span-2 xl:col-span-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge>{STAGES[resource.stage] ?? resource.stage}</Badge>
            <Badge>{resource.skillArea}</Badge>
            <Badge tone="amber">{resource.accessibilityNeed}</Badge>
            <Badge>Complexidade {COMPLEXITY_LABELS[resource.complexity] ?? resource.complexity}</Badge>
          </div>
        </DataCard>
        {resource.activities.length > 1 ? (
          <DataCard title="Atividades por aplicações" hint="Quantas vezes cada atividade foi aplicada, com a boa resposta entre essas aplicações." className="md:col-span-2 xl:col-span-3">
            <BarList rows={activityRows} empty="Nenhuma atividade deste recurso foi aplicada ainda." />
          </DataCard>
        ) : null}
      </DataBoard>

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
