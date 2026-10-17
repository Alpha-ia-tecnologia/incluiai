import Link from "next/link";
import { redirect } from "next/navigation";
import { Character } from "@/components/character";
import { EmptyState } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSchoolStaff } from "@/lib/auth";
import { studentAlerts } from "@/lib/insights";
import { getStudentNextStep } from "@/lib/student-journey";
import { loadJourney } from "@/lib/user-journey";
import { JourneyProgress, JourneyWelcome } from "@/components/journey-ui";
import { firstName, formatDate, formatDateShort } from "@/lib/format";
import { PARTICIPATION_TEXT, PARTICIPATION_TONE, TREND_TEXT, supportTrend, weeklyCounts } from "@/lib/series";
import { DotStrip, MiniColumns, Sparkline, StatTile, StatusPill, TONE_COLOR, type Tone } from "@/components/data-viz";
import { CALENDAR_THEMES, MONTH_SHORT, monthParam, relativeLabel, todayInBrazil, upcomingEvents } from "@/lib/commemorative-dates";
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, HelpCircle, Plus, School, Users } from "lucide-react";

export const dynamic = "force-dynamic";

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
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  // Só a data dos registros das últimas 8 semanas: basta para as colunas por
  // semana e para o número dos últimos 7 dias, com o mesmo recorte de estudantes.
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 8 * 7);
  const recordDates = (await prisma.diaryEntry.findMany({
    where: { studentId: { in: students.map((student) => student.id) }, date: { gte: since, lte: now } },
    select: { date: true },
  })).map((entry) => entry.date);
  const recentRecords = recordDates.filter((date) => date >= weekStart).length;
  const weekly = weeklyCounts(recordDates, 8, now);
  const pendingSuggestions = students.reduce((total, student) => total + student.activities.filter((activity) => activity.status === "sugerida").length, 0);
  const studentsWithSuggestions = students.filter((student) => student.activities.some((activity) => activity.status === "sugerida")).length;
  const shownStudents = students.slice(0, 4);
  const anyEntries = shownStudents.some((student) => student.diaryEntries.length > 0);
  const withAlerts = students.map((student) => ({
    student,
    alerts: studentAlerts({ plans: student.plans, entries: [...student.diaryEntries].reverse() }),
  })).filter((item) => item.alerts.length);
  const today = todayInBrazil();
  const upcomingDates = upcomingEvents(today).slice(0, 3);
  const managing = ["secretaria", "gestao"].includes(user.role);
  // Cada tipo de tarefa tem sua cor: registro (azul), atividades e recursos
  // (verde-água), acompanhamento (pêssego), cadastros (sálvia).
  const tasks = managing ? [
    { title: "Acompanhar a rede", description: "Veja os indicadores das escolas e as necessidades de atenção.", href: "/painel", icon: School, color: "bg-sky-soft", accent: "text-sky-ink" },
    { title: "Consultar um estudante", description: "Encontre o plano, os registros e a evolução de cada estudante.", href: "/estudantes?acao=acompanhar", icon: Users, color: "bg-peach-soft", accent: "text-peach-ink" },
    { title: "Organizar escolas e turmas", description: "Consulte e cadastre escolas e turmas da rede.", href: "/cadastros", icon: ClipboardList, color: "bg-sage-soft", accent: "text-sage-ink" },
  ] : [
    { title: "Registrar uma aula", description: "Conte como foi a participação e qual apoio foi necessário.", href: "/estudantes?acao=registrar", icon: ClipboardList, color: "bg-sky-soft", accent: "text-sky-ink" },
    { title: "Preparar uma atividade", description: "Escolha um estudante e planeje a próxima atividade.", href: "/estudantes?acao=preparar", icon: BookOpen, color: "bg-teal-soft", accent: "text-teal-ink" },
    { title: "Acompanhar um estudante", description: "Consulte o plano e veja o que está funcionando.", href: "/estudantes?acao=acompanhar", icon: Users, color: "bg-peach-soft", accent: "text-peach-ink" },
  ];

  return (
    <div className="dashboard-grid">
      <div className="min-w-0">
        {journey.welcomed ? null : <JourneyWelcome journey={journey} />}
        <section className="mb-7 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-3 text-sm text-ink-soft">Olá, {firstName(user.name)}.</p>
            <h1 className="max-w-xl font-display text-[34px] leading-[1.12] tracking-tight sm:text-[44px]">O que vamos fazer hoje?</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">Escolha uma tarefa para começar. Vamos orientar você em cada etapa.</p>
          </div>
          {journey.welcomed ? <Character variant="learning" className="hidden w-32 shrink-0 sm:block xl:w-36" preload /> : null}
        </section>

        <section aria-label="Tarefas do dia" className="grid gap-3">
          {tasks.map(({ title, description, href, icon: Icon, color, accent }) => (
            <Link key={href} href={href} className={`pastel-card group flex min-h-24 items-center gap-4 rounded-[22px] p-5 ${color}`}>
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/75 ${accent}`}><Icon size={22} strokeWidth={1.7} aria-hidden /></span>
              <div className="min-w-0 flex-1"><h2 className="text-base font-medium sm:text-lg">{title}</h2><p className="mt-1 text-sm leading-relaxed text-ink/80">{description}</p></div>
              <ArrowRight size={20} aria-hidden className={`shrink-0 transition-transform group-hover:translate-x-1 ${accent}`} />
            </Link>
          ))}
        </section>

        <details className="mt-4 rounded-2xl border border-line bg-paper-raised">
          <summary className="min-h-12 cursor-pointer px-5 py-4 text-sm font-medium">Primeira vez por aqui? Veja por onde começar</summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">
            <p>Escolha um estudante. Primeiro, conte como ele aprende; depois, defina um objetivo e prepare uma atividade. Após a aula, registre o que observou para acompanhar a evolução.</p>
            <Link href="/ajuda" className="task-action task-action-secondary mt-4 w-fit">Ver o passo a passo <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </details>

        <section className="mt-8" aria-labelledby="students-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="students-title" className="text-lg font-medium">Próximo passo por estudante</h2>
            <Link href="/estudantes" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong">Ver todos <ArrowRight size={16} aria-hidden /></Link>
          </div>
          {anyEntries ? (
            // Uma legenda para todos os cartões, em vez de repetir em cada um.
            <ul className="-mt-2 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft" aria-label="Como ler os minigráficos">
              <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-ink" /> Linha: apoio nas últimas aulas (subir é precisar de menos apoio)</li>
              {PARTICIPATION_LEGEND.map((item) => <li key={item.label} className="inline-flex items-center gap-1.5"><span aria-hidden className="hatch size-2.5 rounded-[3px]" style={{ backgroundColor: TONE_COLOR[item.tone] }} />{item.label}</li>)}
            </ul>
          ) : null}
          {students.length === 0 ? (
            <div><EmptyState title="Vamos começar pelo primeiro estudante?" hint="O cadastro permite reunir informações, preparar o plano de ensino e acompanhar as aulas." /><Link href="/estudantes/novo" className="task-action mt-4"><Plus size={18} aria-hidden /> Cadastrar primeiro estudante</Link></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {shownStudents.map((student) => {
                const next = getStudentNextStep({
                  id: student.id, caseStudy: (student.caseStudy?.status as "rascunho" | "concluido" | undefined) ?? null, hasProfile: !!student.profile, hasPlan: !!student.plans.length,
                  hasObjective: !!student.plans[0]?.objectives.length,
                  hasPreparedActivity: student.activities.some((activity) => ["aceita", "aplicada"].includes(activity.status)),
                  hasDiary: !!student.diaryEntries.length,
                });
                return (
                  <article key={student.id} className="flex flex-col rounded-[22px] border border-line bg-paper-raised p-5">
                    <h3 className="text-base font-medium"><Link href={`/estudantes/${student.id}`} className="inline-flex min-h-11 items-center hover:underline">{student.name}</Link></h3>
                    <p className="text-sm text-ink-soft">{student.gradeYear} · {student.className}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{student.school.name}</p>
                    <RecentLessons name={firstName(student.name)} entries={student.diaryEntries} />
                    <p className="mb-4 mt-4 text-sm leading-relaxed text-ink-soft">{next.description}</p>
                    <Link href={next.href} className="task-action task-action-secondary mt-auto">{next.label} <ArrowRight size={16} className="shrink-0" aria-hidden /></Link>
                    <p className="mt-3 text-xs leading-relaxed text-ink-soft">{student.diaryEntries[0] ? `Último registro: ${formatDate(student.diaryEntries[0].date)}` : "Ainda sem registros de aula"}</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <aside className="dashboard-side" aria-label="Resumo do acompanhamento">
        <JourneyProgress journey={journey} />
        <section className="mt-6" aria-labelledby="acompanhamento-titulo">
          <h2 id="acompanhamento-titulo" className="px-1 text-base font-medium">Seu acompanhamento</h2>
          <p className="mt-1 px-1 text-xs leading-relaxed text-ink-soft">Resumo dos estudantes ativos aos quais você tem acesso.</p>
          <div className="mt-3 grid min-w-0 gap-2.5">
            <StatTile label="Estudantes" value={students.length} hint={withAlerts.length ? `${withAlerts.length} com aviso de acompanhamento.` : "Nenhum aviso de acompanhamento."} />
            <StatTile
              label="Registros nos últimos 7 dias"
              value={recentRecords}
              chart={recordDates.length ? <MiniColumns points={weekly} label="Registros de aula por semana, nas últimas 8 semanas" /> : undefined}
              hint={recordDates.length ? "Colunas: registros por semana, nas últimas 8 semanas." : "Nenhum registro de aula nas últimas 8 semanas."}
            />
            <StatTile
              label="Sugestões de atividade para avaliar"
              value={pendingSuggestions}
              tone={pendingSuggestions ? "mid" : "good"}
              status={pendingSuggestions ? "Para avaliar" : "Em dia"}
              hint={pendingSuggestions ? `De ${studentsWithSuggestions} ${studentsWithSuggestions === 1 ? "estudante" : "estudantes"}. Aceite ou recuse na aba Atividades.` : "Nenhuma sugestão esperando avaliação."}
            />
          </div>
          <Link href="/painel" className="mt-2 inline-flex min-h-11 items-center gap-2 px-1 text-sm font-medium text-brand-strong">Ver painel de indicadores <ArrowRight size={16} aria-hidden /></Link>
        </section>

        <section className="mt-6" aria-labelledby="attention-title">
          <h2 id="attention-title" className="mb-3 text-base font-medium">Precisa de atenção</h2>
          {withAlerts.length ? <ul className="space-y-3">{withAlerts.slice(0, 3).map(({ student, alerts }) => (
            <li key={student.id}><Link href={`/estudantes/${student.id}`} className="block rounded-2xl bg-paper-raised p-4 transition-colors hover:bg-brand-soft"><span className="flex items-center justify-between gap-2 text-sm font-medium">{student.name}<ArrowRight size={16} className="shrink-0" aria-hidden /></span><span className="mt-2 block text-sm leading-relaxed text-ink-soft">{!student.diaryEntries.length && alerts[0].kind === "sem_registro" ? "Ainda sem registro de aula." : alerts[0].message}</span></Link></li>
          ))}</ul> : <p className="rounded-2xl bg-paper-raised p-4 text-sm leading-relaxed text-ink-soft">Nenhum aviso de acompanhamento no momento.</p>}
          {withAlerts.length > 3 ? <Link href="/estudantes" className="mt-2 inline-flex min-h-11 items-center text-sm text-brand-strong">Ver os demais estudantes <ArrowRight size={16} className="ml-2" aria-hidden /></Link> : null}
        </section>

        <section className="mt-6" aria-labelledby="dates-title">
          <h2 id="dates-title" className="mb-3 text-base font-medium">Próximas datas inclusivas</h2>
          {upcomingDates.length ? <ul className="space-y-2">{upcomingDates.map((event) => (
            <li key={event.key}><Link href={`/calendario?mes=${monthParam(event.start.year, event.start.month)}#evento-${event.key}`} className="flex items-center gap-3 rounded-2xl bg-paper-raised p-3 transition-colors hover:bg-brand-soft">
              <span className={`flex w-11 shrink-0 flex-col items-center rounded-xl py-1.5 ${CALENDAR_THEMES[event.entry.theme].chip}`}><span className="text-base font-medium leading-none">{event.start.day}</span><span className="text-[11px]">{MONTH_SHORT[event.start.month - 1]}</span></span>
              <span className="min-w-0"><span className="block text-sm font-medium leading-snug">{event.entry.title}</span><span className="mt-0.5 block text-xs text-ink-soft">{relativeLabel(event, today)}</span></span>
            </Link></li>
          ))}</ul> : <p className="rounded-2xl bg-paper-raised p-4 text-sm leading-relaxed text-ink-soft">Nenhuma data comemorativa nas próximas semanas.</p>}
          <Link href="/calendario" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong"><CalendarDays size={16} aria-hidden /> Ver calendário inclusivo</Link>
        </section>

        <Link href="/recursos" className="mt-6 block rounded-[20px] bg-teal-soft p-5">
          <Character variant="resources" className="mb-2 w-24" />
          <h2 className="text-base font-medium">Ideias para sua aula</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">Encontre atividades e materiais para apoiar a aprendizagem.</p>
          <span className="mt-4 flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong">Explorar recursos <ArrowRight size={16} aria-hidden /></span>
        </Link>
        <Link href="/ajuda" className="mt-4 flex min-h-12 items-center gap-2 text-sm font-medium text-brand-strong"><HelpCircle size={18} aria-hidden /> Ajuda e primeiros passos</Link>
      </aside>
    </div>
  );
}

const PARTICIPATION_LEGEND: { tone: Tone; label: string }[] = [{ tone: "good", label: "Toda a atividade" }, { tone: "mid", label: "Parte" }, { tone: "alert", label: "Recusou" }];

// Apoio e participação das últimas aulas do estudante, em miniatura. Os
// registros chegam do mais novo ao mais antigo; o gráfico lê em ordem de data.
function RecentLessons({ name, entries }: { name: string; entries: ReadonlyArray<{ id: string; date: Date; supportLevel: number; participation: string }> }) {
  if (!entries.length) return null;
  const lessons = [...entries].reverse();
  const levels = lessons.map((entry) => entry.supportLevel);
  const { trend } = supportTrend(levels);
  const count = lessons.length === 1 ? "na última aula" : `nas últimas ${lessons.length} aulas`;
  return (
    <div className="mt-4 grid min-w-0 gap-3 rounded-2xl bg-surface-muted/70 p-3">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-soft">Apoio {count}</p>
          {trend !== "sem_dados" ? <StatusPill tone={trend === "avancando" ? "good" : trend === "atencao" ? "alert" : "neutral"}>{TREND_TEXT[trend]}</StatusPill> : null}
        </div>
        {levels.length > 1
          ? <Sparkline values={levels} domain={[0, 5]} invert height={32} label={`Nível de apoio de ${name} ${count}: ${levels.join(", ")} (0 é independente, 5 é apoio físico total)`} />
          : <p className="text-xs text-ink-soft">Com dois registros, a linha do apoio aparece aqui.</p>}
      </div>
      <div className="min-w-0">
        <p className="mb-1.5 text-xs text-ink-soft">Participação {count}</p>
        <DotStrip
          label={`Participação de ${name} ${count}, da mais antiga à mais recente`}
          items={lessons.map((entry) => ({ key: entry.id, title: `${formatDateShort(entry.date)}: ${PARTICIPATION_TEXT[entry.participation] ?? entry.participation}`, tone: PARTICIPATION_TONE[entry.participation] ?? "neutral" }))}
        />
      </div>
    </div>
  );
}

