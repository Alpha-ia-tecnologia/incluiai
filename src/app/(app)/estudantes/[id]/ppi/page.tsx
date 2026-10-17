import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createPlan, createObjective, markObjectiveStatus } from "@/actions/plan";
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
import { ArrowRight, Bot, Sparkles, Trash2 } from "lucide-react";
import { canSeePedagogicalDetail, getCurrentUser } from "@/lib/auth";
import { canPlanDua } from "@/lib/dua/access";
import { DuaError } from "@/lib/dua/shared";
import { listStudentSupports, type SupportView } from "@/lib/dua/supports";
import { ReviewBadge } from "@/components/dua/dua-ui";

export const dynamic = "force-dynamic";

const inputCls = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";
const labelCls = "mb-2 block text-sm font-medium text-ink";
const buttonCls = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong";
const fieldStyle = { labelClassName: labelCls, inputClassName: inputCls };
const multiStyle = { legendClassName: labelCls, inputClassName: inputCls };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plans = await prisma.plan.findMany({
    where: { studentId: id },
    include: { objectives: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  const plan = plans.find((p) => p.status === "ativo");
  const overdue = plan && new Date(plan.reviewDate).getTime() < new Date().getTime();

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
          <PageHeader title="Plano de ensino (PPI)" lede="O plano parte do estudo de caso: é ele que reúne a escuta da família, do estudante e a avaliação pedagógica." />
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
    const aiOn = isAIEnabled();
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
          <PageHeader title="Plano de ensino (PPI)" lede="Revise a proposta, ajuste o que for preciso e escolha os objetivos. O plano só passa a valer quando você o ativar." />
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
        </>
      );
    }

    return (
      <>
        <PageHeader title="Plano de ensino (PPI)" lede="Reúna o que o estudante já consegue fazer e os apoios que a equipe vai oferecer. Depois, defina os objetivos de aprendizagem." />
        <Card className="mb-6 max-w-2xl border-brand/30 bg-brand-soft/40">
          <SectionTitle><span className="flex items-center gap-2"><Bot size={16} aria-hidden /> {aiOn ? "Peça uma proposta aos agentes de IA" : "Peça uma proposta automática"}</span></SectionTitle>
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
      </>
    );
  }

  const addObjective = createObjective.bind(null, id, plan.id);
  const hasActiveObjectives = plan.objectives.some((objective) => objective.status === "ativo");
  // Apoios de atividades com DUA ligados aos objetivos deste plano, agrupados por objetivo.
  const dua = await linkedDuaSupports(id);
  const duaByObjective = plan.objectives
    .map((objective) => ({ objective, supports: dua.supports.filter((support) => (support.data.planLinks ?? []).some((link) => link.planId === plan.id && link.objectiveId === objective.id)) }))
    .filter((group) => group.supports.length);

  return (
    <>
      <PageHeader
        title="Plano de ensino (PPI)"
        lede={`Criado em ${formatDate(plan.createdAt)} · data de revisão: ${formatDate(plan.reviewDate)}`}
        actions={overdue ? <Badge tone="coral">Hora de revisar com a equipe</Badge> : <Badge tone="green">Plano ativo</Badge>}
      />

      <Card className="mb-6 border-brand/30 bg-brand-soft/50">
        <SectionTitle>{hasActiveObjectives ? "Próximo passo: preparar a aula" : "Próximo passo: definir um objetivo"}</SectionTitle>
        <p className="mb-3 text-sm leading-relaxed text-ink-soft">
          {hasActiveObjectives
            ? "Seu plano já tem objetivos ativos. Escolha um deles para preparar uma atividade e, depois da aula, registre o resultado."
            : "O plano foi criado. Agora, descreva abaixo uma aprendizagem que você poderá observar nas próximas aulas."}
        </p>
        <Link href={hasActiveObjectives ? `/estudantes/${id}/atividades` : "#novo-objetivo"} className={buttonCls}>
          {hasActiveObjectives ? "Preparar uma atividade" : "Definir o objetivo"} <ArrowRight size={16} aria-hidden />
        </Link>
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
          return (
            <Card key={obj.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-xl text-sm leading-relaxed text-ink">{obj.description}</p>
                {obj.status === "alcancado" ? <Badge tone="green">Alcançado</Badge> :
                 obj.status === "em_revisao" ? <Badge tone="amber">Em revisão</Badge> : <Badge tone="brand">Ativo</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                <Badge>{DIMENSIONS[obj.dimension] ?? obj.dimension}</Badge>
                {obj.bnccCode ? <Badge>BNCC {obj.bnccCode}</Badge> : null}
                <span>Apoio atual:</span> <SupportPill level={obj.currentSupport} />
                <span>Apoio que queremos alcançar:</span> <SupportPill level={obj.targetSupport} />
              </div>
              {obj.status === "ativo" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={markDone}><button type="submit" className="min-h-11 rounded-lg bg-green-soft px-4 py-2.5 text-sm font-medium text-green hover:opacity-80">Marcar como alcançado</button></form>
                  <form action={markReview}><button type="submit" className="min-h-11 rounded-lg bg-amber-soft px-4 py-2.5 text-sm font-medium text-amber-900 hover:opacity-80">Marcar para revisão</button></form>
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

      <div id="novo-objetivo" className="max-w-3xl scroll-mt-6">
        <Card>
          <SectionTitle>Definir um objetivo de aprendizagem</SectionTitle>
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">Descreva a aprendizagem, o apoio e o resultado esperado. Ao salvar, essas respostas formam a frase do objetivo. Os campos com * são obrigatórios.</p>
          <form action={addObjective} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <ObjectiveFields {...fieldStyle} />
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
        <Badge tone={source === "ia" ? "brand" : "neutral"}>{source === "ia" ? <><Bot size={12} aria-hidden /> Agentes de IA</> : "Motor de regras"}</Badge>
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
                    {objective.bnccCode ? <Badge>BNCC {objective.bnccCode}</Badge> : null}
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
          <PendingButton className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-soft px-4 text-sm font-medium text-brand-strong hover:bg-lilac" pendingText={aiOn ? "Os agentes estão preparando outra proposta." : "Preparando outra proposta…"} wait={aiOn ? "plano" : undefined}>
            <Sparkles size={16} aria-hidden /> Gerar outra proposta
          </PendingButton>
        </form>
        <form action={discard}>
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm text-ink-soft hover:bg-coral-soft hover:text-coral"><Trash2 size={16} aria-hidden /> Descartar proposta</button>
        </form>
      </div>
    </Card>
  );
}
