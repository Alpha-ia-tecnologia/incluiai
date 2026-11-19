import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronDown, CircleCheck, FileText, HandHeart, Home, NotebookPen, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";
import { weekStart, formatDate } from "@/lib/dates";
import { db } from "@/lib/prisma";
import { requireFamilyPortal } from "@/lib/page-context";
import { familyActivityWhere, familyMaterialWhere, isFamilyOf } from "@/lib/policy";
import { markHomeActivityDone } from "@/actions/diary";
import { tellSchool } from "@/actions/family";
import { homeActivityNote, loadJourney, recordJourneyMark } from "@/lib/user-journey";
import { readList, firstName as firstNameOf, plural } from "@/lib/format";
import { periodLabel, reportData } from "@/lib/reports";
import { stepsFor } from "@/lib/support-steps";
import { familyGoalSentence, familyGoalTitle, familyWeek, pickGoals, weekWindow, type WeekItem } from "@/lib/family-portal";
import { withoutCodes } from "@/lib/without-codes";
import { activityImageUrl, imageWidthOf } from "@/lib/images/activity-image";
import { CONTENT_ID } from "@/lib/landmarks";
import { JourneyProgress } from "@/components/journey-ui";
import { PendingButton } from "@/components/pending-button";
import { ActionForm } from "@/components/action-form";
import { ReadAloud } from "@/components/read-aloud";
import { TextSizeControl } from "@/components/text-size-control";
import { PageHero, Card, SectionTitle } from "@/components/ui";
import { BUTTON_CLS } from "@/components/form-styles";
import { MaterialGalleryCard, materialSummary } from "@/components/materials/material-gallery";
import { SupportSteps } from "@/components/viz/support-steps";
import { Timeline } from "@/components/viz/timeline";
import { ShareForm } from "./share-form";

const WEEK_ICON: Record<WeekItem["kind"], LucideIcon> = {
  aulas: NotebookPen,
  atendimento: HandHeart,
  conquista: Trophy,
  casa: Home,
  material: BookOpen,
  relatorio: FileText,
};

const NOTES_SHOWN = 3;

export default async function FamilyStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const prisma = await db();
  const { id } = await params;
  const { user } = await requireFamilyPortal(id, "Portal da família");
  const week = weekWindow();
  const student = await prisma.student.findUniqueOrThrow({
    where: { id },
    include: {
      plans: { where: { status: "ativo" }, include: { objectives: { where: { status: "ativo" }, orderBy: { createdAt: "asc" } } } },
      familyNotes: { orderBy: { date: "desc" } },
      timeline: { where: { type: "conquista" }, orderBy: { date: "desc" }, take: 10 },
      diaryEntries: { orderBy: { date: "asc" }, select: { id: true, date: true, supportLevel: true, participation: true, objectiveId: true } },
      aeeSessions: { where: { date: { gte: week.since } }, select: { date: true, status: true } },
      activities: {
        where: familyActivityWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { image: { select: { altText: true, kind: true, createdAt: true } } },
      },
      materials: {
        where: familyMaterialWhere,
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, title: true, kind: true, status: true, content: true, createdAt: true, approvedAt: true, images: { where: { cardIndex: 0 }, select: { createdAt: true } } },
      },
    },
  });
  const isFamily = isFamilyOf(user, student.id);
  const [reports, prefs, checkIn] = await Promise.all([
    prisma.studentReport.findMany({ where: { studentId: student.id, status: "validado" }, orderBy: { periodEnd: "desc" }, take: 6, select: { id: true, data: true, validatedAt: true } }),
    isFamily ? prisma.user.findUnique({ where: { id: user.id }, select: { weeklyCheckIn: true } }) : null,
    prisma.familyCheckIn.findUnique({ where: { studentId_weekStart: { studentId: student.id, weekStart: weekStart() } }, select: { answers: true, note: true } }),
  ]);
  if (isFamily) await recordJourneyMark(user.id, "familia_inicio");
  const journey = isFamily ? await loadJourney(user) : null;
  const firstName = firstNameOf(student.name);
  const portal = `/familia/${id}`;
  const objectives = student.plans.flatMap((plan) => plan.objectives);
  const goals = pickGoals(objectives, student.diaryEntries);
  const otherGoals = objectives.filter((objective) => !goals.includes(objective));
  const weekItems = familyWeek({
    since: week.since,
    portal,
    firstName,
    lessons: student.diaryEntries,
    objectives,
    sessions: student.aeeSessions,
    conquests: student.timeline,
    activities: student.activities.map((activity) => ({ id: activity.id, title: activity.title, at: activity.decidedAt ?? activity.createdAt })),
    materials: student.materials.map((material) => ({ id: material.id, title: material.title, at: material.approvedAt ?? material.createdAt })),
    reports: reports.map((report) => ({ id: report.id, at: report.validatedAt })),
  });
  const lastLesson = student.diaryEntries.at(-1);
  const homeActivities = student.activities.map((activity) => ({ activity, doneAt: student.familyNotes.find((note) => note.note === homeActivityNote(activity.title))?.date }));
  const [recentNotes, olderNotes] = [student.familyNotes.slice(0, NOTES_SHOWN), student.familyNotes.slice(NOTES_SHOWN)];

  return (
    <>
      <PageHero
        character="care"
        title={`Acompanhamento de ${firstName}`}
        actions={<>
          <ReadAloud targetId={CONTENT_ID} label="Ouvir esta página" />
          <TextSizeControl />
          <Link href={`${portal}/privacidade`} className={BUTTON_CLS.quiet}><ShieldCheck size={16} aria-hidden /> Privacidade e acessos</Link>
        </>}
      />

      <div className="grid max-w-3xl gap-5">
        <Card id="semana" className="scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <SectionTitle>Esta semana na escola</SectionTitle>
            <p className="mb-4 text-sm text-ink-soft">{week.label}</p>
          </div>
          {weekItems.length ? (
            <ul className="divide-y divide-line">
              {weekItems.map((item) => <WeekLine key={item.key} item={item} />)}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nada registrado nesses 7 dias.{lastLesson ? ` O último registro de aula foi em ${formatDate(lastLesson.date)}.` : ""}</p>
          )}
        </Card>

        <Card id="contar" className="scroll-mt-24">
          <SectionTitle>Contar para a escola</SectionTitle>
          <ShareForm
            action={tellSchool.bind(null, id)}
            firstName={firstName}
            weekly={Boolean(prefs?.weeklyCheckIn)}
            previous={checkIn ? { answers: readList(checkIn.answers), note: checkIn.note ?? "" } : null}
          />
          {recentNotes.length ? (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="mb-2 text-sm font-medium text-ink">O que vocês já contaram</h3>
              <NoteList notes={recentNotes} />
              {olderNotes.length ? (
                <details className="group mt-1">
                  <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-strong [&::-webkit-details-marker]:hidden">
                    Ver os anteriores ({olderNotes.length}) <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <NoteList notes={olderNotes} />
                </details>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card id="plano" className="scroll-mt-24">
          <SectionTitle>O que {firstName} está aprendendo</SectionTitle>
          {goals.length === 0 ? (
            <p className="text-sm text-ink-soft">A escola ainda está montando o plano de {firstName}.</p>
          ) : (
            <ul className="-mt-1 divide-y divide-line">
              {goals.map((objective) => {
                const title = familyGoalTitle(objective.action, firstName);
                const steps = stepsFor(objective, student.diaryEntries);
                const sentence = familyGoalSentence(steps);
                return (
                  <li key={objective.id} className="min-w-0 py-4 first:pt-1 last:pb-0">
                    <h3 className="text-base font-medium leading-snug text-ink">{title}</h3>
                    <SupportSteps data={steps} audience="familia" name={title} className="mt-3" />
                    {sentence ? <p className="mt-3 text-sm leading-relaxed text-ink">{sentence}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
          {otherGoals.length ? (
            <details className="group mt-4 border-t border-line pt-3">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-strong [&::-webkit-details-marker]:hidden">
                {otherGoals.length === 1 ? "Mais 1 objetivo do plano" : `Mais ${otherGoals.length} objetivos do plano`} <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm text-ink">
                {otherGoals.map((objective) => <li key={objective.id}>{familyGoalTitle(objective.action, firstName)}</li>)}
              </ul>
            </details>
          ) : null}
        </Card>

        <Card id="casa" className="scroll-mt-24">
          <SectionTitle><span className="flex items-center gap-1.5"><Home size={14} aria-hidden /> Atividades para fazer em casa</span></SectionTitle>
          {homeActivities.length === 0 ? (
            <p className="text-sm text-ink-soft">A escola ainda não enviou atividades para casa.</p>
          ) : (
            <ul className="-mt-1 divide-y divide-line">
              {homeActivities.map(({ activity: a, doneAt }) => {
                const steps = readList(a.steps).map(withoutCodes);
                return (
                  <li key={a.id} className="min-w-0 py-4 first:pt-1 last:pb-0">
                    <p className="text-base font-medium leading-snug text-ink">{withoutCodes(a.title)}</p>
                    {doneAt ? <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-green"><CircleCheck size={16} aria-hidden /> Vocês fizeram em {formatDate(doneAt)}. A escola foi avisada.</p> : null}
                    {steps.length || a.image ? (
                      <details className="group mt-1">
                        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-strong [&::-webkit-details-marker]:hidden">
                          Como fazer{steps.length ? ` (${plural(steps.length, "passo", "passos")})` : ""} <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                        </summary>
                        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink">
                          {steps.map((step) => <li key={step}>{step}</li>)}
                        </ol>
                        {a.image ? (
                          <Image
                            src={activityImageUrl(a.id, a.image.createdAt)}
                            alt={a.image.altText}
                            width={imageWidthOf(a.image.kind)}
                            height={1024}
                            unoptimized
                            className="mt-3 h-auto w-full rounded-xl border border-line bg-white"
                          />
                        ) : null}
                      </details>
                    ) : null}
                    {isFamily ? (
                      <ActionForm action={markHomeActivityDone.bind(null, a.id)} className="mt-2">
                        <PendingButton className="inline-flex min-h-11 items-center gap-2 rounded-full border border-green/50 bg-green-soft px-4 text-sm font-medium text-green hover:bg-green-soft/70" pendingText="Avisando a escola...">
                          <CircleCheck size={16} aria-hidden /> {doneAt ? "Fizemos de novo" : "Fizemos esta atividade"}
                        </PendingButton>
                      </ActionForm>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {student.materials.length ? (
          <Card id="materiais" className="scroll-mt-24">
            <SectionTitle><span className="flex items-center gap-1.5"><BookOpen size={14} aria-hidden /> Materiais para usar em casa</span></SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {student.materials.map((material) => (
                <MaterialGalleryCard key={material.id} studentId={id} material={materialSummary({ ...material, title: withoutCodes(material.title) })} href={`${portal}/materiais/${material.id}`} />
              ))}
            </div>
          </Card>
        ) : null}

        {reports.length ? (
          <Card id="relatorios" className="scroll-mt-24">
            <SectionTitle><span className="flex items-center gap-1.5"><FileText size={14} aria-hidden /> Relatórios da escola</span></SectionTitle>
            <ul className="grid gap-2">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link href={`${portal}/relatorios/${report.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted/60 px-4 py-3 text-sm hover:bg-brand-soft">
                    <span className="font-medium text-ink">Período de {periodLabel(reportData(report.data))}</span>
                    {report.validatedAt ? <span className="text-xs text-ink-soft">Validado em {formatDate(report.validatedAt)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {student.timeline.length ? (
          <Card>
            <SectionTitle>Conquistas na escola</SectionTitle>
            <Timeline
              label={`Conquistas de ${firstName} na escola, da mais nova para a mais antiga`}
              items={student.timeline.slice(0, 3).map((event) => ({
                key: event.id,
                date: formatDate(event.date),
                title: withoutCodes(event.title),
                body: event.description ? withoutCodes(event.description) : undefined,
                marker: <Trophy size={16} />,
                markerClassName: "bg-amber-soft text-amber",
              }))}
            />
          </Card>
        ) : null}

        {journey ? <JourneyProgress journey={journey} layout="strip" /> : null}
      </div>
    </>
  );
}

function WeekLine({ item }: { item: WeekItem }) {
  const Icon = WEEK_ICON[item.kind];
  const body = (
    <>
      <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong"><Icon size={16} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-snug text-ink">{item.title}</span>
        {item.detail ? <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{item.detail}</span> : null}
      </span>
    </>
  );
  return (
    <li className="min-w-0">
      {item.href
        ? <Link href={item.href} className="-mx-2 flex min-h-11 gap-3 rounded-xl px-2 py-3 hover:bg-surface-muted/60">{body}</Link>
        : <div className="flex gap-3 py-3">{body}</div>}
    </li>
  );
}

function NoteList({ notes }: { notes: { id: string; note: string; author: string; date: Date }[] }) {
  return (
    <ul className="divide-y divide-line">
      {notes.map((note) => (
        <li key={note.id} className="py-2.5">
          <p className="text-sm leading-relaxed text-ink">“{withoutCodes(note.note)}”</p>
          <p className="mt-0.5 text-xs text-ink-soft">{note.author} · {formatDate(note.date)}</p>
        </li>
      ))}
    </ul>
  );
}
