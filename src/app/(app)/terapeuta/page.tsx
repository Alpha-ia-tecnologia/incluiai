import Link from "next/link";
import { redirect } from "next/navigation";
import { studentConsent } from "@/lib/consent";
import { summarySeenByTeam } from "@/lib/audit";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/roles";
import { createIntersectorReport } from "@/actions/intersector";
import { loadJourney, recordJourneyMark } from "@/lib/user-journey";
import { JourneyProgress, JourneyWelcome } from "@/components/journey-ui";
import { readList, firstName as firstNameOf } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { CHANNELS } from "@/lib/scale";
import { withoutCodes } from "@/lib/without-codes";
import { PageHero, Card, SectionTitle } from "@/components/ui";
import { MultiChoiceField } from "@/components/choice-field";
import { BUTTON_CLS } from "@/components/form-styles";
import { ActionForm } from "@/components/action-form";
import {
  ACCESSIBILITY_RESOURCE_OPTIONS, COMMUNICATION_OPTIONS, FACILITATOR_OPTIONS, POSITIONING_OPTIONS,
  SCHOOL_GUIDANCE_OPTIONS, SHARED_GOAL_OPTIONS, STRATEGIES_TO_TRY_OPTIONS,
} from "@/lib/form-options";
import { Check, FileText } from "lucide-react";
import { ColumnChart, StatusPill } from "@/components/viz/charts";
import { DataBoard, StatTile } from "@/components/viz/cards";
import { monthlyCounts } from "@/lib/series";
import { Timeline } from "@/components/viz/timeline";
import { param, type SearchParams } from "@/lib/search-params";


export default async function TherapistPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const prisma = await db();
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/login");
  if (!can(user.role, "intersectorReports") || !user.studentIds.length) redirect("/");
  const asked = param(query.estudante);
  const studentId = asked && user.studentIds.includes(asked) ? asked : user.studentIds[0];
  await recordJourneyMark(user.id, "terapeuta_inicio");
  const [journey, linked] = await Promise.all([
    loadJourney(user),
    user.studentIds.length > 1 ? prisma.student.findMany({ where: { id: { in: user.studentIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const switcher = <StudentSwitcher students={linked} current={studentId} />;
  if (!(await studentConsent(studentId)).therapistLink) {
    return (
      <>
        <PageHero character="care" title="Orientações para a escola" lede="Você vê só o perfil funcional e as orientações que enviou. Os registros clínicos ficam no sistema de saúde." />
        {switcher}
        <Card className="max-w-2xl">
          <SectionTitle>Aguardando a autorização da família</SectionTitle>
          <p className="text-sm leading-relaxed text-ink-soft">Quando a família autorizar a conexão com a escola, você verá o perfil funcional e poderá enviar orientações.</p>
        </Card>
      </>
    );
  }

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      profile: true,
      intersectorReports: { orderBy: { createdAt: "desc" } },
    },
  });
  const reports = student.intersectorReports;
  const seenAt = await Promise.all(reports.map((report, index) => summarySeenByTeam(student.id, report.createdAt, index > 0 ? reports[index - 1].createdAt : null)));
  const latest = reports[0];
  const latestSeen = seenAt[0] ?? null;
  const p = student.profile;
  const interests = readList(p?.interests ?? null).map(withoutCodes);
  const create = createIntersectorReport.bind(null, student.id);
  const firstName = firstNameOf(student.name);

  return (
    <>
      <PageHero
        character="care"
        title="Orientações para a escola"
        lede="Você vê só o perfil funcional e as orientações que enviou. Os registros clínicos ficam no sistema de saúde."
      />
      {journey.welcomed ? <JourneyProgress journey={journey} layout="strip" /> : <JourneyWelcome journey={journey} />}
      {switcher}

      <section aria-label="Suas orientações" className="mb-6">
        <DataBoard className="sm:grid-cols-2">
          <StatTile
            label="Orientações enviadas"
            value={reports.length}
            hint={latest ? `A última em ${formatDate(latest.createdAt)}. Por mês, nos últimos 6.` : undefined}
            chart={reports.length ? <ColumnChart compact rows={monthlyCounts(reports.map((report) => report.createdAt), 6)} label="Orientações enviadas por mês, nos últimos 6 meses" /> : undefined}
          />
          <StatTile
            label="A escola recebeu"
            value={!latest ? "—" : latestSeen ? "Sim" : "Ainda não"}
            tone={latestSeen ? "good" : "mid"}
            status={!latest ? undefined : latestSeen ? "Recebido" : "Aguardando"}
            hint={!latest ? "Aparece depois da primeira orientação." : latestSeen ? `A equipe abriu o acompanhamento em ${formatDate(latestSeen)}.` : "A equipe ainda não abriu o acompanhamento desde a última orientação."}
          />
        </DataBoard>
      </section>

      <Card className="mb-6">
        <SectionTitle>Estudante acompanhado</SectionTitle>
        <p className="text-sm text-ink">
          <strong>{firstName}</strong> — {student.gradeYear}. {p ? `Comunicação: ${CHANNELS[p.expressiveChannel] ?? p.expressiveChannel}.` : "Perfil funcional ainda não preenchido pela escola."}
          {interests.length > 0 ? ` Interesses: ${interests.join(", ")}.` : ""}
        </p>
      </Card>

      <Card className="mb-8 max-w-3xl scroll-mt-24" id="novo-relatorio">
        <SectionTitle>Nova orientação para a escola</SectionTitle>
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">Os itens com * são obrigatórios.</p>
        <ActionForm action={create} className="grid gap-6">
          <MultiChoiceField name="communication" label="Formas de comunicação mais eficazes *" options={COMMUNICATION_OPTIONS} required />
          <MultiChoiceField name="accessResources" label="Recursos de acessibilidade utilizados *" options={ACCESSIBILITY_RESOURCE_OPTIONS} required />
          <MultiChoiceField name="positioning" label="Necessidades de posicionamento / mobilidade" options={POSITIONING_OPTIONS} />
          <MultiChoiceField name="facilitators" label="Fatores que facilitam a participação *" options={FACILITATOR_OPTIONS} required />
          <MultiChoiceField name="strategiesToTry" label="Estratégias que podem ser testadas *" options={STRATEGIES_TO_TRY_OPTIONS} required />
          <MultiChoiceField name="schoolGuidance" label="Orientações aplicáveis à escola *" options={SCHOOL_GUIDANCE_OPTIONS} required />
          <MultiChoiceField name="sharedGoals" label="Objetivos compartilhados escola-família *" options={SHARED_GOAL_OPTIONS} required />
          <div>
            <button type="submit" className={BUTTON_CLS.primary}>
              Enviar para a equipe escolar
            </button>
          </div>
        </ActionForm>
      </Card>

      <div id="relatorios" className="scroll-mt-24"><SectionTitle>Orientações enviadas</SectionTitle></div>
      {reports.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhuma orientação enviada.</p>
      ) : (
        <Card className="min-w-0">
          <Timeline
            label="Orientações enviadas, da mais recente para a mais antiga"
            items={reports.map((r, index) => {
              const seen = seenAt[index];
              return {
                key: r.id,
                date: formatDate(r.createdAt),
                badge: seen ? <><StatusPill tone="good"><Check size={12} aria-hidden /> Visto pela escola</StatusPill><span className="text-sm text-ink-soft">em {formatDate(seen)}</span></>
                  : index === 0 ? <StatusPill tone="mid">Aguardando a escola abrir</StatusPill>
                    : <><StatusPill tone="neutral">Sem visualização</StatusPill><span className="text-sm text-ink-soft">uma orientação mais nova a substituiu</span></>,
                marker: seen ? <Check size={16} strokeWidth={3} /> : <FileText size={16} />,
                markerClassName: seen ? "bg-signal-lime text-ink-strong" : "border-2 border-dashed border-line bg-paper-raised text-ink-soft",
                title: `Orientação de ${r.authorName}`,
                body: <ReportDetails report={r} />,
              };
            })}
          />
        </Card>
      )}
    </>
  );
}

type Report = { communication: string; accessResources: string; positioning: string | null; facilitators: string; strategiesToTry: string; schoolGuidance: string; sharedGoals: string };

function ReportDetails({ report: r }: { report: Report }) {
  return (
    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-sm text-ink-soft">Comunicação eficaz</dt><dd className="text-ink">{r.communication}</dd></div>
      <div><dt className="text-sm text-ink-soft">Recursos de acessibilidade</dt><dd className="text-ink">{r.accessResources}</dd></div>
      {r.positioning ? <div><dt className="text-sm text-ink-soft">Posicionamento</dt><dd className="text-ink">{r.positioning}</dd></div> : null}
      <div><dt className="text-sm text-ink-soft">Fatores facilitadores</dt><dd className="text-ink">{r.facilitators}</dd></div>
      <div><dt className="text-sm text-ink-soft">Estratégias a testar</dt><dd className="text-ink">{r.strategiesToTry}</dd></div>
      <div><dt className="text-sm text-ink-soft">Orientações à escola</dt><dd className="text-ink">{r.schoolGuidance}</dd></div>
      <div><dt className="text-sm text-ink-soft">Objetivos compartilhados</dt><dd className="text-ink">{r.sharedGoals}</dd></div>
    </dl>
  );
}

function StudentSwitcher({ students, current }: { students: { id: string; name: string }[]; current: string }) {
  if (students.length < 2) return null;
  return (
    <nav aria-label="Estudantes acompanhados" className="mb-6 flex min-w-0 flex-wrap items-center gap-2">
      <p className="text-sm font-medium text-ink">Estudante:</p>
      {students.map((student) => (
        <Link
          key={student.id}
          href={`/terapeuta?estudante=${student.id}`}
          aria-current={student.id === current ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm transition-colors ${student.id === current ? "bg-brand font-medium text-white" : "bg-surface-muted text-ink-soft hover:bg-line hover:text-ink"}`}
        >
          {firstNameOf(student.name)}
        </Link>
      ))}
    </nav>
  );
}
