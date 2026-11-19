import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_CARD_COOKIE, cardPath } from "@/lib/student-card";
import { CARD_TOKEN_PATTERN } from "@/lib/student-card-core";
import { EmptyState } from "@/components/ui";
import { Assurances } from "@/components/explain";
import { WorkQueue } from "@/components/work-queue";
import { getCurrentUser } from "@/lib/auth";
import { landingFor } from "@/lib/policy";
import { can, isLinkedRole } from "@/lib/roles";
import { loadWorkQueue } from "@/lib/work-queue";
import { loadJourney } from "@/lib/user-journey";
import { JourneyProgress, JourneyWelcome } from "@/components/journey-ui";
import { firstName } from "@/lib/format";
import { CALENDAR_THEMES, relativeLabel, upcomingEvents } from "@/lib/commemorative-dates";
import { MONTH_SHORT, brYmd, monthKey } from "@/lib/dates";
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, Eye, FileLock2, Plus, School, Users } from "lucide-react";

export default async function SchoolDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const pendingCard = (await cookies()).get(PENDING_CARD_COOKIE)?.value;
  if (pendingCard && CARD_TOKEN_PATTERN.test(pendingCard)) redirect(cardPath(pendingCard));
  if (isLinkedRole(user.role) && !user.studentIds.length) {
    return <><h1 className="mb-6 font-display text-3xl font-bold tracking-tight">Boas-vindas, {firstName(user.name)}</h1><EmptyState character="care" title="Seu acesso ainda precisa ser vinculado a um estudante" hint="Peça à equipe da escola para conferir seu cadastro. Depois disso, o acompanhamento aparecerá aqui." action={<Link className="task-action" href="/ajuda">Consultar a ajuda</Link>} /></>;
  }
  if (landingFor(user) !== "/") redirect(landingFor(user));
  const [journey, { queue, students }] = await Promise.all([loadJourney(user), loadWorkQueue(user)]);
  const today = brYmd();
  const upcomingDates = upcomingEvents(today).slice(0, 3);
  const managing = can(user.role, "adminTasks");
  const nominal = can(user.role, "seeNames");
  const tasks = managing ? [
    { title: user.schoolId ? "Acompanhar a escola" : "Acompanhar a rede", href: "/painel", icon: School, color: "bg-sky-soft", accent: "text-sky-ink" },
    { title: "Consultar um estudante", href: "/estudantes?acao=acompanhar", icon: Users, color: "bg-peach-soft", accent: "text-peach-ink" },
  ] : [
    { title: "Registrar uma aula", href: "/estudantes?acao=registrar", icon: ClipboardList, color: "bg-sky-soft", accent: "text-sky-ink" },
    { title: "Preparar uma atividade", href: "/estudantes?acao=preparar", icon: BookOpen, color: "bg-teal-soft", accent: "text-teal-ink" },
  ];
  const welcoming = !journey.welcomed;

  return (
    <div className="dashboard-grid">
      <div className="min-w-0">
        {welcoming ? <JourneyWelcome journey={journey} hero /> : null}
        <h1 className="mb-6 max-w-xl font-display text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl">O que vamos fazer hoje?</h1>

        <section aria-label="Atalhos" className="@container">
          <div className="grid gap-2.5 @lg:grid-cols-2">
          {tasks.map(({ title, href, icon: Icon, color, accent }) => (
            <Link key={href} href={href} className={`pastel-card group flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 ${color}`}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/75 ${accent}`}><Icon size={20} strokeWidth={1.7} aria-hidden /></span>
              <span className="min-w-0 flex-1 text-base font-medium leading-snug">{title}</span>
              <ArrowRight size={18} aria-hidden className={`shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none ${accent}`} />
            </Link>
          ))}
          </div>
          {nominal ? null : <Assurances className="mt-3" label="Acesso à ficha de um estudante" items={[{ icon: FileLock2, text: "Ficha só com motivo registrado" }, { icon: Eye, text: "A família vê quem acessou" }]} />}
        </section>

        {nominal && students === 0 ? (
          <div className="mt-8">
            <EmptyState character="learning" title="Vamos começar pelo primeiro estudante?" hint="O cadastro permite reunir informações, preparar o plano de ensino e acompanhar as aulas." action={<Link href="/estudantes/novo" className="task-action"><Plus size={18} aria-hidden /> Cadastrar primeiro estudante</Link>} />
          </div>
        ) : <WorkQueue queue={queue} />}
      </div>

      <aside className="dashboard-side" aria-label="Sua jornada e as próximas datas">
        {welcoming ? null : <JourneyProgress journey={journey} />}

        <section className={welcoming ? "" : "mt-6"} aria-labelledby="dates-title">
          <h2 id="dates-title" className="mb-3 text-base font-medium">Próximas datas inclusivas</h2>
          {upcomingDates.length ? <ul className="space-y-2">{upcomingDates.map((event) => (
            <li key={event.key}><Link href={`/calendario?mes=${monthKey(event.start.year, event.start.month)}#evento-${event.key}`} className="flex items-center gap-3 rounded-2xl bg-paper-raised p-3 transition-colors hover:bg-brand-soft">
              <span className={`flex w-11 shrink-0 flex-col items-center rounded-xl py-1.5 ${CALENDAR_THEMES[event.entry.theme].chip}`}><span className="text-base font-medium leading-none">{event.start.day}</span><span className="text-xs">{MONTH_SHORT[event.start.month - 1]}</span></span>
              <span className="min-w-0"><span className="block text-sm font-medium leading-snug">{event.entry.title}</span><span className="mt-0.5 block text-sm text-ink-soft">{relativeLabel(event, today)}</span></span>
            </Link></li>
          ))}</ul> : <p className="rounded-2xl bg-paper-raised p-4 text-sm leading-relaxed text-ink-soft">Nenhuma data comemorativa nas próximas semanas.</p>}
          <Link href="/calendario" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong"><CalendarDays size={16} aria-hidden /> Ver calendário inclusivo</Link>
        </section>
      </aside>
    </div>
  );
}
