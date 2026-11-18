import { recentCheckIn } from "@/lib/notifications";
import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { createDiaryEntry } from "@/actions/diary";
import { readList } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { PARTICIPATION, CRITERION_MET, shortOf, toneOf } from "@/lib/scale";
import { roleLabel } from "@/lib/roles";
import { weeklyCounts } from "@/lib/series";
import { stepsByObjective } from "@/lib/support-steps";
import { PageHeader, Card, SectionTitle, Badge, EmptyState } from "@/components/ui";
import { ColumnChart } from "@/components/viz/charts";
import { DataBoard, DataCard, StatTile } from "@/components/viz/cards";
import { CriterionBar, ParticipationDonut, SupportMeter } from "@/components/viz/student-viz";
import { SupportSteps, TrendChip } from "@/components/viz/support-steps";
import { DiaryForm } from "@/components/diary-form";
import { accountAuthorRole, defaultObjectiveId, objectiveLabels } from "@/lib/lesson-log";
import { param } from "@/lib/search-params";

export default async function DiaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ activityId?: string | string[]; objetivo?: string | string[] }> }) {
  const prisma = await db();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { user, student } = await requireStudentPage(id, "Registrar aula (histórico)", { tab: "diario" });
  const [entries, objectives, acceptedActivities] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { studentId: id },
      include: { objective: true, activity: true },
      orderBy: { date: "desc" },
    }),
    prisma.objective.findMany({
      where: { plan: { studentId: id, status: "ativo" }, status: "ativo" },
      select: { id: true, action: true, condition: true, criterion: true, dimension: true, targetSupport: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activity.findMany({
      where: { studentId: id, status: "aceita" },
      select: { id: true, title: true, objectiveId: true },
    }),
  ]);

  const selectedActivity = acceptedActivities.find((activity) => activity.id === param(query.activityId));
  const initialObjectiveId = defaultObjectiveId(objectives, entries, [param(query.objetivo), selectedActivity?.objectiveId]);
  const labels = objectiveLabels(objectives, student.name);
  const objectiveOptions = objectives.map((objective) => ({ id: objective.id, label: labels.get(objective.id) ?? objective.action, criterion: objective.criterion }));
  const create = createDiaryEntry.bind(null, id);

  const supportGroups = stepsByObjective(entries);
  const weeks = weeklyCounts(entries.map((entry) => entry.date), 8);
  const recentRecords = weeks.reduce((sum, week) => sum + week.value, 0);
  const checkIn = await recentCheckIn(id);

  return (
    <>
      <PageHeader level={2}
        title="Registrar aula ou atendimento"
        actions={entries.length > 0 ? <a href="#historico-registros" className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-brand-strong hover:bg-brand-soft">Ver registros anteriores</a> : undefined}
      />

      {checkIn ? (
        <Card className="mb-6 max-w-3xl bg-sky-soft/60">
          <SectionTitle>Da família, nesta semana</SectionTitle>
          <p className="text-sm leading-relaxed text-ink">{readList(checkIn.answers).join(", ") || "Sem opções marcadas."}{checkIn.note ? ` "${checkIn.note}"` : ""}</p>
          <p className="mt-1 text-xs text-ink-soft">Respondido por {checkIn.authorName} em {formatDate(checkIn.createdAt)}.</p>
        </Card>
      ) : null}

      <Card className="mb-8 max-w-3xl">
        <SectionTitle>Novo registro</SectionTitle>
        <DiaryForm saveAction={create} studentId={id} objectives={objectiveOptions} activities={acceptedActivities} initialActivityId={selectedActivity?.id ?? ""} initialObjectiveId={initialObjectiveId} accountRole={accountAuthorRole(user.role)} />
      </Card>

      <section id="historico-registros" className="max-w-3xl scroll-mt-6" aria-labelledby="history-title">
        <h2 id="history-title" className="mb-4 text-xl font-semibold text-ink">Registros anteriores</h2>
        {entries.length > 0 ? (
          <DataBoard className="mb-5 sm:grid-cols-2">
            <DataCard
              title="Evolução do apoio"
              hint={supportGroups.length > 1 ? "Um quadro por objetivo." : undefined}
              className="sm:col-span-2"
            >
              <div className="space-y-6">
                {supportGroups.map((group) => (
                  <div key={group.key} className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="min-w-0 text-sm text-ink first-letter:uppercase">{group.name ?? "Sem objetivo do plano"}</h4>
                      <TrendChip reading={group.data.trend} />
                    </div>
                    <SupportSteps data={group.data} size="regular" name={group.name ?? "Sem objetivo do plano"} />
                  </div>
                ))}
              </div>
            </DataCard>
            <DataCard title="Participação">
              <ParticipationDonut id="diario-participacao" entries={entries} size={112} />
            </DataCard>
            <DataCard title="Resultado esperado">
              <CriterionBar entries={entries} />
            </DataCard>
            <div className="grid min-w-0 sm:col-span-2">
              <StatTile
                label="Registros nas últimas 8 semanas"
                value={recentRecords}
                hint={`${entries.length} no total · último em ${formatDate(entries[0].date)}.`}
                chart={<ColumnChart compact rows={weeks} label="Registros de aula por semana, nas últimas 8 semanas" />}
              />
            </div>
          </DataBoard>
        ) : null}
        {entries.length === 0 ? (
          <EmptyState character="learning" title="O primeiro registro começa aqui" hint="Ele aparece neste espaço depois de salvo." />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{formatDate(entry.date)}</h3>
                  <span className="text-xs text-ink-soft">{roleLabel(entry.authorRole)}</span>
                </div>
                {entry.objective ? <p className="mt-3 text-sm text-ink"><span className="font-medium">Objetivo: </span>{entry.objective.action}</p> : null}
                {entry.activity ? <p className="mt-1 text-sm text-ink"><span className="font-medium">Atividade: </span>{entry.activity.title}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={toneOf(PARTICIPATION, entry.participation)}>
                    Participação: {shortOf(PARTICIPATION, entry.participation)}
                  </Badge>
                  <Badge tone={toneOf(CRITERION_MET, entry.criterionMet)}>
                    Resultado esperado: {shortOf(CRITERION_MET, entry.criterionMet)}
                  </Badge>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft"><span className="font-medium">Apoio:</span> <SupportMeter level={entry.supportLevel} /></p>
                <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
                  {entry.note ? <p><span className="font-medium">O que aconteceu: </span>{entry.note}</p> : null}
                  {entry.whatWorked ? <p><span className="font-medium">O que ajudou: </span>{entry.whatWorked}</p> : null}
                  {entry.recommendation ? <p><span className="font-medium">Próximo encontro: </span>{entry.recommendation}</p> : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}