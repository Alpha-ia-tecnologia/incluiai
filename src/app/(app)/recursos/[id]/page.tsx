import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { registerResourceUse } from "@/actions/resources";
import { CONTEXTS, STAGES } from "@/lib/scale";
import { parseJson } from "@/lib/format";
import { COMPLEXITY_LABELS, RESOURCE_TYPES, resourcePresentation } from "@/lib/resource-bank";
import { PageHeader, Card, SectionTitle, Badge } from "@/components/ui";
import { DataBoard, DataCard, StatTile } from "@/components/data-viz";
import { BarList, SIGNAL } from "@/components/charts";
import { DonutSummary } from "@/components/viz/donut-summary";
import { percentOf } from "@/lib/series";
import { ActivityPrintMaterials } from "@/components/resources/activity-print-materials";
import { ResourcePrintButton } from "@/components/resources/resource-print-button";
import { activityPrintMaterials } from "@/lib/resource-print-materials";
import styles from "@/components/resources/resource-print.module.css";
import { quietButtonCls, secondaryButtonCls } from "@/components/form-styles";
import {
  ArrowLeft, ThumbsUp, ThumbsDown, Repeat, Clock, Target,
  PackageOpen, ListChecks, SlidersHorizontal, ClipboardCheck, Sprout,
} from "lucide-react";

export const dynamic = "force-dynamic";

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

  // Fotografia, preparação, modelo e níveis de apoio de cada recurso (src/lib/resource-bank.ts).
  const guide = resourcePresentation(resource);
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
    <div className={styles.detail} data-resource-print-root>
      <Link href="/recursos" data-resource-screen className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-brand-strong">
        <ArrowLeft size={14} aria-hidden /> Banco de recursos
      </Link>
      <div data-resource-introduction><PageHeader
        title={resource.title}
        lede={resource.description}
        actions={
          <>
            <Badge tone="brand">{RESOURCE_TYPES[resource.resourceType] ?? resource.resourceType}</Badge>
            <ResourcePrintButton label="Imprimir atividades e materiais" />
          </>
        }
      /></div>

      <div data-resource-screen>
      <Card className="mb-6 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center">
        <figure className="min-w-0">
          <Image src={guide.image} alt={guide.imageAlt} width={1000} height={750} sizes="(min-width: 1280px) 460px, (min-width: 768px) 40vw, 100vw" className="aspect-[4/3] w-full rounded-2xl bg-surface-muted object-cover" preload />
          <figcaption className="mt-2 text-xs text-ink-soft">Imagem ilustrativa dos materiais.</figcaption>
        </figure>
        <section aria-labelledby="antes-de-comecar" className="min-w-0">
          <SectionTitle><span id="antes-de-comecar" className="flex items-center gap-1.5"><PackageOpen size={13} aria-hidden /> Antes de começar</span></SectionTitle>
          <ul className="space-y-2.5">
            {guide.preparation.map((item) => <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink"><span className="text-brand" aria-hidden>•</span>{item}</li>)}
          </ul>
        </section>
      </Card>

      <DataBoard className="mb-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <StatTile
          label="Aplicações na rede"
          value={resource.timesUsed}
          hint={resource.activities.length > 1 ? `Com resposta registrada · somando as ${resource.activities.length} atividades` : "Com resposta registrada"}
        />
        <DataCard title="Resposta observada" hint={successRate === null ? undefined : "Do recurso na prática, não nota do estudante"}>
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
            <Badge>{COMPLEXITY_LABELS[resource.complexity] ?? resource.complexity}</Badge>
          </div>
        </DataCard>
        {resource.activities.length > 1 ? (
          <DataCard title="Atividades por aplicações" hint="Aplicações e % de boa resposta de cada atividade" className="md:col-span-2 xl:col-span-3">
            <BarList rows={activityRows} empty="Nenhuma atividade deste recurso foi aplicada ainda." />
          </DataCard>
        ) : null}
      </DataBoard>

      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle>Modelo de apoio</SectionTitle>
          <h2 className="font-display text-lg font-semibold text-ink">{guide.model.title}</h2>
          <p className="mb-3 mt-1 text-sm leading-relaxed text-ink-soft">{guide.model.instruction}</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Itens do modelo">
            {guide.model.items.map((item) => <li key={item} className="rounded-full bg-surface-muted px-3 py-1.5 text-sm text-ink">{item}</li>)}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Ajuste o apoio à participação</SectionTitle>
          <ol className="space-y-3">
            {guide.supportLevels.map((level, index) => (
              <li key={level.label} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft tabular-nums text-xs font-semibold text-brand-strong" aria-hidden>{index + 1}</span>
                <span><strong className="font-medium text-ink">{level.label}.</strong> <span className="text-ink-soft">{level.description}</span></span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle>Atividades correspondentes</SectionTitle>
        <span className="text-xs text-ink-soft">{resource.activities.length} propostas prontas para aplicar</span>
      </div>
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
          const sheets = activityPrintMaterials(resource.title, activity.title);

          return (
            <article key={activity.id} id={`atividade-${activity.id}`} aria-labelledby={`titulo-${activity.id}`} className={styles.activity} data-resource-activity={activity.id}>
            <Card className={styles.activityCard}>
              <div data-resource-instructions>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft tabular-nums text-sm font-semibold text-brand-strong" aria-hidden>
                    {index + 1}
                  </span>
                  <div>
                    <h2 id={`titulo-${activity.id}`} className="font-display text-xl font-semibold text-ink">{activity.title}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="brand">{CONTEXTS[activity.context] ?? activity.context}</Badge>
                      <Badge><Clock size={11} aria-hidden /> {activity.durationMinutes} minutos</Badge>
                      <Badge><Repeat size={11} aria-hidden /> {activity.timesUsed} aplicações</Badge>
                      {activityRate !== null ? <Badge tone="green">{activityRate}% de boa resposta</Badge> : null}
                    </div>
                  </div>
                </div>
                <ResourcePrintButton activityId={activity.id} label="Imprimir atividade completa" />
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
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft tabular-nums text-xs font-semibold text-brand-strong">{stepIndex + 1}</span>
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
              </div>

              <ActivityPrintMaterials activityId={activity.id} activityTitle={activity.title} resourceTitle={resource.title} sheets={sheets} />

              <div data-resource-screen className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-xs text-ink-soft">Depois de aplicar, registre a resposta:</p>
                <div className="flex flex-wrap gap-2">
                  <form action={register}>
                    <input type="hidden" name="worked" value="sim" />
                    <button type="submit" className={secondaryButtonCls}>
                      <ThumbsUp size={15} aria-hidden /> Teve boa resposta
                    </button>
                  </form>
                  <form action={register}>
                    <input type="hidden" name="worked" value="nao" />
                    <button type="submit" className={quietButtonCls}>
                      <ThumbsDown size={15} aria-hidden /> Precisa de ajuste
                    </button>
                  </form>
                </div>
              </div>
            </Card>
            </article>
          );
        })}
      </div>

      <section data-resource-screen aria-labelledby="para-continuar" className="mt-6 flex gap-3 rounded-2xl bg-green-soft/60 p-5">
        <Sprout size={20} aria-hidden className="mt-0.5 shrink-0 text-green" />
        <div>
          <h2 id="para-continuar" className="text-base font-medium text-ink">Para continuar</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink">{guide.extension}</p>
        </div>
      </section>
    </div>
  );
}
