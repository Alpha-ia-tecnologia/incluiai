import { BnccTag } from "@/components/bncc-tag";
import Link from "next/link";
import { db } from "@/lib/prisma";
import { SUMMARY_SECTION } from "@/lib/audit";
import { objectiveTrend, studentAlerts, strategiesThatWorked } from "@/lib/insights";
import { meetingQuestions } from "@/lib/meeting-questions";
import { readList } from "@/lib/format";
import { formatDate, formatDateShort } from "@/lib/dates";
import { CHANNELS, BARRIERS, SHIFTS, TREND } from "@/lib/scale";
import { countItems, supportSeries } from "@/lib/series";
import { requireStudentPage } from "@/lib/page-context";
import { parseCaseStudy } from "@/lib/case-study";
import { guidanceForPlan, parseAccepted, reportStatus } from "@/lib/health-reports-core";
import { censusReference } from "@/lib/federal-guidance";
import { PROFILE_SUPPORT_GROUPS } from "@/lib/functional-profile";
import { Card, SectionTitle, Badge, SupportPill, EmptyState } from "@/components/ui";
import { DataBoard, DataCard, StatusPill, SupportBars, SupportChart } from "@/components/data-viz";
import { BarList } from "@/components/charts";
import { ChartFrame, CriterionBar, ParticipationDonut, SupportMeter, TREND_ICON } from "@/components/viz/student-viz";
import { AlertTriangle, MessageCircleQuestion, ArrowRight, ChevronDown, CircleCheck } from "lucide-react";

const NARROW_BARS = "lg:[&_li]:grid-cols-[minmax(0,1fr)_auto] lg:[&_li>span:nth-child(2)]:col-span-2 lg:[&_li>span:nth-child(2)]:row-start-2";

export default async function StudentOverview({ params }: { params: Promise<{ id: string }> }) {
  const prisma = await db();
  const { id } = await params;
  const { can } = await requireStudentPage(id, SUMMARY_SECTION);
  const student = await prisma.student.findUniqueOrThrow({
    where: { id },
    include: {
      profile: true,
      plans: { include: { objectives: true }, orderBy: { createdAt: "desc" } },
      diaryEntries: { orderBy: { date: "asc" } },
      familyNotes: { orderBy: { date: "desc" }, take: 3 },
      intersectorReports: { orderBy: { createdAt: "desc" }, take: 1 },
      caseStudy: { select: { status: true, content: true } },
      healthReports: { select: { status: true, reviewedAt: true, accepted: true } },
    },
  });
  const intersector = student.intersectorReports[0];
  const caseStudy = student.caseStudy && { status: student.caseStudy.status, content: parseCaseStudy(student.caseStudy.content) };
  const caseSynthesis = caseStudy?.content.sintese;
  const reportGuidance = guidanceForPlan(student.healthReports.filter((report) => report.reviewedAt).map((report) => parseAccepted(report.accepted)));
  const reportsToReview = can.clinical ? student.healthReports.filter((report) => reportStatus(report.status, report.reviewedAt).needsReview).length : 0;

  const activePlan = student.plans.find((p) => p.status === "ativo");
  const objectives = activePlan?.objectives.filter((o) => o.status === "ativo") ?? [];
  const alerts = studentAlerts({ plans: student.plans, entries: student.diaryEntries })
    .filter((alert) => alert.kind !== "sem_registro" || Boolean(activePlan) || student.diaryEntries.length > 0);
  const census = censusReference(caseStudy, Boolean(activePlan));
  const worked = strategiesThatWorked(student.diaryEntries);
  const workedCounts = countItems(student.diaryEntries.map((entry) => entry.whatWorked), 8);
  const records = student.diaryEntries.length;
  const profile = student.profile;
  const interests = readList(student.profile?.interests ?? null);
  const barriers = readList(student.profile?.barriers ?? null);

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
        {census.backed ? (
          <p className="flex items-start gap-2 rounded-2xl bg-green-soft px-4 py-3 text-sm text-green">
            <CircleCheck size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span><span className="font-medium">Censo Escolar:</span> com registro de referência ({census.records.join(", ")}).</span>
          </p>
        ) : (
          <Card className="border-amber/20 bg-amber-soft/50">
            <SectionTitle>Censo Escolar</SectionTitle>
            <p className="text-sm leading-relaxed text-ink">
              {census.pending
                ? `${census.pending} Enquanto for assim, ele não serve de registro de referência para a declaração.`
                : "Falta o registro de referência para declarar este estudante. O estudo de caso concluído já basta, e para concluir é preciso só a parte Essencial."}
            </p>
            <Link href={`/estudantes/${student.id}/estudo-de-caso${census.pending ? "?editar=1" : ""}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline">
              {census.pending ? "Rever o estudo de caso" : student.caseStudy ? "Concluir o estudo de caso" : "Fazer o estudo de caso"} <ArrowRight size={15} aria-hidden />
            </Link>
          </Card>
        )}
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
                const Icon = TREND_ICON[insight.trend];
                const points = supportSeries(student.diaryEntries, obj.id).map((point) => ({ date: formatDateShort(point.date), value: point.value }));
                return (
                  <article key={obj.id} aria-label={`Objetivo: ${obj.action}`} className="dash-card min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 max-w-xl text-sm leading-relaxed text-ink">{obj.description}</p>
                      <StatusPill tone={TREND[insight.trend].tone}><Icon size={12} aria-hidden /> {TREND[insight.trend].label}</StatusPill>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <span>Apoio atual:</span> <SupportPill level={obj.currentSupport} />
                      <span>→ apoio esperado:</span> <SupportPill level={obj.targetSupport} />
                      {obj.bnccCode ? <BnccTag code={obj.bnccCode} /> : null}
                    </div>
                    {points.length >= 2 ? (
                      <div className="mt-4">
                        <ChartFrame>
                          <SupportChart points={points} start={obj.currentSupport} target={obj.targetSupport} height={140} label={`Nível de apoio em ${points.length} registros de aula: ${obj.action}`} />
                        </ChartFrame>
                      </div>
                    ) : points.length === 1 ? (
                      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                        <span>Primeiro registro ({points[0].date}):</span> <SupportMeter level={points[0].value} />
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-ink-soft">{insight.message}</p>
                  </article>
                );
              })}
            </DataBoard>
          )}
        </div>

        {records > 0 || worked.length > 0 ? (
          <div>
            <SectionTitle>Como foram as aulas</SectionTitle>
            <DataBoard>
              {records > 0 ? (
                <DataCard title="Participação e resultado das aulas" hint={`${records} ${records === 1 ? "registro de aula" : "registros de aula"}.`}>
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
                <DataCard title="Estratégias que funcionaram" hint="Vezes marcada em “o que ajudou”.">
                  <BarList rows={workedCounts} />
                </DataCard>
              ) : null}
            </DataBoard>
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <Card>
          <SectionTitle>Estudo de caso</SectionTitle>
          {student.caseStudy?.status === "concluido" ? (
            <p className="line-clamp-5 text-sm leading-relaxed text-ink">{caseSynthesis}</p>
          ) : (
            <p className="text-sm leading-relaxed text-ink-soft">{student.caseStudy ? "Em andamento." : "Ainda não feito."}</p>
          )}
          <Link href={`/estudantes/${id}/estudo-de-caso`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand-strong underline-offset-4 hover:underline">
            {student.caseStudy?.status === "concluido" ? "Ver relatório completo" : student.caseStudy ? "Continuar estudo de caso" : "Fazer estudo de caso"}
          </Link>
          {reportsToReview ? (
            <Link href={`/estudantes/${id}/estudo-de-caso/laudos`} className="flex min-h-11 items-center gap-1.5 border-t border-line pt-2 text-sm font-medium text-brand-strong underline-offset-4 hover:underline">
              {reportsToReview} {reportsToReview === 1 ? "laudo com sugestões" : "laudos com sugestões"} para revisar <ArrowRight size={14} aria-hidden />
            </Link>
          ) : null}
        </Card>
        {reportGuidance.length ? (
          <Card>
            <SectionTitle>Orientações dos laudos</SectionTitle>
            <ul className="space-y-2">
              {reportGuidance.slice(0, 6).map((text) => (
                <li key={text} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden /> {text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">Aceitas pela equipe na revisão do laudo.</p>
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
                <dd className="mt-1 flex flex-wrap gap-1">{interests.map((i) => <Badge key={i} tone="mid">{i}</Badge>)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">O que dificulta a participação</dt>
                <dd className="mt-1 flex flex-wrap gap-1">{barriers.map((b) => <Badge key={b} tone="alert">{BARRIERS[b] ?? b}</Badge>)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Tempo de participação em uma atividade</dt>
                <dd className="text-ink">{student.profile.taskToleranceMinutes} min · melhor turno: {(SHIFTS[student.profile.bestShift] ?? student.profile.bestShift).toLowerCase()}</dd>
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
            <details className="group mt-5 border-t border-line pt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                <h3>Apoio de que precisa em cada área</h3>
                <ChevronDown size={18} aria-hidden className="shrink-0 text-ink-soft group-open:rotate-180 motion-safe:transition-transform" />
              </summary>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">0 (IND) é fazer sozinho; 5 (FIS-T), apoio físico total. Menos casas, menos apoio.</p>
              <div className={`mt-4 space-y-4 ${NARROW_BARS}`}>
                {PROFILE_SUPPORT_GROUPS.map((group) => (
                  <div key={group.title} className="min-w-0">
                    <h4 className="mb-2 text-xs font-medium text-ink-soft">{group.title}</h4>
                    <SupportBars rows={group.fields.map(({ key, label }) => ({ label, level: profile[key] }))} />
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </Card>

        {student.familyNotes.length ? (
          <Card>
            <SectionTitle>A família observou</SectionTitle>
            <ul className="space-y-3">
              {student.familyNotes.map((n) => (
                <li key={n.id} className="text-sm">
                  <p className="leading-relaxed text-ink">“{n.note}”</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{n.author} · {formatDate(n.date)}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

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

