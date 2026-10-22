import { BnccTag } from "@/components/bncc-tag";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { objectiveTrend, studentAlerts, strategiesThatWorked } from "@/lib/insights";
import { meetingQuestions } from "@/lib/materials";
import { parseJson, formatDate } from "@/lib/format";
import { CHANNELS, BARRIERS } from "@/lib/scale";
import { axisDate, countItems, supportSeries, type Trend } from "@/lib/series";
import { canSeePedagogicalDetail, getCurrentUser, requireStudentPage } from "@/lib/auth";
import { parseCaseStudy } from "@/lib/case-study";
import type { FunctionalProfile } from "@prisma/client";
import { Card, SectionTitle, Badge, SupportPill, EmptyState } from "@/components/ui";
import { DataBoard, DataCard, StatusPill, SupportBars, SupportChart } from "@/components/data-viz";
import { BarList } from "@/components/charts";
import { ChartFrame, CriterionBar, ParticipationDonut, SupportMeter, SupportSteps, TextChips, TREND_TONE } from "@/components/viz/student-viz";
import { TrendingDown, Minus, AlertTriangle, MessageCircleQuestion, ArrowRight, type LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const TREND_META: Record<Trend, { label: string; icon: LucideIcon }> = {
  avancando: { label: "Avançando", icon: TrendingDown },
  estavel: { label: "Estável", icon: Minus },
  atencao: { label: "Atenção", icon: AlertTriangle },
  sem_dados: { label: "Sem registros", icon: Minus },
};

// As 12 áreas de apoio de "Como aprende", na escala de 0 (IND) a 5 (FIS-T).
const PROFILE_SUPPORT = [
  { title: "Aprendizagem", fields: [["readingSupport", "Leitura"], ["writingSupport", "Escrita"], ["mathSupport", "Matemática"]] },
  { title: "Interação", fields: [["peerInteraction", "Interação com colegas"], ["adultInteraction", "Interação com adultos"], ["groupWork", "Trabalho em grupo"]] },
  { title: "Autonomia", fields: [["organization", "Organização"], ["feeding", "Alimentação"], ["hygiene", "Higiene"], ["mobility", "Locomoção"]] },
  { title: "Movimento", fields: [["fineMotor", "Coordenação fina"], ["grossMotor", "Coordenação ampla"]] },
] as const satisfies ReadonlyArray<{ title: string; fields: ReadonlyArray<readonly [keyof FunctionalProfile, string]> }>;

// No computador este cartão fica na coluna estreita: as barras descem para a
// linha de baixo, como no celular, para o nome da área e o nível caberem.
const NARROW_BARS = "lg:[&_li]:grid-cols-[minmax(0,1fr)_auto] lg:[&_li>span:nth-child(2)]:col-span-2 lg:[&_li>span:nth-child(2)]:row-start-2";

export default async function StudentOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStudentPage(id, "Resumo");
  const student = await prisma.student.findUniqueOrThrow({
    where: { id },
    include: {
      profile: true,
      plans: { include: { objectives: true }, orderBy: { createdAt: "desc" } },
      diaryEntries: { orderBy: { date: "asc" } },
      familyNotes: { orderBy: { date: "desc" }, take: 3 },
      intersectorReports: { orderBy: { createdAt: "desc" }, take: 1 },
      caseStudy: { select: { status: true, content: true } },
    },
  });
  const intersector = student.intersectorReports[0];
  const user = await getCurrentUser();
  // Família e terapeuta também abrem o resumo: os gráficos que mostram mais do
  // diário do que o resumo já mostrava (histórico completo, participação,
  // contagens) ficam só com a equipe pedagógica.
  const pedagogical = Boolean(user && canSeePedagogicalDetail(user.role));
  const caseSynthesis = parseCaseStudy(student.caseStudy?.content).sintese;


  const activePlan = student.plans.find((p) => p.status === "ativo");
  const objectives = activePlan?.objectives.filter((o) => o.status === "ativo") ?? [];
  const alerts = studentAlerts({ plans: student.plans, entries: student.diaryEntries });
  const worked = strategiesThatWorked(student.diaryEntries);
  const workedCounts = pedagogical ? countItems(student.diaryEntries.map((entry) => entry.whatWorked), 8) : [];
  const records = student.diaryEntries.length;
  const profile = student.profile;
  const interests = parseJson<string[]>(student.profile?.interests ?? null, []);
  const barriers = parseJson<string[]>(student.profile?.barriers ?? null, []);

  const stalledObjectives = objectives
    .filter((o) => objectiveTrend(o, student.diaryEntries).trend === "atencao")
    .map((o) => o.action);
  const questions = meetingQuestions({
    alerts, stalledObjectives, workedStrategies: worked,
    hasFamilyNote: student.familyNotes.length > 0, hasIntersector: Boolean(intersector),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {alerts.length > 0 ? (
          <Card className="border-coral/40 bg-coral-soft/40">
            <SectionTitle>O que precisa de atenção</SectionTitle>
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li key={a.kind} className="flex items-start gap-2 text-sm text-ink">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-coral" aria-hidden /> {a.message}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div>
          <SectionTitle>O que estamos trabalhando</SectionTitle>
          {objectives.length === 0 ? (
            <EmptyState
              character="planning"
              title="Vamos escolher o que trabalhar?"
              hint="No Plano de ensino, defina uma aprendizagem para acompanhar com o estudante."
              action={<Link href={`/estudantes/${id}/ppi`} className="task-action">Abrir plano de ensino</Link>}
            />
          ) : (
            <DataBoard>
              {objectives.map((obj) => {
                const insight = objectiveTrend(obj, student.diaryEntries);
                const meta = TREND_META[insight.trend];
                const Icon = meta.icon;
                const points = pedagogical ? supportSeries(student.diaryEntries, obj.id).map((point) => ({ date: axisDate(point.date), value: point.value })) : [];
                return (
                  <article key={obj.id} aria-label={`Objetivo: ${obj.action}`} className="dash-card min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 max-w-xl text-sm leading-relaxed text-ink">{obj.description}</p>
                      <StatusPill tone={TREND_TONE[insight.trend]}><Icon size={12} aria-hidden /> {meta.label}</StatusPill>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <span>Apoio atual:</span> <SupportPill level={obj.currentSupport} />
                      <span>→ apoio esperado:</span> <SupportPill level={obj.targetSupport} />
                      {obj.bnccCode ? <BnccTag code={obj.bnccCode} /> : null}
                    </div>
                    {pedagogical ? (
                      points.length >= 2 ? (
                        <div className="mt-4">
                          <ChartFrame>
                            <SupportChart points={points} start={obj.currentSupport} target={obj.targetSupport} height={140} label={`Nível de apoio em ${points.length} registros de aula: ${obj.action}`} />
                          </ChartFrame>
                        </div>
                      ) : points.length === 1 ? (
                        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                          <span>Primeiro registro ({points[0].date}):</span> <SupportMeter level={points[0].value} />
                          <span>Com dois registros ou mais, a evolução do apoio aparece aqui.</span>
                        </p>
                      ) : null
                    ) : insight.lastSupportLevels.length > 0 ? (
                      // Família e terapeuta veem só os últimos registros, como antes.
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                        <span>Últimos registros:</span>
                        <SupportSteps levels={insight.lastSupportLevels} label="Últimos níveis de apoio registrados, do mais antigo ao mais recente" />
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-ink-soft">{insight.message}</p>
                  </article>
                );
              })}
            </DataBoard>
          )}
        </div>

        {(pedagogical && records > 0) || worked.length > 0 ? (
          <div>
            <SectionTitle>Como foram as aulas</SectionTitle>
            <DataBoard>
              {pedagogical && records > 0 ? (
                <DataCard title="Participação e resultado das aulas" hint={`${records} ${records === 1 ? "registro de aula" : "registros de aula"} desde o início do acompanhamento.`}>
                  <div className="grid min-w-0 gap-6 md:grid-cols-2">
                    <div className="min-w-0">
                      <h4 className="mb-3 text-xs font-medium text-ink-soft">Participação</h4>
                      <ParticipationDonut id="resumo-participacao" entries={student.diaryEntries} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="mb-3 text-xs font-medium text-ink-soft">Resultado esperado</h4>
                      <CriterionBar entries={student.diaryEntries} />
                    </div>
                  </div>
                  <Link href={`/estudantes/${id}/diario#historico-registros`} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-strong underline-offset-4 hover:underline">
                    Ver os registros de aula <ArrowRight size={15} aria-hidden />
                  </Link>
                </DataCard>
              ) : null}
              {worked.length > 0 ? (
                <DataCard title="Estratégias que funcionaram" hint={pedagogical ? "Marcadas em “o que ajudou” no registro da aula. O número é quantas vezes cada uma foi marcada." : "Marcadas em “o que ajudou” no registro da aula."}>
                  {pedagogical ? <BarList rows={workedCounts} /> : <TextChips items={worked} />}
                </DataCard>
              ) : null}
            </DataBoard>
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        {pedagogical ? (
          <Card>
            <SectionTitle>Estudo de caso</SectionTitle>
            {student.caseStudy?.status === "concluido" ? (
              <p className="line-clamp-5 text-sm leading-relaxed text-ink">{caseSynthesis}</p>
            ) : (
              <p className="text-sm leading-relaxed text-ink-soft">
                {student.caseStudy ? "Em andamento. Complete o que falta e registre a síntese do caso." : "Ainda não realizado. Ele reúne o que a família, a escola e o estudante contam para orientar o plano."}
              </p>
            )}
            <Link href={`/estudantes/${id}/estudo-de-caso`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand-strong underline-offset-4 hover:underline">
              {student.caseStudy?.status === "concluido" ? "Ver relatório completo" : student.caseStudy ? "Continuar estudo de caso" : "Fazer estudo de caso"}
            </Link>
          </Card>
        ) : null}
        <Card>
          <SectionTitle>Como este estudante aprende</SectionTitle>
          {!student.profile ? (
            <p className="text-sm text-ink-soft">
              Ainda precisamos conhecer como este estudante aprende.{" "}
              <Link href={`/estudantes/${id}/perfil`} className="font-medium text-brand-strong underline">
                Contar como ele aprende
              </Link>
            </p>
          ) : (
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-ink-soft">Comunicação</dt>
                <dd className="text-ink">{CHANNELS[student.profile.expressiveChannel] ?? student.profile.expressiveChannel} · compreende orientações com {student.profile.commandSteps} etapa(s)</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Do que gosta</dt>
                <dd className="mt-1 flex flex-wrap gap-1">{interests.map((i) => <Badge key={i} tone="amber">{i}</Badge>)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">O que dificulta a participação</dt>
                <dd className="mt-1 flex flex-wrap gap-1">{barriers.map((b) => <Badge key={b} tone="coral">{BARRIERS[b] ?? b}</Badge>)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Tempo de participação em uma atividade</dt>
                <dd className="text-ink">{student.profile.taskToleranceMinutes} min · melhor turno: {student.profile.bestShift === "manha" ? "manhã" : "tarde"}</dd>
              </div>
              {student.profile.strengths ? (
                <div>
                  <dt className="text-xs text-ink-soft">Pontos fortes</dt>
                  <dd className="leading-relaxed text-ink">{student.profile.strengths}</dd>
                </div>
              ) : null}
            </dl>
          )}
          {profile ? (
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-sm font-medium text-ink">Apoio de que precisa em cada área</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">De 0 (IND, faz com independência) a 5 (FIS-T, apoio físico total). Menos casas preenchidas, menos apoio.</p>
              <div className={`mt-4 space-y-4 ${NARROW_BARS}`}>
                {PROFILE_SUPPORT.map((group) => (
                  <div key={group.title} className="min-w-0">
                    <h4 className="mb-2 text-xs font-medium text-ink-soft">{group.title}</h4>
                    <SupportBars rows={group.fields.map(([field, label]) => ({ label, level: profile[field] }))} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <SectionTitle>A família observou</SectionTitle>
          {student.familyNotes.length === 0 ? (
            <p className="text-sm text-ink-soft">Nenhuma conquista registrada pela família ainda.</p>
          ) : (
            <ul className="space-y-3">
              {student.familyNotes.map((n) => (
                <li key={n.id} className="text-sm">
                  <p className="leading-relaxed text-ink">“{n.note}”</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{n.author} · {formatDate(n.date)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>
            <span className="flex items-center gap-1.5"><MessageCircleQuestion size={13} aria-hidden /> Perguntas para a reunião</span>
          </SectionTitle>
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q} className="flex items-start gap-2 text-sm text-ink">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden /> {q}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">Use estas perguntas para conversar com a equipe e a família.</p>
        </Card>

        {intersector ? (
          <Card>
            <SectionTitle>Orientações da equipe de saúde</SectionTitle>
            <p className="mb-2 text-xs text-ink-soft">{intersector.authorName} · {formatDate(intersector.createdAt)}</p>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ink-soft">Comunicação eficaz</dt><dd className="text-ink">{intersector.communication}</dd></div>
              <div><dt className="text-xs text-ink-soft">Estratégias a testar na escola</dt><dd className="text-ink">{intersector.strategiesToTry}</dd></div>
              <div><dt className="text-xs text-ink-soft">Como ajudar na escola</dt><dd className="text-ink">{intersector.schoolGuidance}</dd></div>
            </dl>
          </Card>
        ) : null}
      </div>
    </div>
  );
}


