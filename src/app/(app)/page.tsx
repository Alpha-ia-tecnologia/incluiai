import Link from "next/link";
import { redirect } from "next/navigation";
import { Character } from "@/components/character";
import { EmptyState } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSchoolStaff } from "@/lib/auth";
import { ALERT_ACTIONS, studentAlerts } from "@/lib/insights";
import { getStudentNextStep } from "@/lib/student-journey";
import { loadJourney, type Journey } from "@/lib/user-journey";
import { ChapterMarks, JourneyToday, JourneyWelcome, type MarkState } from "@/components/journey-ui";
import { togglePin } from "@/actions/pins";
import { firstName, formatDateShort } from "@/lib/format";
import { CALENDAR_THEMES, MONTH_SHORT, monthParam, relativeLabel, todayInBrazil, upcomingEvents } from "@/lib/commemorative-dates";
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, HelpCircle, Pin, Plus, School, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;
const linkCls = "inline-flex min-h-11 items-center gap-2 text-sm font-bold text-pen underline underline-offset-4";
// Aba de cada passo, no papel da sua família: rosa = conhecer e ouvir,
// lilás = planejar, verde = preparar, azul = registrar.
const STEP_TAB: Record<number, string> = { 1: "bg-paper-pink", 2: "bg-paper-pink", 3: "bg-paper-lilac", 4: "bg-paper-green", 5: "bg-paper-blue" };

// Sem capítulo pendente, o "Hoje" oferece a tarefa de rotina de cada perfil.
function todayFallback(journey: Journey) {
  if (journey.kind === "professor" && journey.focus) {
    const name = firstName(journey.focus.name);
    const waiting = journey.chapters.find((chapter) => chapter.status === "aguardando");
    return {
      title: `Você está em dia com ${name}`,
      text: waiting
        ? `Só falta ${waiting.title.charAt(0).toLowerCase()}${waiting.title.slice(1)}, que fica com a professora do AEE. Enquanto isso, registre cada aula para acompanhar o que está funcionando.`
        : "A cada aula, um novo registro mostra o que está funcionando e orienta a próxima.",
      action: { label: "Registrar uma aula", href: `/estudantes/${journey.focus.id}/diario` },
    };
  }
  if (journey.kind === "professor") {
    return { title: "Comece pelo primeiro estudante", text: "Quando um estudante da sua escola for cadastrado, o acompanhamento dele aparece aqui.", action: { label: "Ver estudantes", href: "/estudantes" } };
  }
  return {
    title: journey.kind === "rede" ? "A rede está em dia" : "A escola está em dia",
    text: "Os capítulos que dependem de você estão concluídos. O painel mostra onde as equipes precisam de apoio.",
    action: { label: "Abrir o painel", href: "/painel" },
  };
}

export default async function SchoolDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (["familia", "terapeuta"].includes(user.role) && !user.studentId) {
    return <><h1 className="mb-6 text-3xl">Boas-vindas, {firstName(user.name)}</h1><EmptyState title="Seu acesso ainda precisa ser vinculado a um estudante" hint="Peça à equipe da escola para conferir seu cadastro. Depois disso, o acompanhamento aparecerá aqui." /><Link className="task-action mt-4" href="/ajuda">Consultar a ajuda</Link></>;
  }
  if (user.role === "familia") redirect(`/familia/${user.studentId}`);
  if (user.role === "terapeuta") redirect("/terapeuta");
  const journey = await loadJourney(user);
  const scoped = isSchoolStaff(user.role) && user.schoolId;
  const students = await prisma.student.findMany({
    where: { status: "ativo", ...(scoped ? { schoolId: user.schoolId! } : {}) },
    include: {
      school: true,
      caseStudy: { select: { status: true } },
      profile: { select: { id: true } },
      plans: { where: { status: "ativo" }, orderBy: { createdAt: "desc" }, take: 1, include: { objectives: { where: { status: "ativo" }, select: { id: true }, take: 1 } } },
      diaryEntries: { orderBy: { date: "desc" }, take: 10 },
      activities: { where: { status: { in: ["sugerida", "aceita", "aplicada"] } }, select: { status: true } },
    },
    orderBy: { name: "asc" },
  });
  // O que a pessoa fixou no próprio mural sobe para o topo.
  const pins = await prisma.pinnedStudent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { studentId: true } });
  const pinnedOrder = new Map(pins.map((pin, index) => [pin.studentId, index]));
  const board = [...students].sort((a, b) => (pinnedOrder.get(a.id) ?? Infinity) - (pinnedOrder.get(b.id) ?? Infinity));
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const recentRecords = await prisma.diaryEntry.count({
    where: { studentId: { in: students.map((student) => student.id) }, date: { gte: weekStart, lte: new Date() } },
  });
  const pendingSuggestions = students.reduce((total, student) => total + student.activities.filter((activity) => activity.status === "sugerida").length, 0);
  const alertsByStudent = students.map((student) => ({
    student,
    alerts: studentAlerts({ plans: student.plans, entries: [...student.diaryEntries].reverse() }),
  }));
  const withAlerts = alertsByStudent.filter((item) => item.alerts.length);
  const today = todayInBrazil();
  const upcomingDates = upcomingEvents(today).slice(0, 3);
  const managing = ["secretaria", "gestao"].includes(user.role);
  // A rede olha escolas, não estudantes um a um.
  const network = journey.kind === "rede";
  // Quem lidera o estudo de caso é o AEE; na sala comum e no apoio ele não vira próximo passo.
  const caseStudyLedByOthers = ["professor_sala", "apoio"].includes(user.role);
  // A Secretaria é uma instituição: o título não usa o nome dela.
  const greetingName = journey.welcomed && user.role !== "secretaria" ? firstName(user.name) : null;

  const schools = network ? [...alertsByStudent.reduce((map, { student, alerts }) => {
    const row = map.get(student.schoolId) ?? { id: student.schoolId, name: student.school.name, total: 0, needing: 0, semPlano: 0, planoVencido: 0, semRegistro: 0 };
    row.total += 1;
    if (alerts.length) row.needing += 1;
    if (alerts.some((alert) => alert.kind === "sem_plano")) row.semPlano += 1;
    if (alerts.some((alert) => alert.kind === "plano_vencido")) row.planoVencido += 1;
    if (alerts.some((alert) => alert.kind === "sem_registro")) row.semRegistro += 1;
    return map.set(student.schoolId, row);
  }, new Map<string, { id: string; name: string; total: number; needing: number; semPlano: number; planoVencido: number; semRegistro: number }>()).values()]
    .sort((a, b) => b.needing - a.needing || a.name.localeCompare(b.name, "pt-BR")) : [];

  // Cada tarefa leva a aba da sua família de papel.
  const tasks = managing ? [
    { title: "Acompanhar a rede", href: "/painel", icon: School, tab: "bg-paper-blue" },
    { title: "Consultar um estudante", href: "/estudantes?acao=acompanhar", icon: Users, tab: "bg-paper-pink" },
    { title: "Organizar escolas e turmas", href: "/cadastros", icon: ClipboardList, tab: "bg-paper-lilac" },
  ] : [
    { title: "Registrar uma aula", href: "/estudantes?acao=registrar", icon: ClipboardList, tab: "bg-paper-blue" },
    { title: "Preparar uma atividade", href: "/estudantes?acao=preparar", icon: BookOpen, tab: "bg-paper-green" },
    { title: "Acompanhar um estudante", href: "/estudantes?acao=acompanhar", icon: Users, tab: "bg-paper-pink" },
  ];
  const summary: [number, string][] = network
    ? [[students.length, "estudantes no acompanhamento"], [schools.length, schools.length === 1 ? "escola" : "escolas"], [recentRecords, "registros de aula nos últimos 7 dias"]]
    : [[students.length, "estudantes"], [recentRecords, "registros nos últimos 7 dias"], [pendingSuggestions, "sugestões de atividade para avaliar"]];

  return (
    <div className="dashboard-grid">
      <div className="min-w-0">
        <h1 className="mb-6 max-w-2xl font-display text-[38px] font-extrabold leading-[1.05] text-ink sm:text-[46px]">
          {greetingName ? `O que vamos fazer hoje, ${greetingName}?` : "O que vamos fazer hoje?"}
        </h1>

        {journey.welcomed ? <JourneyToday journey={journey} fallback={todayFallback(journey)} character /> : <JourneyWelcome journey={journey} />}

        <section aria-labelledby="tarefas-titulo">
          <h2 id="tarefas-titulo" className="mb-3 text-sm font-bold text-ink">Outras tarefas</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {tasks.map(({ title, href, icon: Icon, tab }) => (
              <Link key={href} href={href} className="group flex min-h-14 items-center gap-3 rounded-md border border-line bg-paper-raised px-4 py-3 transition-colors hover:border-ink/40">
                <span aria-hidden className={`size-3.5 shrink-0 rounded-[3px] ${tab}`} />
                <Icon size={19} strokeWidth={1.8} aria-hidden className="shrink-0 text-ink" />
                <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{title}</span>
                <ArrowRight size={16} aria-hidden className="shrink-0 text-ink transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>

        {network ? (
          <section className="mt-8" aria-labelledby="schools-title">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="schools-title" className="font-display text-2xl font-extrabold">Escolas que precisam de apoio</h2>
              <Link href="/painel" className={linkCls}>Ver o painel <ArrowRight size={16} aria-hidden /></Link>
            </div>
            {schools.length === 0 ? (
              <EmptyState title="Nenhum estudante no acompanhamento ainda" hint="Quando as escolas cadastrarem estudantes, a situação de cada uma aparece aqui." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {schools.map((school) => {
                  const items = [
                    school.semPlano ? `${plural(school.semPlano, "estudante", "estudantes")} sem plano individual` : null,
                    school.planoVencido ? `${plural(school.planoVencido, "plano", "planos")} a revisar` : null,
                    school.semRegistro ? `${plural(school.semRegistro, "estudante", "estudantes")} sem registro de aula há mais de 7 dias` : null,
                  ].filter(Boolean);
                  return (
                    <li key={school.id}>
                      <Link href={`/painel?escola=${school.id}`} className="flex h-full flex-col rounded-md border border-line bg-paper-raised p-5 transition-colors hover:border-ink/40">
                        <span className="text-base font-bold">{school.name}</span>
                        <span className="mt-0.5 text-sm text-ink-soft">{plural(school.total, "estudante", "estudantes")} no acompanhamento</span>
                        {items.length ? (
                          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">{items.map((item) => <li key={item}>{item}</li>)}</ul>
                        ) : <p className="mt-4 text-sm text-ink-soft">Tudo em dia nesta escola.</p>}
                        <span className={`${linkCls} mt-auto pt-3`}>Ver a escola no painel <ArrowRight size={16} aria-hidden /></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <section className="mt-8" aria-labelledby="students-title">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 id="students-title" className="font-display text-2xl font-extrabold">{managing ? "Estudantes da escola" : "Próximo passo por estudante"}</h2>
              <Link href="/estudantes" className={linkCls}>Ver todos <ArrowRight size={16} aria-hidden /></Link>
            </div>
            <p className="mb-5 text-sm text-ink-soft">Fixe no mural quem você quer ver primeiro.</p>
            {students.length === 0 ? (
              <div><EmptyState title="Vamos começar pelo primeiro estudante?" hint="O cadastro permite reunir informações, preparar o plano individual e acompanhar as aulas." /><Link href="/estudantes/novo" className="task-action mt-4"><Plus size={18} aria-hidden /> Cadastrar primeiro estudante</Link></div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {board.slice(0, 4).map((student) => {
                  const pinned = pinnedOrder.has(student.id);
                  const hasPlan = !!student.plans.length;
                  const hasObjective = !!student.plans[0]?.objectives.length;
                  const hasPreparedActivity = student.activities.some((activity) => ["aceita", "aplicada"].includes(activity.status));
                  const next = getStudentNextStep({
                    id: student.id, caseStudy: (student.caseStudy?.status as "rascunho" | "concluido" | undefined) ?? null, hasProfile: !!student.profile, hasPlan,
                    hasObjective, hasPreparedActivity, hasDiary: !!student.diaryEntries.length, caseStudyLedByOthers,
                  });
                  // As cinco etapas do acompanhamento, marcadas como na folha da professora.
                  const steps: [string, boolean][] = [
                    ["Estudo de caso", student.caseStudy?.status === "concluido"], ["Como aprende", !!student.profile],
                    ["Plano e objetivo", hasPlan && hasObjective], ["Atividade preparada", hasPreparedActivity], ["Registro de aula", !!student.diaryEntries.length],
                  ];
                  const marks = steps.map(([title, done], index): { title: string; state: MarkState } => ({
                    title,
                    state: done ? "feito" : index + 1 === next.step ? "agora" : index === 0 && caseStudyLedByOthers ? "aguardando" : "aberto",
                  }));
                  const lastRecord = student.diaryEntries[0] ? `último registro ${formatDateShort(student.diaryEntries[0].date)}` : "sem registros de aula";
                  return (
                    <article key={student.id} className={`relative flex flex-col rounded-md border border-line bg-paper-raised ${pinned ? "mural-pinned" : ""}`}>
                      <span aria-hidden className={`block h-1.5 rounded-t-md ${STEP_TAB[next.step] ?? "bg-paper-blue"}`} />
                      <div className="flex flex-1 flex-col px-4 pb-3 pt-3 sm:px-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold leading-snug"><Link href={`/estudantes/${student.id}`} className="inline-block py-0.5 hover:underline">{student.name}</Link></h3>
                            <p className="text-sm text-ink-soft"><span className="whitespace-nowrap">{student.gradeYear}</span> · <span className="whitespace-nowrap">{student.className}</span> · <span className="whitespace-nowrap">{lastRecord}</span></p>
                          </div>
                          <form action={togglePin.bind(null, student.id)} className="-mr-2 shrink-0">
                            <button type="submit" aria-pressed={pinned} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink hover:bg-surface-muted aria-pressed:bg-surface-muted aria-pressed:font-bold">
                              <Pin size={15} aria-hidden className={pinned ? "fill-tack text-tack" : ""} /> {pinned ? "Fixado" : "Fixar"}<span className="sr-only"> {firstName(student.name)} no mural</span>
                            </button>
                          </form>
                        </div>
                        {managing ? null : <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{next.short}</p>}
                        <div className="mt-1.5 flex flex-col items-start gap-y-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3">
                          <ChapterMarks marks={marks} size="sm" label={`Etapas de ${firstName(student.name)}`} />
                          <Link href={managing ? `/estudantes/${student.id}` : next.href} className={linkCls}>
                            {managing ? "Ver acompanhamento" : next.label} <ArrowRight size={16} className="shrink-0" aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="dashboard-side space-y-6" aria-label="Resumo do acompanhamento">
        <section className="mural-sheet p-5">
          <h2 className="font-display text-lg font-bold">{network ? "A rede hoje" : "Seu acompanhamento"}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{network ? "Estudantes ativos em todas as escolas." : "Estudantes ativos aos quais você tem acesso."}</p>
          <dl className="mt-4 space-y-3">
            {summary.map(([value, label]) => (
              <div key={label} className="flex items-baseline gap-3"><dd className="min-w-10 font-display text-3xl font-extrabold tabular-nums text-pen">{value}</dd><dt className="text-sm leading-snug text-ink-soft">{label}</dt></div>
            ))}
          </dl>
          <Link href="/painel" className={`${linkCls} mt-3`}>Ver painel de indicadores <ArrowRight size={16} aria-hidden /></Link>
        </section>

        {network ? null : (
          <section className="mural-sheet p-5" aria-labelledby="attention-title">
            <h2 id="attention-title" className="font-display text-lg font-bold">Próximos passos da equipe</h2>
            {withAlerts.length ? <ul className="mt-2 divide-y divide-line">{withAlerts.slice(0, 3).map(({ student, alerts }) => (
              <li key={student.id}><Link href={`/estudantes/${student.id}${ALERT_ACTIONS[alerts[0].kind].path}`} className="flex min-h-12 items-center justify-between gap-2 py-2.5 hover:text-pen"><span><span className="block text-sm font-bold">{student.name}</span><span className="block text-sm leading-snug text-ink-soft">{ALERT_ACTIONS[alerts[0].kind].label}{alerts.length > 1 ? ` e mais ${alerts.length - 1}` : ""}</span></span><ArrowRight size={16} className="shrink-0" aria-hidden /></Link></li>
            ))}</ul> : <p className="mt-2 text-sm leading-relaxed text-ink-soft">Nenhum passo pendente no momento.</p>}
            {withAlerts.length > 3 ? <Link href="/estudantes" className={`${linkCls} mt-1`}>Ver os demais estudantes <ArrowRight size={16} aria-hidden /></Link> : null}
          </section>
        )}

        <section className="mural-sheet p-5" aria-labelledby="dates-title">
          <h2 id="dates-title" className="font-display text-lg font-bold">Próximas datas inclusivas</h2>
          {upcomingDates.length ? <ul className="mt-3 space-y-2">{upcomingDates.map((event) => (
            <li key={event.key}><Link href={`/calendario?mes=${monthParam(event.start.year, event.start.month)}#evento-${event.key}`} className="flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-surface-muted">
              <span className="relative flex w-11 shrink-0 flex-col items-center rounded-md border border-line bg-paper-raised py-1.5"><span aria-hidden className={`absolute right-1 top-1 size-1.5 rounded-full ${CALENDAR_THEMES[event.entry.theme].dot}`} /><span className="font-display text-base font-bold leading-none text-ink">{event.start.day}</span><span className="text-xs text-ink-soft">{MONTH_SHORT[event.start.month - 1]}</span></span>
              <span className="min-w-0"><span className="block text-sm font-bold leading-snug">{event.entry.title}</span><span className="mt-0.5 block text-xs text-ink-soft">{relativeLabel(event, today)}</span></span>
            </Link></li>
          ))}</ul> : <p className="mt-2 text-sm leading-relaxed text-ink-soft">Nenhuma data comemorativa nas próximas semanas.</p>}
          <Link href="/calendario" className={`${linkCls} mt-2`}><CalendarDays size={16} aria-hidden /> Ver calendário inclusivo</Link>
        </section>

        {managing ? null : (
          <Link href="/recursos" className="mural-sheet block p-5 transition-colors hover:border-ink/40">
            <Character variant="resources" className="mb-2 w-24" />
            <h2 className="font-display text-lg font-bold">Ideias para sua aula</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">Atividades e materiais do banco da rede.</p>
            <span className={`${linkCls} mt-2`}>Explorar recursos <ArrowRight size={16} aria-hidden /></span>
          </Link>
        )}
        <Link href="/ajuda" className="flex min-h-12 items-center gap-2 text-sm font-bold text-ink"><HelpCircle size={18} aria-hidden /> Ajuda e primeiros passos</Link>
      </aside>
    </div>
  );
}
