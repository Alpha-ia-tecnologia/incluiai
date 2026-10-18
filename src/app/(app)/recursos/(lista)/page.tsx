import Link from "next/link";
import { recordJourneyMark } from "@/lib/user-journey";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { Card, Badge, EmptyState } from "@/components/ui";
import { labelCls } from "@/components/form-styles";
import { Character } from "@/components/character";
import { STAGES } from "@/lib/scale";
import { ArrowUpRight, Search, ListChecks, BookOpen, MessagesSquare, MonitorPlay, Puzzle, Sparkles, Laptop, type LucideIcon } from "lucide-react";
import { RingStat } from "@/components/data-viz";
import { SIGNAL } from "@/components/charts";
import { UsageMeter } from "@/components/viz/usage-meter";
import { percentOf } from "@/lib/series";

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

// Uma cor por tipo de recurso; atividades em verde-água e comunicação em azul,
// como no restante da plataforma.
const RESOURCE_VISUALS: Record<string, { color: string; icon: LucideIcon }> = {
  plano_de_aula: { color: "bg-sage-soft", icon: BookOpen },
  atividade: { color: "bg-teal-soft", icon: Puzzle },
  caa: { color: "bg-sky-soft", icon: MessagesSquare },
  tecnologia_assistiva: { color: "bg-rose-soft", icon: Laptop },
  video_formacao: { color: "bg-peach-soft", icon: MonitorPlay },
  experiencia_exitosa: { color: "bg-brand-soft", icon: Sparkles },
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
              { title: { contains: q } },
              { description: { contains: q } },
              { skillArea: { contains: q } },
              { accessibilityNeed: { contains: q } },
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
        <h1 id="resources-title" className="min-w-0 font-display text-3xl font-normal leading-[1.15] tracking-tight text-ink sm:text-4xl">Recursos para incluir.</h1>
        <Character variant="ideas" className="w-20 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-40 lg:w-44" preload />
        <p className="col-span-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:col-span-1">Explore o banco municipal de recursos inclusivos: atividades, adaptações e novas possibilidades para aprender.</p>
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
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-white transition-colors hover:bg-brand-strong">Filtrar</button>
            <Link href="/recursos" className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm text-ink-soft transition-colors hover:bg-surface-muted">Limpar</Link>
          </div>
        </form>
      </Card>
      {resources.length === 0 ? (
        <EmptyState character="resources" title="Nenhum recurso encontrado" hint="Ajuste ou limpe os filtros para ver o catálogo completo." />
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h2 className="text-base font-medium text-ink">Explore os recursos</h2>
            <span className="text-xs text-ink-soft">{resources.length} {resources.length === 1 ? "recurso disponível" : "recursos disponíveis"}</span>
          </div>
          <p className="mb-4 max-w-3xl text-xs leading-relaxed text-ink-soft">
            Em cada cartão, o anel mostra a boa resposta entre as aplicações registradas na rede, e a barra compara o uso com o recurso mais aplicado desta lista{mostUsed ? ` (${mostUsed}x)` : ""}. Sem aplicações, não há percentual.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            {resources.map((r) => {
              const successRate = percentOf(r.positiveOutcomes, r.timesUsed);
              const visual = RESOURCE_VISUALS[r.resourceType] ?? { color: "bg-surface-muted", icon: BookOpen };
              const ResourceIcon = visual.icon;
              return (
                <Link key={r.id} href={`/recursos/${r.id}`} className={`group flex h-full flex-col rounded-3xl p-6 text-ink transition duration-200 hover:-translate-y-1 hover:shadow-e2 ${visual.color}`}>
                  <div className="mb-7 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80"><ResourceIcon size={19} strokeWidth={1.6} aria-hidden /></span>
                      <span className="text-xs font-medium">{TYPE_LABELS[r.resourceType] ?? r.resourceType}</span>
                    </div>
                  </div>
                  <h3 className="max-w-lg text-xl font-medium leading-snug tracking-tight text-ink">{r.title}</h3>
                  <p className="mb-5 mt-2 text-sm leading-relaxed text-ink/75">{r.description}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Badge>{STAGES[r.stage] ?? r.stage}</Badge>
                    <Badge>{r.skillArea}</Badge>
                    <Badge>{r.accessibilityNeed}</Badge>
                    <Badge>Complexidade {COMPLEXITY_LABELS[r.complexity] ?? r.complexity}</Badge>
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
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
