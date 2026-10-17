import { prisma } from "@/lib/prisma";
import { createDiaryEntry } from "@/actions/diary";
import { formatDate } from "@/lib/format";
import { supportInfo, PARTICIPATION, CRITERION_MET, ROLES } from "@/lib/scale";
import { PageHeader, Card, SectionTitle, Badge, EmptyState } from "@/components/ui";
import { DiaryForm } from "@/components/diary-form";

export const dynamic = "force-dynamic";

const PARTICIPATION_TONES = { total: "green", parcial: "amber", recusou: "coral" } as const;
const CRITERION_TONES = { sim: "green", parcial: "amber", nao: "coral" } as const;

export default async function DiaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ activityId?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
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

  return (
    <>
      <PageHeader
        title="Registrar aula ou atendimento"
        lede="Um registro de cada vez ajuda a entender o que funciona para este estudante. Preencha as três partes abaixo e salve no diário de acompanhamento."
        actions={entries.length > 0 ? <a href="#historico-registros" className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-brand-strong hover:bg-brand-soft">Ver registros anteriores</a> : undefined}
      />

      <Card className="mb-8 max-w-3xl">
        <SectionTitle>Novo registro</SectionTitle>
        <DiaryForm saveAction={create} studentId={id} objectives={objectives} activities={acceptedActivities} initialActivityId={selectedActivity?.id ?? ""} initialObjectiveId={initialObjectiveId} />
      </Card>

      <section id="historico-registros" className="max-w-3xl scroll-mt-6" aria-labelledby="history-title">
        <h2 id="history-title" className="mb-2 text-lg font-semibold text-ink">Registros anteriores</h2>
        <p className="mb-4 text-sm text-ink-soft">Os registros mais recentes aparecem primeiro. Observe a participação e o apoio necessário ao longo do tempo.</p>
        {entries.length === 0 ? (
          <EmptyState title="O primeiro registro começa aqui" hint="Preencha o formulário acima depois de uma aula ou atendimento. O registro aparecerá neste espaço quando você salvar." />
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
                <p className="mt-2 text-sm text-ink-soft"><span className="font-medium">Apoio: </span>{supportInfo(entry.supportLevel).description}</p>
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