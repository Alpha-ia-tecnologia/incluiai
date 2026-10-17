import Link from "next/link";
import { recordJourneyMark } from "@/lib/user-journey";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { Card, Badge, EmptyState } from "@/components/ui";
import { Character } from "@/components/character";
import { STAGES } from "@/lib/scale";
import { ThumbsUp, ArrowUpRight, Search, ListChecks, BookOpen, MessagesSquare, MonitorPlay, Puzzle, Sparkles, Laptop, type LucideIcon } from "lucide-react";

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

  return (
    <>
      <section aria-labelledby="resources-title" className="mb-8 grid grid-cols-[minmax(0,1fr)_80px] items-center gap-x-4 gap-y-3 rounded-[1.75rem] bg-lilac-soft/65 p-5 sm:grid-cols-[minmax(0,1fr)_160px] sm:gap-x-7 sm:p-7 lg:grid-cols-[minmax(0,1fr)_176px]">
        <h1 id="resources-title" className="min-w-0 font-display text-3xl font-normal leading-[1.15] tracking-tight text-ink sm:text-[40px]">Recursos para incluir.</h1>
        <Character variant="ideas" className="w-20 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-40 lg:w-44" preload />
        <p className="col-span-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:col-span-1">Explore o banco municipal de recursos inclusivos: atividades, adaptações e novas possibilidades para aprender.</p>
      </section>

      <Card className="mb-8">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_12rem_auto]">
          <div className="min-w-0">
            <label htmlFor="q" className="mb-2 block text-xs font-medium text-ink-soft">Buscar recurso</label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-4 top-3.5 text-ink-soft" aria-hidden />
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Título, habilidade ou acessibilidade"
                className="h-11 w-full rounded-full border border-line bg-paper py-2.5 pl-11 pr-4 text-sm text-ink"
              />
            </div>
          </div>
          <div>
            <label htmlFor="etapa" className="mb-2 block text-xs font-medium text-ink-soft">Etapa</label>
            <select id="etapa" name="etapa" defaultValue={filters.etapa ?? ""} className="h-11 w-full rounded-full border border-line bg-paper px-4 py-2.5 text-sm text-ink">
              <option value="">Todas</option>
              {Object.entries(STAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tipo" className="mb-2 block text-xs font-medium text-ink-soft">Tipo de recurso</label>
            <select id="tipo" name="tipo" defaultValue={filters.tipo ?? ""} className="h-11 w-full rounded-full border border-line bg-paper px-4 py-2.5 text-sm text-ink">
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
        <EmptyState title="Nenhum recurso encontrado" hint="Ajuste ou limpe os filtros para ver o catálogo completo." />
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-base font-medium text-ink">Explore os recursos</h2>
            <span className="text-xs text-ink-soft">{resources.length} {resources.length === 1 ? "recurso disponível" : "recursos disponíveis"}</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {resources.map((r) => {
              const successRate = r.timesUsed > 0 ? Math.round((r.positiveOutcomes / r.timesUsed) * 100) : null;
              const visual = RESOURCE_VISUALS[r.resourceType] ?? { color: "bg-surface-muted", icon: BookOpen };
              const ResourceIcon = visual.icon;
              return (
                <Link key={r.id} href={`/recursos/${r.id}`} className={`group flex h-full flex-col rounded-[1.75rem] p-6 text-ink transition duration-200 hover:-translate-y-1 hover:shadow-e2 ${visual.color}`}>
                  <div className="mb-7 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80"><ResourceIcon size={19} strokeWidth={1.6} aria-hidden /></span>
                      <span className="text-xs font-medium">{TYPE_LABELS[r.resourceType] ?? r.resourceType}</span>
                    </div>
                    {successRate !== null ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-medium" aria-label={`${successRate}% de boa resposta`} title="Percentual de boa resposta"><ThumbsUp size={12} aria-hidden /> {successRate}%</span>
                    ) : null}
                  </div>
                  <h3 className="max-w-lg text-xl font-medium leading-snug tracking-tight text-ink">{r.title}</h3>
                  <p className="mb-5 mt-2 text-sm leading-relaxed text-ink/75">{r.description}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Badge>{STAGES[r.stage] ?? r.stage}</Badge>
                    <Badge>{r.skillArea}</Badge>
                    <Badge>{r.accessibilityNeed}</Badge>
                    <Badge>Complexidade {COMPLEXITY_LABELS[r.complexity] ?? r.complexity}</Badge>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/75">
                      <span className="inline-flex items-center gap-1.5"><ListChecks size={13} aria-hidden /> {r._count.activities} atividades</span>
                      <span>Aplicado {r.timesUsed}x na rede</span>
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
