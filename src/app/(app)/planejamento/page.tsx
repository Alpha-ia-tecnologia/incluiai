import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { canPlanDua, canSeeDuaIndicators } from "@/lib/dua/access";
import { classOptions, listPlannings } from "@/lib/dua/plannings";
import { SHARING_LABEL } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { Character } from "@/components/character";
import { NewPlanningForm } from "@/components/dua/new-planning-form";
import { ReviewBadge, inputCls, labelCls, secondaryCls } from "@/components/dua/dua-ui";

export const dynamic = "force-dynamic";

const QUESTIONS = [
  "O que os estudantes precisam aprender?",
  "Quais barreiras a atividade e o contexto podem apresentar?",
  "Quais opções de acesso e participação serão oferecidas?",
  "Quais apoios individuais serão necessários?",
  "Que evidências permitirão observar a aprendizagem?",
];

export default async function PlanningListPage({ searchParams }: { searchParams: Promise<{ q?: string; meus?: string; reaproveitar?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canPlanDua(user)) redirect(canSeeDuaIndicators(user) ? "/painel#dua" : "/");
  const params = await searchParams;
  const query = (params.q ?? "").slice(0, 120);
  const mine = params.meus === "1";
  const [plannings, classes, all] = await Promise.all([
    listPlannings(user, { query, mine }),
    classOptions(user),
    listPlannings(user),
  ]);
  const reusable = all.map((item) => ({ value: item.id, label: `${item.title}${item.validatedVersion ? ` (versão ${item.validatedVersion} validada)` : " (rascunho)"}` }));

  return (
    <>
      <PageHeader
        title="Planejamento com DUA"
        lede="Desenho Universal para a Aprendizagem: planeje a atividade da turma considerando, desde o início, as diferentes formas de acessar, participar e mostrar o que aprendeu."
      />

      <div className="mb-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <Card className="min-w-0 border-brand/30">
          <SectionTitle>Planejar atividade com DUA</SectionTitle>
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">Não exige estudo de caso, diagnóstico, laudo ou plano individual: o planejamento é da turma ou do grupo. Apoios individuais entram depois, com acesso restrito.</p>
          <NewPlanningForm classes={classes} reusable={reusable} defaultReuse={params.reaproveitar} />
        </Card>
        <Card className="min-w-0 bg-surface-muted/60">
          <Character variant="planning" className="mb-3 w-24" />
          <h2 className="text-sm font-medium text-ink">As cinco perguntas do planejamento</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
            {QUESTIONS.map((question) => <li key={question}>{question}</li>)}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">A IA pode sugerir alternativas. Objetivos, estratégias, evidências e validação ficam com os profissionais.</p>
        </Card>
      </div>

      <section aria-labelledby="lista-titulo">
        <h2 id="lista-titulo" className="mb-4 font-display text-xl font-medium text-ink">Atividades planejadas</h2>
        <form method="get" className="mb-5 flex min-w-0 flex-wrap items-end gap-3" role="search">
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="busca" className={labelCls}>Buscar por título, objetivo, barreira ou opção</label>
            <input id="busca" name="q" defaultValue={query} className={inputCls} />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="meus" value="1" defaultChecked={mine} className="size-4 accent-[var(--brand)]" /> Só os meus
          </label>
          <button type="submit" className={secondaryCls}><Search size={16} aria-hidden /> Buscar</button>
        </form>
        <p className="mb-3 text-sm text-ink-soft" role="status">{plannings.length} planejamento(s){query ? ` para “${query}”` : ""}.</p>
        {plannings.length === 0 ? (
          <EmptyState title={query || mine ? "Nenhum planejamento encontrado." : "Nenhum planejamento ainda."} hint={query || mine ? "Tente outra busca." : "Comece por “Planejar atividade com DUA”."} />
        ) : (
          <ul className="grid min-w-0 gap-3 md:grid-cols-2">
            {plannings.map((item) => (
              <li key={item.id} className="min-w-0">
                <Link href={`/planejamento/${item.id}`} className="ui-card group flex h-full min-w-0 flex-col gap-2 transition-shadow hover:shadow-e2">
                  <span className="flex flex-wrap items-center gap-2">
                    <ReviewBadge state={item.state} />
                    <Badge tone="neutral">Versão {item.version}</Badge>
                    {item.sharing === "compartilhado" ? <Badge tone="brand">{SHARING_LABEL.compartilhado}</Badge> : null}
                  </span>
                  <span className="font-display text-lg font-medium text-ink">{item.title}</span>
                  {item.objective ? <span className="line-clamp-2 text-sm text-ink-soft">{item.objective}</span> : null}
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-ink-soft">
                    <span>{item.ownerName}{item.className ? ` · ${item.className}` : ""} · atualizado em {formatDate(item.updatedAt)} · {item.applications} aplicação(ões)</span>
                    <span className="inline-flex items-center gap-1 font-medium text-brand-strong">Abrir <ArrowRight size={14} aria-hidden /></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
