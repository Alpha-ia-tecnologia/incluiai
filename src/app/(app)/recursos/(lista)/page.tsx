import Image from "next/image";
import Link from "next/link";
import { textContains } from "@/lib/db-text";
import { recordJourneyMark } from "@/lib/user-journey";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { Card, Badge, EmptyState } from "@/components/ui";
import { labelCls, primaryButtonCls } from "@/components/form-styles";
import { HowToRead } from "@/components/explain";
import { Character } from "@/components/character";
import { STAGES } from "@/lib/scale";
import { COMPLEXITY_LABELS, RESOURCE_TYPES, resourcePresentation } from "@/lib/resource-bank";
import { ArrowUpRight, Search, ListChecks } from "lucide-react";
import { RingStat } from "@/components/data-viz";
import { SIGNAL } from "@/components/charts";
import { UsageMeter } from "@/components/viz/usage-meter";
import { percentOf } from "@/lib/series";

export const dynamic = "force-dynamic";

// Uma cor por tipo de recurso, como no restante da plataforma; a fotografia de
// cada recurso (src/lib/resource-bank.ts) mostra os materiais da proposta.
const TYPE_COLORS: Record<string, string> = {
  plano_de_aula: "bg-sage-soft",
  atividade: "bg-teal-soft",
  caa: "bg-sky-soft",
  tecnologia_assistiva: "bg-rose-soft",
  video_formacao: "bg-peach-soft",
  experiencia_exitosa: "bg-brand-soft",
};

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etapa?: string; tipo?: string }>;
}) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffOrNetwork(user.role)) redirect("/");
  await recordJourneyMark(user.id, "recursos");
  const q = filters.q?.trim() ?? "";
  const resources = await prisma.resource.findMany({
    where: {
      ...(filters.etapa ? { stage: filters.etapa } : {}),
      ...(filters.tipo ? { resourceType: filters.tipo } : {}),
      ...(q
        ? {
            OR: [
              { title: textContains(q) },
              { description: textContains(q) },
              { skillArea: textContains(q) },
              { accessibilityNeed: textContains(q) },
            ],
          }
        : {}),
    },
    include: { _count: { select: { activities: true } } },
    orderBy: [{ timesUsed: "desc" }, { title: "asc" }],
  });
  // A barra de uso compara cada recurso com o mais aplicado da lista filtrada.
  const mostUsed = resources.reduce((max, resource) => Math.max(max, resource.timesUsed), 0);

  return (
    <>
      <section aria-labelledby="resources-title" className="mb-8 grid grid-cols-[minmax(0,1fr)_80px] items-center gap-x-4 gap-y-3 rounded-3xl bg-lilac-soft/65 p-5 sm:grid-cols-[minmax(0,1fr)_160px] sm:gap-x-7 sm:p-7 lg:grid-cols-[minmax(0,1fr)_176px]">
        <h1 id="resources-title" className="min-w-0 font-display text-3xl font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl">Recursos para incluir.</h1>
        <Character variant="ideas" className="w-20 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-40 lg:w-44" preload />
        <p className="col-span-2 max-w-2xl text-sm text-ink-soft sm:col-span-1">Banco municipal de atividades e adaptações.</p>
      </section>

      <Card className="mb-8">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_12rem_auto]">
          <div className="min-w-0">
            <label htmlFor="q" className={labelCls}>Buscar recurso</label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-4 top-3.5 text-ink-soft" aria-hidden />
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Título, habilidade ou acessibilidade"
                className="h-11 w-full rounded-xl border border-line bg-paper py-2.5 pl-11 pr-4 text-sm text-ink"
              />
            </div>
          </div>
          <div>
            <label htmlFor="etapa" className={labelCls}>Etapa</label>
            <select id="etapa" name="etapa" defaultValue={filters.etapa ?? ""} className="h-11 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm text-ink">
              <option value="">Todas</option>
              {Object.entries(STAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tipo" className={labelCls}>Tipo de recurso</label>
            <select id="tipo" name="tipo" defaultValue={filters.tipo ?? ""} className="h-11 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm text-ink">
              <option value="">Todos</option>
              {Object.entries(RESOURCE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className={primaryButtonCls}>Filtrar</button>
            <Link href="/recursos" className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm text-ink-soft transition-colors hover:bg-surface-muted">Limpar</Link>
          </div>
        </form>
      </Card>
      {resources.length === 0 ? (
        q || filters.etapa || filters.tipo ? (
          <EmptyState character="resources" title="Nenhum recurso encontrado" hint="Ajuste ou limpe os filtros para ver o catálogo completo." />
        ) : (
          <EmptyState character="resources" title="O banco de recursos ainda está vazio" hint="Os recursos aparecem aqui assim que o catálogo da rede for carregado." />
        )
      ) : (
        <div>
          <div className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <h2 className="text-base font-medium text-ink">Explore os recursos</h2>
              <span className="text-xs text-ink-soft">{resources.length} {resources.length === 1 ? "recurso disponível" : "recursos disponíveis"}</span>
            </div>
            <HowToRead>
              O anel mostra a boa resposta entre as aplicações registradas na rede; a barra compara o uso com o recurso mais aplicado desta lista{mostUsed ? ` (${mostUsed}x)` : ""}. Sem aplicações, não há percentual. As fotografias são ilustrativas.
            </HowToRead>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((r) => {
              const successRate = percentOf(r.positiveOutcomes, r.timesUsed);
              const photo = resourcePresentation(r);
              return (
                <Link key={r.id} href={`/recursos/${r.id}`} className={`group flex h-full flex-col overflow-hidden rounded-3xl text-ink transition duration-200 hover:-translate-y-1 hover:shadow-e2 ${TYPE_COLORS[r.resourceType] ?? "bg-surface-muted"}`}>
                  {/* A foto é ilustrativa e o título já nomeia o link: fica fora da leitura. */}
                  <Image src={photo.image} alt="" width={1000} height={750} sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw" className="aspect-[3/2] w-full bg-surface-muted object-cover" />
                  <div className="flex flex-1 flex-col p-6">
                    <span className="mb-2 text-xs font-medium">{RESOURCE_TYPES[r.resourceType] ?? r.resourceType}</span>
                    <h3 className="max-w-lg text-xl font-medium leading-snug tracking-tight text-ink">{r.title}</h3>
                    <p className="mb-5 mt-2 line-clamp-3 text-sm leading-relaxed text-ink/75">{r.description}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      <Badge>{STAGES[r.stage] ?? r.stage}</Badge>
                      <Badge>{r.skillArea}</Badge>
                      <Badge>{r.accessibilityNeed}</Badge>
                      <Badge>{COMPLEXITY_LABELS[r.complexity] ?? r.complexity}</Badge>
                    </div>
                    <div className="mt-5 flex items-center gap-3 border-t border-ink/10 pt-4">
                      {/* O anel repete o percentual escrito ao lado: fica fora do nome do link. */}
                      <div aria-hidden className="shrink-0 rounded-full bg-white/80 p-1">
                        <RingStat id={`boa-resposta-${r.id}`} value={successRate} label="Boa resposta" size={52} color={SIGNAL.lime}>
                          <span aria-hidden className="text-xs font-medium tabular-nums text-ink">{successRate === null ? "—" : `${successRate}%`}</span>
                        </RingStat>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink">{successRate === null ? "Sem aplicações registradas" : `${successRate}% de boa resposta`}<span className="font-normal text-ink/75">{successRate === null ? "" : ` · ${r.positiveOutcomes} de ${r.timesUsed}`}</span></p>
                        <UsageMeter value={r.timesUsed} max={mostUsed} track="bg-white/70" className="mt-1.5" />
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/75">
                          <span>Aplicado {r.timesUsed}x na rede</span>
                          <span className="inline-flex items-center gap-1.5"><ListChecks size={13} aria-hidden /> {r._count.activities} atividades</span>
                        </p>
                      </div>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 transition-colors group-hover:bg-white"><ArrowUpRight size={17} aria-hidden /></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
