import Link from "next/link";
import { recordJourneyMark } from "@/lib/user-journey";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Lightbulb, Megaphone, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Character } from "@/components/character";
import { PrintButton } from "@/components/print-button";
import {
  CALENDAR_THEMES, MONTHLY_CAMPAIGNS, MONTH_NAMES, MONTH_SHORT,
  dateRangeLabel, dayIndex, daysInMonth, monthEvents, monthParam, relativeLabel, todayInBrazil, weekdayOf,
  type CalendarEvent, type CalendarTheme, type YMD,
} from "@/lib/commemorative-dates";

export const dynamic = "force-dynamic";

const WEEKDAYS = [["Dom", "domingo"], ["Seg", "segunda-feira"], ["Ter", "terça-feira"], ["Qua", "quarta-feira"], ["Qui", "quinta-feira"], ["Sex", "sexta-feira"], ["Sáb", "sábado"]];

function parseMonth(value: string | undefined, fallback: { year: number; month: number }) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) return { year, month };
  }
  return fallback;
}

function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function calendarHref(mes: string, tema?: string) {
  const params = new URLSearchParams({ mes });
  if (tema) params.set("tema", tema);
  return `/calendario?${params}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tema?: string }>;
}) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await recordJourneyMark(user.id, "calendario");

  const today = todayInBrazil();
  const { year, month } = parseMonth(filters.mes, today);
  const tema = filters.tema && filters.tema in CALENDAR_THEMES ? (filters.tema as CalendarTheme) : undefined;
  const current = monthParam(year, month);
  const isCurrentMonth = year === today.year && month === today.month;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const monthName = MONTH_NAMES[month - 1];
  const monthTitle = `${monthName[0].toUpperCase()}${monthName.slice(1)} de ${year}`;

  const events = monthEvents(year, month).filter((event) => !tema || event.entry.theme === tema);
  const campaigns = MONTHLY_CAMPAIGNS.filter((campaign) => campaign.month === month && (!tema || campaign.theme === tema));

  const eventsOn = (day: number) => {
    const index = dayIndex({ year, month, day });
    return events.filter((event) => dayIndex(event.start) <= index && index <= dayIndex(event.end));
  };
  const leading = weekdayOf({ year, month, day: 1 });
  const cells: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const filterOptions: [CalendarTheme | undefined, string][] = [
    [undefined, "Todos os temas"],
    ...Object.entries(CALENDAR_THEMES).map(([key, theme]): [CalendarTheme, string] => [key as CalendarTheme, theme.label]),
  ];

  return (
    <>
      <section aria-labelledby="calendar-title" className="mb-8 grid grid-cols-[minmax(0,1fr)_80px] items-center gap-x-4 gap-y-3 rounded-3xl bg-lilac-soft/65 p-5 sm:grid-cols-[minmax(0,1fr)_160px] sm:gap-x-7 sm:p-7 lg:grid-cols-[minmax(0,1fr)_176px] print:bg-transparent print:p-0">
        <h1 id="calendar-title" className="min-w-0 font-display text-3xl font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl">Calendário inclusivo.</h1>
        <Character variant="planning" className="w-20 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-40 lg:w-44" preload />
        <p className="col-span-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:col-span-1">Datas comemorativas da educação especial e inclusiva — como o Dia do Autismo e o Dia das Línguas de Sinais — com ideias para celebrar com toda a turma.</p>
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={calendarHref(monthParam(prev.year, prev.month), tema)} aria-label={`Mês anterior: ${MONTH_NAMES[prev.month - 1]} de ${prev.year}`} className="flex size-11 items-center justify-center rounded-full border border-line bg-paper-raised transition-colors hover:bg-brand-soft print:hidden"><ChevronLeft size={20} aria-hidden /></Link>
          <h2 className="min-w-0 text-center text-xl font-medium tracking-tight sm:min-w-48">{monthTitle}</h2>
          <Link href={calendarHref(monthParam(next.year, next.month), tema)} aria-label={`Próximo mês: ${MONTH_NAMES[next.month - 1]} de ${next.year}`} className="flex size-11 items-center justify-center rounded-full border border-line bg-paper-raised transition-colors hover:bg-brand-soft print:hidden"><ChevronRight size={20} aria-hidden /></Link>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {!isCurrentMonth ? <Link href={calendarHref(monthParam(today.year, today.month), tema)} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-brand-strong hover:bg-brand-soft">Voltar para o mês atual</Link> : null}
          <PrintButton label="Imprimir mês" />
        </div>
      </div>

      <nav aria-label="Filtrar por tema" className="scrollbar-none -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap print:hidden">
        {filterOptions.map(([key, label]) => (
          <Link key={key ?? "todos"} href={calendarHref(current, key)} aria-current={tema === key ? "true" : undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-paper-raised px-4 text-xs font-medium text-ink-soft transition-colors hover:bg-brand-soft aria-[current=true]:border-brand aria-[current=true]:bg-brand aria-[current=true]:text-white">
            {key ? <span className={`mr-2 size-2 rounded-full ${CALENDAR_THEMES[key].dot}`} aria-hidden /> : null}
            {label}
          </Link>
        ))}
      </nav>

      {campaigns.length ? (
        <ul className="mb-6 space-y-2">
          {campaigns.map((campaign) => (
            <li key={campaign.title} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${campaign.chip}`}>
              <Megaphone size={18} className="shrink-0" aria-hidden />
              <span><strong className="font-semibold">{campaign.title}</strong> — {campaign.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="ui-card !p-2 sm:!p-4 xl:sticky xl:top-6">
          <table className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1">
            <caption className="sr-only">{monthTitle}{tema ? ` — ${CALENDAR_THEMES[tema].label}` : ""}</caption>
            <thead>
              <tr>{WEEKDAYS.map(([abbr, full]) => <th key={abbr} scope="col" className="pb-2 text-xs font-medium text-ink-soft"><abbr title={full} className="no-underline">{abbr}</abbr></th>)}</tr>
            </thead>
            <tbody>
              {weeks.map((week, row) => (
                <tr key={row}>
                  {week.map((day, col) => {
                    if (!day) return <td key={col} />;
                    const dayEvents = eventsOn(day);
                    const isToday = isCurrentMonth && day === today.day;
                    return (
                      <td key={col} aria-current={isToday ? "date" : undefined} className={`h-16 rounded-xl p-1 align-top sm:h-24 sm:p-1.5 ${isToday ? "bg-brand-soft ring-2 ring-brand" : dayEvents.length ? "bg-surface-muted" : "bg-paper"}`}>
                        <div className="flex h-full flex-col">
                          {dayEvents.length ? (
                            <a href={`#evento-${dayEvents[0].key}`} aria-label={`${day} de ${monthName}: ${dayEvents.map((event) => event.entry.title).join("; ")}`} className="w-fit rounded-md px-1 text-sm font-semibold hover:underline">{day}</a>
                          ) : (
                            <span className="px-1 text-sm text-ink-soft">{day}</span>
                          )}
                          <ul aria-hidden className="mt-1 hidden min-w-0 space-y-0.5 sm:block">
                            {dayEvents.slice(0, 2).map((event) => (
                              <li key={event.key} className={`line-clamp-2 break-words rounded-md px-1.5 py-0.5 text-xs leading-4 ${CALENDAR_THEMES[event.entry.theme].chip}`}>{event.entry.short}</li>
                            ))}
                            {dayEvents.length > 2 ? <li className="px-1.5 text-xs text-ink-soft">+{dayEvents.length - 2}</li> : null}
                          </ul>
                          <span aria-hidden className="mt-auto flex flex-wrap gap-0.5 px-1 pb-0.5 sm:hidden">
                            {dayEvents.map((event) => <span key={event.key} className={`size-1.5 rounded-full ${CALENDAR_THEMES[event.entry.theme].dot}`} />)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section aria-labelledby="month-events-title">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="month-events-title" className="text-base font-medium">Datas de {monthName}</h2>
            <span className="text-xs text-ink-soft">{events.length} {events.length === 1 ? "data" : "datas"}</span>
          </div>
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface-muted/40 px-5 py-10 text-center">
              <p className="font-medium">Nenhuma data comemorativa neste mês{tema ? " para o tema escolhido" : ""}.</p>
              <p className="mt-1 text-sm text-ink-soft">Avance para o próximo mês{tema ? " ou veja todos os temas" : ""}.</p>
              {tema ? <Link href={calendarHref(current)} className="task-action task-action-secondary mx-auto mt-4 w-fit">Ver todos os temas</Link> : null}
            </div>
          ) : (
            <ol className="space-y-3">
              {events.map((event) => <EventCard key={event.key} event={event} today={today} />)}
            </ol>
          )}
        </section>
      </div>

      <p className="mt-8 flex items-start gap-3 rounded-2xl bg-surface-muted p-4 text-sm leading-relaxed text-ink-soft">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-strong" aria-hidden />
        <span>Celebre com toda a turma: estas datas valorizam a diversidade e não devem expor diagnósticos. Antes de mencionar a condição de um estudante, converse com ele e com a família.</span>
      </p>
    </>
  );
}

function EventCard({ event, today }: { event: CalendarEvent; today: YMD }) {
  const { entry } = event;
  const theme = CALENDAR_THEMES[entry.theme];
  const daysAway = dayIndex(event.start) - dayIndex(today);
  const ongoing = daysAway <= 0 && dayIndex(today) <= dayIndex(event.end);
  const soon = ongoing || (daysAway > 0 && daysAway <= 7);
  const singleDay = dayIndex(event.start) === dayIndex(event.end);
  return (
    <li id={`evento-${event.key}`} className="scroll-mt-6 rounded-2xl border border-line bg-paper-raised p-5 target:ring-2 target:ring-brand print:break-inside-avoid">
      <div className="flex items-start gap-4">
        <div className={`flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 ${theme.chip}`}>
          <span className="text-2xl font-medium leading-none">{event.start.day}</span>
          <span className="mt-1 text-xs">{MONTH_SHORT[event.start.month - 1]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium leading-snug">{entry.title}</h3>
          <p className="mt-1 text-xs text-ink-soft">{singleDay ? `${WEEKDAYS[weekdayOf(event.start)][1]}, ` : ""}{dateRangeLabel(event)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${theme.chip}`}>{theme.label}</span>
            {soon ? <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-white">{relativeLabel(event, today)}</span> : null}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{entry.about}</p>
          <div className="mt-3 rounded-2xl bg-surface-muted p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand-strong"><Lightbulb size={14} aria-hidden /> Ideia para a turma</p>
            <p className="mt-1 text-sm leading-relaxed">{entry.idea}</p>
          </div>
          <p className="mt-3 text-xs text-ink-soft">Referência: {entry.origin}</p>
        </div>
      </div>
    </li>
  );
}
