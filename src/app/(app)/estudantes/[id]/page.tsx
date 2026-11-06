import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ALERT_ACTIONS, objectiveTrend, studentAlerts, strategiesThatWorked } from "@/lib/insights";
import { meetingQuestions } from "@/lib/materials";
import { parseJson, formatDate } from "@/lib/format";
import { CHANNELS, BARRIERS, supportInfo, withoutSupportCodes } from "@/lib/scale";
import { logStudentAccess } from "@/actions/students";
import { canSeePedagogicalDetail, getCurrentUser } from "@/lib/auth";
import { parseCaseStudy } from "@/lib/case-study";
import { parseAccepted } from "@/lib/health-report";
import { Card, SectionTitle, Badge, SupportPill, EmptyState } from "@/components/ui";
import { TrendingDown, TrendingUp, Minus, Sparkles, MessageCircleQuestion, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const TREND_META = {
  avancando: { tone: "green" as const, label: "Avançando", icon: TrendingDown },
  estavel: { tone: "brand" as const, label: "Estável", icon: Minus },
  atencao: { tone: "amber" as const, label: "Precisa de ajuste", icon: TrendingUp },
  sem_dados: { tone: "neutral" as const, label: "Sem registros", icon: Minus },
};

export default async function StudentOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await prisma.student.findUniqueOrThrow({
    where: { id },
    include: {
      profile: true,
      plans: { include: { objectives: true }, orderBy: { createdAt: "desc" } },
      diaryEntries: { orderBy: { date: "asc" } },
      familyNotes: { orderBy: { date: "desc" }, take: 3 },
      intersectorReports: { orderBy: { createdAt: "desc" }, take: 1 },
      caseStudy: { select: { status: true, content: true } },
      healthReports: { orderBy: { createdAt: "desc" }, select: { status: true, reviewedAt: true, accepted: true } },
    },
  });
  const intersector = student.intersectorReports[0];
  const user = await getCurrentUser();
  const showCaseStudy = Boolean(user && canSeePedagogicalDetail(user.role));
  const caseSynthesis = parseCaseStudy(student.caseStudy?.content).sintese;
  // Laudos: orientações que a equipe aceitou na revisão e o que ainda espera revisão.
  const reportGuidance = [...new Set(student.healthReports.flatMap((report) => parseAccepted(report.accepted).guidance))];
  const reportsToReview = student.healthReports.filter((report) => report.status === "lido" && !report.reviewedAt).length;
  const reportsHref = `/estudantes/${id}/estudo-de-caso/laudos`;

  await logStudentAccess(id, "Resumo do acompanhamento");

  const activePlan = student.plans.find((p) => p.status === "ativo");
  const objectives = activePlan?.objectives.filter((o) => o.status === "ativo") ?? [];
  const alerts = studentAlerts({ plans: student.plans, entries: student.diaryEntries });
  const worked = strategiesThatWorked(student.diaryEntries);
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
          <Card>
            <SectionTitle>Próximos passos da equipe</SectionTitle>
            <ul className="divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.kind}>
                  <Link href={`/estudantes/${id}${ALERT_ACTIONS[a.kind].path}`} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm hover:text-brand-strong">
                    <span><span className="font-medium text-ink">{ALERT_ACTIONS[a.kind].label}</span><span className="block text-xs text-ink-soft">{a.message}</span></span>
                    <ArrowRight size={16} className="shrink-0 text-brand-strong" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div>
          <SectionTitle>O que estamos trabalhando</SectionTitle>
          {objectives.length === 0 ? (
            <div>
              <EmptyState
                title="Vamos escolher o que trabalhar?"
                hint="No plano individual, defina uma aprendizagem para acompanhar com o estudante."
              />
              <Link href={`/estudantes/${id}/ppi`} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
                Abrir plano individual
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {objectives.map((obj) => {
                const insight = objectiveTrend(obj, student.diaryEntries);
                const meta = TREND_META[insight.trend];
                const Icon = meta.icon;
                return (
                  <Card key={obj.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="max-w-xl text-sm leading-relaxed text-ink">{withoutSupportCodes(obj.description)}</p>
                      <Badge tone={meta.tone}><Icon size={12} aria-hidden /> {meta.label}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <span>Apoio atual:</span> <SupportPill level={obj.currentSupport} />
                      <span>→ apoio esperado:</span> <SupportPill level={obj.targetSupport} />
                      {obj.bnccCode ? <Badge>BNCC {obj.bnccCode}</Badge> : null}
                      {insight.lastSupportLevels.length > 0 ? (
                        <span className="w-full text-xs">
                          Apoio nos últimos registros: {insight.lastSupportLevels.map((level) => supportInfo(level).label).join(" → ")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-ink-soft">{insight.message}</p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {worked.length > 0 ? (
          <Card>
            <SectionTitle>Estratégias que funcionaram</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {worked.map((w) => (
                <Badge key={w} tone="green"><Sparkles size={11} aria-hidden /> {w}</Badge>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      <div className="space-y-5">
        {showCaseStudy ? (
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
            {reportsToReview ? (
              <p className="mt-2 border-t border-line pt-3 text-sm leading-relaxed text-ink">
                {reportsToReview === 1 ? "Um laudo tem sugestões" : `${reportsToReview} laudos têm sugestões`} para revisar.{" "}
                <Link href={reportsHref} className="inline-flex min-h-11 items-center font-bold text-pen underline underline-offset-4">Revisar sugestões</Link>
              </p>
            ) : null}
          </Card>
        ) : null}
        {showCaseStudy && reportGuidance.length ? (
          <Card>
            <SectionTitle>Orientações dos laudos</SectionTitle>
            <ul className="space-y-2">
              {reportGuidance.slice(0, 6).map((text) => (
                <li key={text} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" aria-hidden /> {text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">Lidas pela IA e aceitas pela equipe na revisão.</p>
            <Link href={reportsHref} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-pen underline underline-offset-4">
              {reportGuidance.length > 6 ? `Ver todas (${reportGuidance.length})` : "Ver laudos"}
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


