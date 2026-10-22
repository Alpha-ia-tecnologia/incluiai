import { recentCheckIn } from "@/lib/notifications";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudentPage, canEditStudentRecord } from "@/lib/auth";
import { createDiaryEntry } from "@/actions/diary";
import { formatDate, parseJson } from "@/lib/format";
import { PARTICIPATION, CRITERION_MET, ROLES } from "@/lib/scale";
import { axisDate, supportSeries, supportTrend, TREND_TEXT, weeklyCounts } from "@/lib/series";
import { PageHeader, Card, SectionTitle, Badge, EmptyState } from "@/components/ui";
import { DataBoard, DataCard, MiniColumns, StatTile, StatusPill, SupportChart } from "@/components/data-viz";
import { ChartFrame, CriterionBar, ParticipationDonut, SupportMeter, TREND_TONE } from "@/components/viz/student-viz";
import { DiaryForm } from "@/components/diary-form";

export const dynamic = "force-dynamic";

const PARTICIPATION_TONES = { total: "green", parcial: "amber", recusou: "coral" } as const;
const CRITERION_TONES = { sim: "green", parcial: "amber", nao: "coral" } as const;

export default async function DiaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ activityId?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const viewer = await requireStudentPage(id, "Registrar aula (histórico)");
  // Aba de trabalho: quem só lê a ficha (Secretaria com motivo) fica no resumo.
  if (!canEditStudentRecord(viewer.role)) redirect(`/estudantes/${id}`);
  const [entries, objectives, acceptedActivities] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { studentId: id },
      include: { objective: true, activity: true },
      orderBy: { date: "desc" },
    }),
    prisma.objective.findMany({
      where: { plan: { studentId: id, status: "ativo" }, status: "ativo" },
      select: { id: true, action: true, criterion: true },
    }),
    prisma.activity.findMany({
      where: { studentId: id, status: "aceita" },
      select: { id: true, title: true, objectiveId: true },
    }),
  ]);

  const selectedActivity = acceptedActivities.find((activity) => activity.id === query.activityId);
  const initialObjectiveId = objectives.some((objective) => objective.id === selectedActivity?.objectiveId) ? selectedActivity?.objectiveId ?? "" : "";
  const create = createDiaryEntry.bind(null, id);

  // Resumo do histórico: tudo sai dos registros que a página já lista.
  const support = supportSeries(entries);
  const trend = supportTrend(support.map((point) => point.value));
  const weeks = weeklyCounts(entries.map((entry) => entry.date), 8);
  const recentRecords = weeks.reduce((sum, week) => sum + week.value, 0);
  const objectiveIds = new Set(entries.flatMap((entry) => (entry.objectiveId ? [entry.objectiveId] : [])));
  // A resposta da família à pergunta da semana, para quem vai registrar a aula.
  const checkIn = await recentCheckIn(id);
  // Com um único objetivo em todos os registros, o gráfico mostra também o início e a meta dele.
  const singleObjective = objectiveIds.size === 1 && entries.every((entry) => entry.objectiveId) ? entries[0].objective : null;

  return (
    <>
      <PageHeader level={2}
        title="Registrar aula ou atendimento"
        lede="Um registro de cada vez ajuda a entender o que funciona para este estudante. Preencha as três partes abaixo e salve no diário de acompanhamento."
        actions={entries.length > 0 ? <a href="#historico-registros" className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-brand-strong hover:bg-brand-soft">Ver registros anteriores</a> : undefined}
      />

      {checkIn ? (
        <Card className="mb-6 max-w-3xl bg-sky-soft/60">
          <SectionTitle>Da família, nesta semana</SectionTitle>
          <p className="text-sm leading-relaxed text-ink">{parseJson<string[]>(checkIn.answers, []).join(", ") || "Sem opções marcadas."}{checkIn.note ? ` "${checkIn.note}"` : ""}</p>
          <p className="mt-1 text-xs text-ink-soft">Respondido por {checkIn.authorName} em {formatDate(checkIn.createdAt)}.</p>
        </Card>
      ) : null}

      <Card className="mb-8 max-w-3xl">
        <SectionTitle>Novo registro</SectionTitle>
        <DiaryForm saveAction={create} studentId={id} objectives={objectives} activities={acceptedActivities} initialActivityId={selectedActivity?.id ?? ""} initialObjectiveId={initialObjectiveId} />
      </Card>

      <section id="historico-registros" className="max-w-3xl scroll-mt-6" aria-labelledby="history-title">
        <h2 id="history-title" className="mb-2 text-xl font-semibold text-ink">Registros anteriores</h2>
        <p className="mb-4 text-sm text-ink-soft">Os registros mais recentes aparecem primeiro. Observe a participação e o apoio necessário ao longo do tempo.</p>
        {entries.length > 0 ? (
          <DataBoard className="mb-5 sm:grid-cols-2">
            <DataCard
              title="Evolução do apoio"
              hint={`${objectiveIds.size > 1 ? "Todos os registros, de todos os objetivos," : "Todos os registros,"} do mais antigo ao mais recente.`}
              className="sm:col-span-2"
            >
              {trend.trend !== "sem_dados" ? (
                <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <StatusPill tone={TREND_TONE[trend.trend]}>{TREND_TEXT[trend.trend]}</StatusPill>
                  <span>Comparação entre a primeira e a segunda metade dos registros.</span>
                </p>
              ) : null}
              <ChartFrame>
                <SupportChart
                  points={support.map((point) => ({ date: axisDate(point.date), value: point.value }))}
                  start={singleObjective?.currentSupport}
                  target={singleObjective?.targetSupport}
                  label={`Nível de apoio em ${support.length} ${support.length === 1 ? "registro" : "registros"} de aula`}
                />
              </ChartFrame>
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
                hint={`Uma coluna por semana. Último registro em ${formatDate(entries[0].date)} · ${entries.length} no total.`}
                chart={<MiniColumns points={weeks} label="Registros de aula por semana, nas últimas 8 semanas" />}
              />
            </div>
          </DataBoard>
        ) : null}
        {entries.length === 0 ? (
          <EmptyState character="learning" title="O primeiro registro começa aqui" hint="Preencha o formulário acima depois de uma aula ou atendimento. O registro aparecerá neste espaço quando você salvar." />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{formatDate(entry.date)}</h3>
                  <span className="text-xs text-ink-soft">{ROLES[entry.authorRole] ?? entry.authorRole}</span>
                </div>
                {entry.objective ? <p className="mt-3 text-sm text-ink"><span className="font-medium">Objetivo: </span>{entry.objective.action}</p> : null}
                {entry.activity ? <p className="mt-1 text-sm text-ink"><span className="font-medium">Atividade: </span>{entry.activity.title}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={PARTICIPATION_TONES[entry.participation as keyof typeof PARTICIPATION_TONES] ?? "neutral"}>
                    Participação: {PARTICIPATION[entry.participation] ?? entry.participation}
                  </Badge>
                  <Badge tone={CRITERION_TONES[entry.criterionMet as keyof typeof CRITERION_TONES] ?? "neutral"}>
                    Resultado esperado: {CRITERION_MET[entry.criterionMet] ?? entry.criterionMet}
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