import Link from "next/link";
import { ConsentNote } from "@/components/consent-note";
import { aiAllowedFor } from "@/lib/consent";
import { prisma } from "@/lib/prisma";
import { createPlan, createObjective, markObjectiveStatus, reviewPlan, closePlan } from "@/actions/plan";
import { activatePlanDraft, discardPlanDraft, generatePlanDraft } from "@/actions/plan-ai";
import { formatDate } from "@/lib/format";
import { SUPPORT_LEVELS, DIMENSIONS } from "@/lib/scale";
import { CONDITION_SUGGESTIONS, CRITERION_SUGGESTIONS, buildObjectiveDescription } from "@/lib/objective";
import { isAIEnabled } from "@/lib/agents/model";
import { CASE_STUDY_REQUIRED_MESSAGE, isCaseStudyConcluded } from "@/lib/case-study";
import type { CaseAnalysis, PlanProposal, TraceStep } from "@/lib/agents/schemas";
import { ACCESSIBILITY_RESOURCE_OPTIONS, AEE_STRATEGY_OPTIONS, COMMON_ROOM_STRATEGY_OPTIONS, DEADLINE_WEEKS, INITIAL_SITUATION_OPTIONS } from "@/lib/form-options";
import { PageHeader, Card, SectionTitle, Badge, SupportPill, AIDisclaimer } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { ObjectiveFields } from "@/components/objective-fields";
import { BnccTag } from "@/components/bncc-tag";
import { Archive, ArrowRight, CalendarCheck, Sparkles, Trash2 } from "lucide-react";
import { canSeePedagogicalDetail, getCurrentUser, requireStudentPage, canEditStudentRecord } from "@/lib/auth";
import { canPlanDua } from "@/lib/dua/access";
import { DuaError } from "@/lib/dua/shared";
import { listStudentSupports, type SupportView } from "@/lib/dua/supports";
import { ReviewBadge } from "@/components/dua/dua-ui";
import { percentOf } from "@/lib/series";
import { CLOSE_REASONS, reviewSummary, suggestedNextReview } from "@/lib/plan-lifecycle";
import { DataBoard, DataCard, RingStat, StatusPill, TONE_COLOR, withSegmentColors, type Tone } from "@/components/data-viz";
import { HatchedDonut, Legend } from "@/components/charts";
import { ObjectiveScale } from "@/components/viz/student-viz";
import { dangerButtonCls, hintCls, inputCls, labelCls, primaryButtonCls as buttonCls, textareaCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const fieldStyle = { labelClassName: labelCls, inputClassName: inputCls };
const multiStyle = { legendClassName: labelCls, inputClassName: inputCls };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStudentPage(id, "Plano de ensino");
  // Quem só lê a ficha (Secretaria com motivo) vê o plano sem os formulários.
  const editable = canEditStudentRecord(viewer.role);
  const plans = await prisma.plan.findMany({
    where: { studentId: id },
    include: { objectives: { orderBy: { createdAt: "asc" } }, reviews: { orderBy: { reviewedAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  const plan = plans.find((p) => p.status === "ativo");
  // Planos encerrados continuam à vista: o acompanhamento não recomeça do zero.
  const pastPlans = plans.filter((p) => p.status === "encerrado");
  const overdue = plan && new Date(plan.reviewDate).getTime() < new Date().getTime();

  if (!plan && !editable) {
    return (
      <>
        <PageHeader level={2} title="Plano de ensino (PPI)" lede="Este estudante não tem plano ativo no momento." />
        <PastPlans plans={pastPlans} />
      </>
    );
  }

  if (!plan) {
    const create = createPlan.bind(null, id);
    const [draft, student] = await Promise.all([
      prisma.planDraft.findUnique({ where: { studentId: id } }),
      prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true, profile: { select: { id: true } }, caseStudy: { select: { id: true, status: true } } } }),
    ]);
    // Plano de ensino só com estudo de caso concluído (CA02): o servidor também barra.
    if (!isCaseStudyConcluded(student.caseStudy)) {
      return (
        <>
          <PageHeader level={2} title="Plano de ensino (PPI)" lede="O plano parte do estudo de caso: é ele que reúne a escuta da família, do estudante e a avaliação pedagógica." />
          <Card className="max-w-2xl border-amber-800/20 bg-amber-soft/50">
            <SectionTitle>Primeiro, conclua o estudo de caso</SectionTitle>
            <p className="text-sm leading-relaxed text-ink" role="status">{CASE_STUDY_REQUIRED_MESSAGE}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {student.caseStudy ? "O estudo de caso está em elaboração." : "O estudo de caso ainda não foi começado."} Atividades da turma com DUA não dependem disso e podem ser planejadas em Planejamento.
            </p>
            <Link href={`/estudantes/${id}/estudo-de-caso`} className={`${buttonCls} mt-4`}>
              {student.caseStudy ? "Continuar o estudo de caso" : "Começar o estudo de caso"} <ArrowRight size={16} aria-hidden />
            </Link>
          </Card>
        </>
      );
    }
    const hasData = Boolean(student.profile || student.caseStudy);
    // IA só com a autorização da família; o aviso explica quando falta.
    const aiOn = await aiAllowedFor(id);
    const consentMissing = isAIEnabled() && !aiOn;
    const generate = generatePlanDraft.bind(null, id);
    const manualForm = (
        <Card className="max-w-2xl">
          <SectionTitle>{draft ? "Preencher o plano do zero" : "Comece o plano do estudante"}</SectionTitle>
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">O plano individual orienta o trabalho da sala comum e do AEE. Preencha os campos com * e escolha quando a equipe voltará a avaliar o acompanhamento.</p>
          <form action={create} className="space-y-6">
            <MultiChoiceField name="initialSituation" label="O que o estudante já consegue fazer? *" options={INITIAL_SITUATION_OPTIONS} required hint="Marque o que se aplica e use Outro para acrescentar." {...multiStyle} />
            <MultiChoiceField name="commonRoomStrategies" label="Como apoiar na sala comum (opcional)" options={COMMON_ROOM_STRATEGY_OPTIONS} {...multiStyle} />
            <MultiChoiceField name="aeeStrategies" label="Como apoiar no AEE (opcional)" options={AEE_STRATEGY_OPTIONS} {...multiStyle} />
            <MultiChoiceField name="accessibilityResources" label="Recursos de acessibilidade (opcional)" options={ACCESSIBILITY_RESOURCE_OPTIONS} {...multiStyle} />
            <div>
              <label htmlFor="reviewDate" className={labelCls}>Quando a equipe vai revisar este plano? *</label>
              <input id="reviewDate" name="reviewDate" type="date" required className={inputCls} />
            </div>
            <button type="submit" className={buttonCls}>Salvar plano e definir objetivos <ArrowRight size={16} aria-hidden /></button>
          </form>
        </Card>
    );

    if (draft) {
      return (
        <>
          <PageHeader level={2} title="Plano de ensino (PPI)" lede="Revise a proposta, ajuste o que for preciso e escolha os objetivos. O plano só passa a valer quando você o ativar." />
          <ProposalReview
            studentId={id}
            studentName={student.name}
            proposal={JSON.parse(draft.content) as PlanProposal}
            analysis={draft.analysis ? (JSON.parse(draft.analysis) as CaseAnalysis) : null}
            trace={JSON.parse(draft.trace) as TraceStep[]}
            source={draft.source}
            createdBy={draft.createdBy}
            createdAt={draft.createdAt}
            aiOn={aiOn}
          />
          <details className="mt-6 max-w-2xl">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-strong">Prefere preencher o plano do zero?</summary>
            <div className="mt-3">{manualForm}</div>
          </details>
          <PastPlans plans={pastPlans} />
        </>
      );
    }

    return (
      <>
        <PageHeader level={2} title="Plano de ensino (PPI)" lede="Reúna o que o estudante já consegue fazer e os apoios que a equipe vai oferecer. Depois, defina os objetivos de aprendizagem." />
        <Card className="mb-6 max-w-2xl border-brand/30 bg-brand-soft/40">
          <SectionTitle><span className="flex items-center gap-2"><Sparkles size={16} aria-hidden /> {aiOn ? "Peça uma proposta aos agentes de IA" : "Peça uma proposta automática"}</span></SectionTitle>
          <ConsentNote show={consentMissing} />
          <p className="text-sm leading-relaxed text-ink-soft">
            {aiOn
              ? "Três agentes trabalham em sequência: o analista lê o estudo de caso, o planejador propõe objetivos e estratégias e o revisor confere tudo. Você revisa e decide antes de ativar o plano."
              : "O motor de regras monta uma proposta a partir do estudo de caso e de como o estudante aprende. Você revisa e decide antes de ativar o plano."}
          </p>
          {!aiOn ? <p className="mt-2 text-xs leading-relaxed text-ink-soft">A IA está desligada nesta instalação. Para usar os agentes, configure a chave ANTHROPIC_API_KEY no servidor.</p> : null}
          {hasData ? (
            <form action={generate} className="mt-4">
              <PendingButton className={buttonCls} pendingText={aiOn ? "Os agentes estão analisando o caso e montando o plano." : "Preparando a proposta…"} wait={aiOn ? "plano" : undefined}>
                <Sparkles size={16} aria-hidden /> Preparar proposta de plano
              </PendingButton>
            </form>
          ) : (
            <p className="mt-4 rounded-xl bg-paper-raised p-3 text-sm text-ink-soft">
              Para pedir uma proposta, faça antes o <Link href={`/estudantes/${id}/estudo-de-caso`} className="font-medium text-brand-strong underline underline-offset-4">estudo de caso</Link> ou preencha <Link href={`/estudantes/${id}/perfil`} className="font-medium text-brand-strong underline underline-offset-4">Como aprende</Link>.
            </p>
          )}
        </Card>
        {manualForm}
        <PastPlans plans={pastPlans} />
      </>
    );
  }

  const addObjective = createObjective.bind(null, id, plan.id);
  const review = reviewPlan.bind(null, id, plan.id);
  const close = closePlan.bind(null, id, plan.id);
  const reviews = reviewSummary(plan.reviews);
  const hasActiveObjectives = plan.objectives.some((objective) => objective.status === "ativo");
  // Apoios de atividades com DUA ligados aos objetivos deste plano, agrupados por objetivo.
  const dua = await linkedDuaSupports(id);
  const duaByObjective = plan.objectives
    .map((objective) => ({ objective, supports: dua.supports.filter((support) => (support.data.planLinks ?? []).some((link) => link.planId === plan.id && link.objectiveId === objective.id)) }))
    .filter((group) => group.supports.length);
  const latestSupport = await latestSupportByObjective(id, plan.objectives.map((objective) => objective.id));

  // Prazo do plano: quanto do tempo entre a criação e a revisão já passou.
  const today = new Date();
  const elapsed = percentOf(today.getTime() - plan.createdAt.getTime(), new Date(plan.reviewDate).getTime() - plan.createdAt.getTime());
  const elapsedPct = elapsed === null ? null : Math.min(100, Math.max(0, elapsed));
  const daysLeft = daysUntil(new Date(plan.reviewDate), today);
  const reviewTone: Tone = overdue || daysLeft < 0 ? "alert" : daysLeft <= 14 ? "mid" : "info";
  const reviewStatus = daysLeft < 0 ? "Data de revisão passou" : daysLeft === 0 ? "Revisão hoje" : daysLeft <= 14 ? "Revisão próxima" : "No prazo";
  const countStatus = (status: string) => plan.objectives.filter((objective) => objective.status === status).length;
  const objectiveStatus = withSegmentColors([
    { key: "ativo", label: "Ativos", value: countStatus("ativo") },
    { key: "alcancado", label: "Alcançados", value: countStatus("alcancado") },
    { key: "em_revisao", label: "Em revisão", value: countStatus("em_revisao") },
  ]);

  return (
    <>
      <PageHeader level={2}
        title="Plano de ensino (PPI)"
        lede={`Criado em ${formatDate(plan.createdAt)} · data de revisão: ${formatDate(plan.reviewDate)}`}
        actions={overdue ? <Badge tone="coral">Hora de revisar com a equipe</Badge> : <Badge tone="green">Plano ativo</Badge>}
      />

      {/* O próximo passo segue a regra da jornada (botão no cabeçalho da ficha). Só
          quando o passo é aqui mesmo (plano sem objetivo ativo) o cartão leva ao formulário. */}
      {editable && !hasActiveObjectives ? (
        <Card className="mb-6 border-brand/30 bg-brand-soft/50">
          <SectionTitle>Próximo passo: definir um objetivo</SectionTitle>
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">O plano foi criado. Agora, descreva abaixo uma aprendizagem que você poderá observar nas próximas aulas.</p>
          <Link href="#novo-objetivo" className={buttonCls}>
            Definir o objetivo <ArrowRight size={16} aria-hidden />
          </Link>
        </Card>
      ) : null}

      <SectionTitle>Andamento do plano</SectionTitle>
      <DataBoard className="mb-6 md:grid-cols-2">
        <DataCard title="Até a revisão do plano">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <RingStat id="ppi-prazo" value={elapsedPct} label="Tempo do plano já percorrido" size={96} color={TONE_COLOR[reviewTone]} />
            <div className="min-w-0 flex-1 basis-40">
              <p className="font-display text-3xl leading-none tracking-tight text-ink tabular-nums">
                {daysLeft === 0 ? "Hoje" : Math.abs(daysLeft)}
                {daysLeft !== 0 ? <span className="ml-1 text-xl text-ink-soft">{Math.abs(daysLeft) === 1 ? "dia" : "dias"}</span> : null}
              </p>
              <p className="mt-2"><StatusPill tone={reviewTone}>{reviewStatus}</StatusPill></p>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                {daysLeft > 0 ? `${daysLeft === 1 ? "Falta 1 dia" : `Faltam ${daysLeft} dias`} para a revisão, em ${formatDate(plan.reviewDate)}.` : daysLeft < 0 ? `A data de revisão (${formatDate(plan.reviewDate)}) passou há ${-daysLeft} ${daysLeft === -1 ? "dia" : "dias"}.` : `A revisão está marcada para hoje, ${formatDate(plan.reviewDate)}.`}
                {" "}{elapsedPct === null ? "Sem base para calcular o tempo percorrido." : `O anel mostra o tempo já percorrido desde a criação do plano: ${elapsedPct}%.`}
              </p>
            </div>
          </div>
        </DataCard>
        <DataCard title="Situação dos objetivos">
          {plan.objectives.length ? (
            <div className="flex min-w-0 flex-wrap items-center gap-4">
              <HatchedDonut id="ppi-objetivos" segments={objectiveStatus} size={96} thickness={13} label={`Objetivos do plano: ${objectiveStatus.map((segment) => `${segment.label.toLowerCase()} ${segment.value}`).join(", ")}`}>
                <span className="font-display text-2xl leading-none text-ink tabular-nums">{plan.objectives.length}</span>
                <span className="mt-0.5 text-xs text-ink-soft">{plan.objectives.length === 1 ? "objetivo" : "objetivos"}</span>
              </HatchedDonut>
              <div className="min-w-0 flex-1 basis-40"><Legend segments={objectiveStatus} /></div>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Nenhum objetivo no plano ainda. Defina o primeiro logo abaixo.</p>
          )}
        </DataCard>
      </DataBoard>

      {/* Revisão com a equipe: aberta quando a data está perto ou já passou. */}
      <Card id="revisao" className="mb-6 max-w-3xl scroll-mt-6">
        <SectionTitle>Revisão do plano</SectionTitle>
        <p className="mb-4 text-sm leading-relaxed text-ink-soft">
          {reviews.total
            ? `${reviews.total} ${reviews.total === 1 ? "revisão registrada" : "revisões registradas"}, ${reviews.onTime} no prazo. A próxima está marcada para ${formatDate(plan.reviewDate)}.`
            : `Ainda sem revisão registrada. A primeira está marcada para ${formatDate(plan.reviewDate)}.`}
        </p>
        {editable ? <details open={daysLeft <= 14} className="rounded-2xl bg-surface-muted p-4">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-brand-strong"><CalendarCheck size={16} aria-hidden /> Registrar a revisão feita com a equipe</summary>
          <form action={review} className="mt-3 grid gap-4">
            <div>
              <label htmlFor="review-summary" className={labelCls}>O que a equipe decidiu? (obrigatório)</label>
              <p id="review-summary-hint" className={hintCls}>Por exemplo: objetivos mantidos, apoio reduzido, nova estratégia na sala comum.</p>
              <textarea id="review-summary" name="summary" required maxLength={600} rows={4} aria-describedby="review-summary-hint" className={textareaCls} />
            </div>
            <div className="max-w-xs">
              <label htmlFor="next-review" className={labelCls}>Próxima revisão (obrigatório)</label>
              <input id="next-review" name="nextReviewDate" type="date" required defaultValue={suggestedNextReview()} className={inputCls} />
            </div>
            <div><PendingButton className={buttonCls} pendingText="Registrando a revisão…"><CalendarCheck size={16} aria-hidden /> Registrar revisão</PendingButton></div>
          </form>
        </details> : null}
        {plan.reviews.length ? (
          <ol aria-label="Revisões registradas" className="mt-4 grid gap-3">
            {plan.reviews.map((item) => (
              <li key={item.id} className="rounded-xl border border-line p-3.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {formatDate(item.reviewedAt)}
                  {item.onTime ? <Badge tone="green">No prazo</Badge> : <Badge tone="amber">Fora do prazo (marcada para {formatDate(item.dueDate)})</Badge>}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{item.summary}</p>
                <p className="mt-1.5 text-xs text-ink-soft">{item.reviewerName} · próxima: {formatDate(item.nextReviewDate)}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>O que o estudante já consegue fazer</SectionTitle>
          <p className="text-sm leading-relaxed text-ink">{plan.initialSituation}</p>
        </Card>
        <Card>
          <SectionTitle>Apoios combinados pela equipe</SectionTitle>
          <dl className="space-y-3 text-sm">
            {plan.commonRoomStrategies ? (<div><dt className="font-medium text-ink">Na sala comum</dt><dd className="mt-1 text-ink-soft">{plan.commonRoomStrategies}</dd></div>) : null}
            {plan.aeeStrategies ? (<div><dt className="font-medium text-ink">No AEE</dt><dd className="mt-1 text-ink-soft">{plan.aeeStrategies}</dd></div>) : null}
            {plan.accessibilityResources ? (<div><dt className="font-medium text-ink">Recursos de acessibilidade</dt><dd className="mt-1 text-ink-soft">{plan.accessibilityResources}</dd></div>) : null}
          </dl>
          {!plan.commonRoomStrategies && !plan.aeeStrategies && !plan.accessibilityResources ? <p className="text-sm text-ink-soft">Nenhum apoio foi descrito na criação deste plano.</p> : null}
        </Card>
      </div>

      <SectionTitle>Objetivos de aprendizagem</SectionTitle>
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-soft">Um objetivo observável descreve algo que o estudante faz e como você reconhece o resultado. Exemplo: identificar o próprio nome entre cinco opções, com pista visual, em quatro de cinco tentativas.</p>
      <div className="mb-6 space-y-3">
        {plan.objectives.map((obj) => {
          const markDone = markObjectiveStatus.bind(null, id, obj.id, "alcancado");
          const markReview = markObjectiveStatus.bind(null, id, obj.id, "em_revisao");
          const latest = latestSupport?.get(obj.id);
          return (
            <Card key={obj.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-xl text-sm leading-relaxed text-ink">{obj.description}</p>
                {obj.status === "alcancado" ? <Badge tone="green">Alcançado</Badge> :
                 obj.status === "em_revisao" ? <Badge tone="amber">Em revisão</Badge> : <Badge tone="brand">Ativo</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                <Badge>{DIMENSIONS[obj.dimension] ?? obj.dimension}</Badge>
                {obj.bnccCode ? <BnccTag code={obj.bnccCode} detail /> : null}
                {/* Com registro de aula, a escala abaixo mostra início, último registro e meta. */}
                {latest ? null : (
                  <>
                    <span>Apoio atual:</span> <SupportPill level={obj.currentSupport} />
                    <span>Apoio que queremos alcançar:</span> <SupportPill level={obj.targetSupport} />
                  </>
                )}
              </div>
              {latest ? (
                <div className="mt-4 max-w-xl">
                  <ObjectiveScale
                    initial={obj.currentSupport}
                    latest={latest.level}
                    target={obj.targetSupport}
                    caption={`Último registro de aula em ${formatDate(latest.date)} · ${latest.count} ${latest.count === 1 ? "registro" : "registros"} para este objetivo. Ir para a direita é precisar de menos apoio.`}
                  />
                </div>
              ) : latestSupport ? (
                <p className="mt-3 text-xs text-ink-soft">Ainda sem registro de aula para este objetivo.</p>
              ) : null}
              {editable && obj.status === "ativo" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={markDone}><button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-green-soft px-4 text-sm font-medium text-green hover:opacity-80">Marcar como alcançado</button></form>
                  <form action={markReview}><button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-amber-soft px-4 text-sm font-medium text-amber hover:opacity-80">Marcar para revisão</button></form>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      {duaByObjective.length || dua.canPlan ? (
        <Card className="mb-6 min-w-0 max-w-3xl">
          <SectionTitle>Atividades com DUA ligadas a este plano</SectionTitle>
          {duaByObjective.length ? (
            <ul className="space-y-4">
              {duaByObjective.map(({ objective, supports }) => (
                <li key={objective.id} className="min-w-0">
                  <p className="break-words text-sm font-medium text-ink">{objective.description}</p>
                  <ul className="mt-1 space-y-1">
                    {supports.map((support) => (
                      <li key={support.id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        {support.canOpenPlanning ? (
                          <Link href={`/planejamento/${support.planningId}/apoios#apoio-${support.id}`} className="inline-flex min-h-11 min-w-0 items-center break-words font-medium text-brand-strong underline underline-offset-4">{support.planningTitle}</Link>
                        ) : (
                          <span className="min-w-0 break-words py-2 text-ink">{support.planningTitle}</span>
                        )}
                        <ReviewBadge state={support.state} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-ink-soft">
              Nenhum apoio de atividade com DUA está ligado aos objetivos deste plano.{" "}
              <Link href={`/estudantes/${id}/dua`} className="font-medium text-brand-strong underline underline-offset-4">Planejar a participação em uma atividade</Link>
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">O apoio de uma atividade não muda este plano: os objetivos continuam sendo revistos aqui, pela equipe.</p>
        </Card>
      ) : null}

      {editable ? (
      <div id="novo-objetivo" className="max-w-3xl scroll-mt-6">
        <Card>
          <SectionTitle>Definir um objetivo de aprendizagem</SectionTitle>
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">Descreva a aprendizagem, o apoio e o resultado esperado. Ao salvar, essas respostas formam a frase do objetivo. Os campos com * são obrigatórios.</p>
          <form action={addObjective} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <ObjectiveFields {...fieldStyle} studentId={id} />
            <ChoiceField name="condition" label="Com qual apoio ou condição? *" options={CONDITION_SUGGESTIONS} required otherPlaceholder="Ex.: com apoio de um colega" {...fieldStyle} />
            <ChoiceField name="criterion" label="Como saberemos que conseguiu? *" options={CRITERION_SUGGESTIONS} required otherPlaceholder="Ex.: 3 de 4 tentativas" {...fieldStyle} />
            <ChoiceField name="deadlineWeeks" label="Prazo para acompanhar" options={DEADLINE_WEEKS} defaultValue="6" required otherType="number" otherMin={1} otherMax={52} otherPlaceholder="Semanas" {...fieldStyle} />
            <div className="min-w-0">
              <label htmlFor="currentSupport" className={labelCls}>Apoio necessário hoje</label>
              <select id="currentSupport" name="currentSupport" defaultValue={2} className={inputCls}>
                {SUPPORT_LEVELS.map((l) => <option key={l.level} value={l.level}>{l.label}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="targetSupport" className={labelCls}>Apoio que queremos alcançar</label>
              <select id="targetSupport" name="targetSupport" defaultValue={1} className={inputCls}>
                {SUPPORT_LEVELS.map((l) => <option key={l.level} value={l.level}>{l.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonCls}>Salvar objetivo no plano</button>
            </div>
          </form>
        </Card>
      </div>
      ) : null}

      {editable ? <details className="mt-8 max-w-3xl rounded-2xl border border-line p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-ink">Encerrar este plano</summary>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">O plano, os objetivos e as revisões ficam no histórico do estudante. Depois de encerrar, a equipe pode elaborar um novo plano.</p>
        <form action={close} className="mt-4 grid gap-4">
          <ChoiceField name="reason" label="Por que o plano está sendo encerrado? (obrigatório)" options={[...CLOSE_REASONS]} required otherPlaceholder="Descreva o motivo" {...fieldStyle} />
          <div><button type="submit" className={dangerButtonCls}><Archive size={16} aria-hidden /> Encerrar o plano</button></div>
        </form>
      </details> : null}

      <PastPlans plans={pastPlans} />
    </>
  );
}

// Só quem tem o recorte pedagógico do estudante vê os apoios (família e terapeuta não).
async function linkedDuaSupports(studentId: string): Promise<{ supports: SupportView[]; canPlan: boolean }> {
  const user = await getCurrentUser();
  if (!user || !canSeePedagogicalDetail(user.role)) return { supports: [], canPlan: false };
  try {
    return { supports: await listStudentSupports(user, studentId), canPlan: canPlanDua(user) };
  } catch (error) {
    if (error instanceof DuaError) return { supports: [], canPlan: false };
    throw error;
  }
}

// Último nível de apoio do diário em cada objetivo do plano. Só para a equipe
// pedagógica: hoje esta página não mostra o diário, e família e terapeuta
// continuam vendo o plano como antes (null = sem esse recorte).
async function latestSupportByObjective(studentId: string, objectiveIds: string[]): Promise<Map<string, { level: number; date: Date; count: number }> | null> {
  const user = await getCurrentUser();
  if (!user || !canSeePedagogicalDetail(user.role)) return null;
  const latest = new Map<string, { level: number; date: Date; count: number }>();
  if (!objectiveIds.length) return latest;
  const entries = await prisma.diaryEntry.findMany({
    where: { studentId, objectiveId: { in: objectiveIds } },
    select: { objectiveId: true, supportLevel: true, date: true },
    orderBy: { date: "asc" },
  });
  for (const entry of entries) {
    if (!entry.objectiveId) continue;
    latest.set(entry.objectiveId, { level: entry.supportLevel, date: entry.date, count: (latest.get(entry.objectiveId)?.count ?? 0) + 1 });
  }
  return latest;
}

// Dias de calendário de hoje até a data (negativo quando já passou).
function daysUntil(date: Date, today: Date) {
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  return Math.round((start(date) - start(today)) / 86_400_000);
}

function dateInput(weeks: number) {
  const date = new Date();
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function ProposalReview({ studentId, studentName, proposal, analysis, trace, source, createdBy, createdAt, aiOn }: {
  studentId: string;
  studentName: string;
  proposal: PlanProposal;
  analysis: CaseAnalysis | null;
  trace: TraceStep[];
  source: string;
  createdBy: string;
  createdAt: Date;
  // A nova proposta usa a IA se ela estiver ligada agora, qualquer que tenha
  // sido a origem da proposta anterior.
  aiOn: boolean;
}) {
  const activate = activatePlanDraft.bind(null, studentId);
  const discard = discardPlanDraft.bind(null, studentId);
  const regenerate = generatePlanDraft.bind(null, studentId);
  return (
    <Card className="max-w-3xl scroll-mt-6 border-brand/30">
      <div id="proposta" className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>Proposta de plano</SectionTitle>
          <p className="-mt-2 text-xs text-ink-soft">Pedida por {createdBy} em {formatDate(createdAt)}.</p>
        </div>
        <Badge tone={source === "ia" ? "brand" : "neutral"}>{source === "ia" ? <><Sparkles size={12} aria-hidden /> Agentes de IA</> : "Motor de regras"}</Badge>
      </div>

      {analysis ? (
        <section aria-labelledby="analise-titulo" className="mb-5 rounded-2xl bg-surface-muted p-4">
          <h3 id="analise-titulo" className="text-sm font-semibold">Análise do caso</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink">{analysis.sintese}</p>
          {analysis.prioridades.length ? (
            <ul className="mt-3 space-y-1 text-sm text-ink-soft">
              {analysis.prioridades.map((item) => <li key={item.dimension}><span className="font-medium text-ink">{DIMENSIONS[item.dimension] ?? item.dimension}:</span> {item.justificativa}</li>)}
            </ul>
          ) : null}
          {analysis.cuidados.length ? <p className="mt-3 text-sm text-ink-soft"><span className="font-medium text-ink">Cuidados:</span> {analysis.cuidados.join("; ")}</p> : null}
        </section>
      ) : null}

      <details className="mb-5 rounded-2xl border border-line px-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink-soft">Como esta proposta foi feita</summary>
        <ol className="mb-4 space-y-2 text-sm">
          {trace.map((step, index) => <li key={index} className="flex gap-2"><span className="font-medium text-ink">{step.agent}:</span><span className="text-ink-soft">{step.summary}</span></li>)}
        </ol>
      </details>

      <form action={activate} className="space-y-6">
        <MultiChoiceField name="initialSituation" label="O que o estudante já consegue fazer? *" options={INITIAL_SITUATION_OPTIONS} defaultValue={proposal.initialSituation} required {...multiStyle} />
        <MultiChoiceField name="commonRoomStrategies" label="Como apoiar na sala comum" options={COMMON_ROOM_STRATEGY_OPTIONS} defaultValue={proposal.commonRoomStrategies} {...multiStyle} />
        <MultiChoiceField name="aeeStrategies" label="Como apoiar no AEE" options={AEE_STRATEGY_OPTIONS} defaultValue={proposal.aeeStrategies} {...multiStyle} />
        <MultiChoiceField name="accessibilityResources" label="Recursos de acessibilidade" options={ACCESSIBILITY_RESOURCE_OPTIONS} defaultValue={proposal.accessibilityResources} {...multiStyle} />
        <div>
          <label htmlFor="proposal-review-date" className={labelCls}>Quando a equipe vai revisar este plano? *</label>
          <input id="proposal-review-date" name="reviewDate" type="date" required defaultValue={dateInput(proposal.reviewWeeks)} className={inputCls} />
        </div>
        <fieldset>
          <legend className={labelCls}>Objetivos propostos: marque os que entram no plano</legend>
          <div className="space-y-3">
            {proposal.objectives.map((objective, index) => (
              <label key={index} className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-paper p-4 has-checked:border-brand has-checked:bg-brand-soft/40">
                <input type="checkbox" name="objetivo" value={index} defaultChecked className="mt-1 size-4 shrink-0 accent-[var(--brand)]" />
                <span className="min-w-0">
                  <span className="block text-sm leading-relaxed text-ink">{buildObjectiveDescription({ studentName, ...objective })}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    <Badge>{DIMENSIONS[objective.dimension] ?? objective.dimension}</Badge>
                    {objective.bnccCode ? <BnccTag code={objective.bnccCode} /> : null}
                    <SupportPill level={objective.currentSupport} /> → <SupportPill level={objective.targetSupport} />
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-ink-soft">{objective.rationale}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Depois de ativar, você pode acrescentar objetivos ou marcar algum para revisão.</p>
        </fieldset>
        <AIDisclaimer />
        <PendingButton className={buttonCls} pendingText="Ativando o plano…">Ativar plano com os objetivos marcados <ArrowRight size={16} aria-hidden /></PendingButton>
      </form>

      <div className="mt-6 flex flex-wrap items-start gap-3 border-t border-line pt-4">
        <form action={regenerate} className="has-[[data-testid=espera-jardim]]:basis-full">
          <PendingButton className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-soft px-4 text-sm font-medium text-brand-strong hover:bg-lilac" pendingText={aiOn ? "Os agentes estão preparando outra proposta." : "Preparando outra proposta…"} wait={aiOn ? "plano" : undefined}>
            <Sparkles size={16} aria-hidden /> Gerar outra proposta
          </PendingButton>
        </form>
        <form action={discard}>
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-ink-soft hover:bg-coral-soft hover:text-coral"><Trash2 size={16} aria-hidden /> Descartar proposta</button>
        </form>
      </div>
    </Card>
  );
}

// Planos encerrados: período, motivo, objetivos alcançados e revisões no prazo.
function PastPlans({ plans }: { plans: { id: string; createdAt: Date; closedAt: Date | null; closedReason: string | null; objectives: { status: string }[]; reviews: { onTime: boolean }[] }[] }) {
  if (!plans.length) return null;
  return (
    <section aria-labelledby="planos-anteriores" className="mt-8 max-w-3xl">
      <h2 id="planos-anteriores" className="mb-3 text-sm font-medium tracking-tight text-ink">Planos anteriores</h2>
      <ol className="grid gap-3">
        {plans.map((past) => {
          const reached = past.objectives.filter((objective) => objective.status === "alcancado").length;
          const reviews = reviewSummary(past.reviews);
          return (
            <li key={past.id} className="rounded-2xl border border-line bg-paper-raised p-4">
              <p className="text-sm font-medium text-ink">De {formatDate(past.createdAt)} a {past.closedAt ? formatDate(past.closedAt) : "data não registrada"}</p>
              <p className="mt-1 text-sm text-ink-soft">{past.closedReason ?? "Encerrado"}</p>
              <p className="mt-2 text-xs tabular-nums text-ink-soft">
                {reached} de {past.objectives.length} {past.objectives.length === 1 ? "objetivo alcançado" : "objetivos alcançados"} · {reviews.total} {reviews.total === 1 ? "revisão" : "revisões"}{reviews.total ? `, ${reviews.onTime} no prazo` : ""}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
