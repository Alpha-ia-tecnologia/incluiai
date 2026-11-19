import Link from "next/link";
import { redirect } from "next/navigation";
import { recordJourneyMark } from "@/lib/user-journey";
import { getCurrentUser } from "@/lib/auth";
import { PERIODS, loadDashboard, parsePeriod, type DashboardPeriod } from "@/lib/dashboard";
import { can } from "@/lib/roles";
import { plural } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/dates";
import { duaIndicators } from "@/lib/dua/indicators";
import { LEGACY_ANCHORS, panelViews, parseView, type PanelView } from "@/lib/panel-overview";
import { EmptyState } from "@/components/ui";
import { BUTTON_CLS } from "@/components/form-styles";
import { PrintButton } from "@/components/print-button";
import { LegacyAnchor } from "./legacy-anchor";
import { Overview } from "./overview";
import { ActivitiesView, FamilyView, LessonsView, ObjectivesView, ProfileView, TeamView } from "./views";

const PERIOD_SHORT: Record<DashboardPeriod, string> = { "30d": "30 dias", "90d": "90 dias", ano: "Este ano", tudo: "Todo o histórico" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string; escola?: string; vista?: string }> }) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "pedagogical")) redirect("/");
  await recordJourneyMark(user.id, "painel");

  const period = parsePeriod(filters.periodo);
  const data = await loadDashboard(user, { period, school: filters.escola });
  const { scope, overview: o } = data;
  const views = panelViews({ network: scope.network });
  const view = parseView(filters.vista, { network: scope.network });
  const dua = view === "atividades" ? await duaIndicators(user, { start: scope.start, now: scope.now, schoolId: scope.schoolId, schoolName: scope.schoolName }) : null;
  const periodText = PERIODS[period].toLowerCase();

  const href = (changes: { periodo?: DashboardPeriod; vista?: PanelView }) => {
    const params = new URLSearchParams();
    const periodo = changes.periodo ?? period;
    const vista = changes.vista ?? view;
    if (vista !== "geral") params.set("vista", vista);
    if (periodo !== "ano") params.set("periodo", periodo);
    if (scope.network && scope.schoolId) params.set("escola", scope.schoolId);
    const query = params.toString();
    return query ? `/painel?${query}` : "/painel";
  };

  return (
    <>
      <header className="surface-navy mb-4 rounded-3xl px-5 pb-5 pt-6 sm:px-8 sm:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold leading-[1.15] tracking-tight text-on-navy sm:text-4xl">Painel de indicadores</h1>
            <p className="mt-2 text-sm leading-relaxed text-on-navy-soft">
              <span className="font-medium text-on-navy">{scope.schoolName ?? "Toda a rede"}</span>
              {o.students ? <> · <span data-testid="total-estudantes">{plural(o.students, "estudante", "estudantes")}</span> · {plural(o.schools, "escola", "escolas")} · {plural(o.classes, "turma", "turmas")}</> : null}
              {view !== "geral" && o.students ? <span className="hidden print:inline"> · {PERIODS[period]}{scope.start ? ` (desde ${formatDate(scope.start)})` : ""}</span> : null}
              {" "}· atualizado em {formatDateTime(scope.now)}
            </p>
          </div>
          <PrintButton label="Imprimir" className="hidden min-h-11 shrink-0 items-center gap-2 rounded-full border border-navy-line px-4 text-sm font-medium text-on-navy transition-colors hover:bg-navy-hover sm:inline-flex print:hidden" />
        </div>
        {o.students ? (
          <nav aria-label="Vistas do painel" className="mt-5 print:hidden">
            <ul className="flex flex-wrap gap-1.5">
              {views.map((item) => (
                <li key={item.key}>
                  <Link
                    href={href({ vista: item.key })}
                    aria-current={item.key === view ? "page" : undefined}
                    className="inline-flex min-h-11 items-center rounded-full border border-navy-line px-4 text-sm text-on-navy-soft transition-colors hover:bg-navy-hover hover:text-on-navy aria-[current=page]:border-transparent aria-[current=page]:bg-accent-sky aria-[current=page]:font-medium aria-[current=page]:text-ink-strong"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      {(view !== "geral" && o.students) || scope.network ? <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        {view !== "geral" && o.students ? (
          <nav aria-label="Período" className="grid w-full grid-cols-2 gap-1 rounded-3xl border border-line bg-surface-muted p-1 sm:flex sm:w-auto sm:flex-wrap">
            {(Object.keys(PERIODS) as DashboardPeriod[]).map((key) => (
              <Link key={key} href={href({ periodo: key })} aria-current={key === period ? "page" : undefined} className="inline-flex min-h-11 items-center justify-center rounded-full px-2 text-sm text-ink-soft transition-colors sm:px-4 hover:text-ink aria-[current=page]:bg-paper-raised aria-[current=page]:font-medium aria-[current=page]:text-ink aria-[current=page]:shadow-e1">
                {PERIOD_SHORT[key]}
              </Link>
            ))}
          </nav>
        ) : null}
        {scope.network ? (
          <form method="get" action="/painel" className="flex w-full items-center gap-2 sm:w-auto">
            {view !== "geral" ? <input type="hidden" name="vista" value={view} /> : null}
            {period !== "ano" ? <input type="hidden" name="periodo" value={period} /> : null}
            <label htmlFor="escola" className="text-sm text-ink-soft">Escola</label>
            {/* w-full: sem ele, o nome de escola mais longo vira a largura mínima e a página rola de lado a 320 px. */}
            <select id="escola" name="escola" defaultValue={scope.schoolId ?? ""} className="min-h-11 w-full min-w-0 flex-1 rounded-full border border-line bg-paper-raised px-3.5 text-sm sm:max-w-60">
              <option value="">Toda a rede</option>
              {scope.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
            <button type="submit" className={BUTTON_CLS.primary}>Ver</button>
          </form>
        ) : null}
      </div> : null}

      {o.students === 0 ? (
        <EmptyState character="resources" title="Ainda não há estudantes ativos neste recorte" hint="Quando houver estudantes cadastrados, os indicadores aparecem aqui." action={<Link href="/estudantes/novo" className="task-action">Cadastrar estudante</Link>} />
      ) : view === "geral" ? (
        <>
          <LegacyAnchor anchors={LEGACY_ANCHORS} />
          <Overview data={data} nominal={can(user.role, "seeNames")} canCensus={can(user.role, "importCensus") || can(user.role, "configureCensus")} periodText={periodText} />
        </>
      ) : view === "objetivos" ? <ObjectivesView data={data} periodText={periodText} />
        : view === "aulas" ? <LessonsView data={data} periodText={periodText} />
          : view === "atividades" ? <ActivitiesView data={data} dua={dua} periodText={periodText} canConfigureAi={can(user.role, "configureAi")} canPlanDua={can(user.role, "planDua")} />
            : view === "perfil" ? <ProfileView data={data} periodText={periodText} />
              : view === "familia" ? <FamilyView data={data} />
                : <TeamView data={data} periodText={periodText} />}
    </>
  );
}
