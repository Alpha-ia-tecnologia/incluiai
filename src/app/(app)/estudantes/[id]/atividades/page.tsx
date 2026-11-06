import Link from "next/link";
import Image from "next/image";
import type { Activity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateActivities, acceptActivity, rejectActivity } from "@/actions/activities";
import { parseJson, formatDate } from "@/lib/format";
import { CONTEXTS, ACTIVITY_STATUS, withoutSupportCodes } from "@/lib/scale";
import { PageHeader, Card, SectionTitle, Badge, AIDisclaimer, EmptyState } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { PendingButton } from "@/components/pending-button";
import { isAIEnabled } from "@/lib/agents/model";
import { isImageGenerationEnabled } from "@/lib/images/openai-images";
import { generateActivityImage, removeActivityImage } from "@/actions/activity-images";
import { ActivityImageForm } from "@/components/activity-image-form";

import { ChoiceField } from "@/components/choice-field";
import { LESSON_TOPIC_OPTIONS, REJECT_REASON_OPTIONS } from "@/lib/form-options";
import { ArrowRight, Clock, ImagePlus, Trash2, Wand2 } from "lucide-react";

const WIDE_IMAGE_KINDS = new Set(["sequencia", "cartoes"]);
// Cada geração grava as 3 sugestões juntas (mesmo horário); até 1 minuto antes
// da mais recente conta como o mesmo lote.
const BATCH_WINDOW_MS = 60 * 1000;

type ActivityWithImage = Activity & { image: { altText: string; kind: string; createdAt: Date } | null };

export const dynamic = "force-dynamic";

const inputCls = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";
const labelCls = "mb-2 block text-sm font-medium text-ink";
const linkCls = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover";
const disclosureCls = "rounded-2xl border border-line px-4";
const disclosureSummaryCls = "flex min-h-12 cursor-pointer items-center py-3 text-sm font-medium text-ink";

const CONTEXT_TONES: Record<string, "brand" | "amber" | "green"> = {
  sala_comum: "brand",
  aee: "amber",
  casa: "green",
};

// `compact`: só o cabeçalho e a ação ficam à vista; passos, materiais e apoios
// abrem em "Ver passos e apoios". Usado fora do lote de sugestões mais recente.
function ActivityCardView({ activity, studentId, imagesOn, compact = false }: { activity: ActivityWithImage; studentId: string; imagesOn: boolean; compact?: boolean }) {
  const steps = parseJson<string[]>(activity.steps, []);
  const materials = parseJson<string[]>(activity.materials, []);
  const adaptations = parseJson<{ text: string; rule: string }[]>(activity.adaptations, []);
  const reviewNotes = parseJson<string[]>(activity.reviewNotes, []);
  const generateImage = generateActivityImage.bind(null, studentId, activity.id);
  const removeImage = removeActivityImage.bind(null, studentId, activity.id);
  const accept = acceptActivity.bind(null, studentId, activity.id);
  const reject = rejectActivity.bind(null, studentId, activity.id);

  const body = (
    <>
      {reviewNotes.length && activity.status === "sugerida" ? (
        <div className="mt-4 rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Antes de usar, confira:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{reviewNotes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      ) : null}

      {activity.image ? (
        <figure className="mt-4 print:break-inside-avoid">
          <Image
            src={`/api/atividades/${activity.id}/imagem?v=${activity.image.createdAt.getTime()}`}
            alt={activity.image.altText}
            width={WIDE_IMAGE_KINDS.has(activity.image.kind) ? 1536 : 1024}
            height={1024}
            unoptimized
            className={`h-auto w-full rounded-xl border border-line bg-white ${WIDE_IMAGE_KINDS.has(activity.image.kind) ? "max-w-2xl" : "max-w-md"}`}
          />
          <figcaption className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            Imagem gerada por IA (OpenAI). Confira antes de usar com o estudante.
            {imagesOn && activity.status !== "rejeitada" ? (
              <form action={removeImage} className="print:hidden">
                <button type="submit" className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-ink-soft hover:bg-coral-soft hover:text-coral"><Trash2 size={13} aria-hidden /> Remover imagem</button>
              </form>
            ) : null}
          </figcaption>
        </figure>
      ) : null}
      {imagesOn && activity.status !== "rejeitada" ? (
        <details className="mt-4 rounded-xl border border-line px-4 print:hidden">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink-soft">{activity.image ? "Trocar a imagem de apoio" : "Criar uma imagem de apoio (pictogramas)"}</summary>
          <div className="pb-4">
            <ActivityImageForm action={generateImage} hasImage={Boolean(activity.image)} />
          </div>
        </details>
      ) : null}

      <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 font-semibold text-ink">Como fazer</p>
          <ol className="list-decimal space-y-2 pl-4 leading-relaxed text-ink">
            {steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="mb-1 font-semibold text-ink">Materiais necessários</p>
            <p className="leading-relaxed text-ink-soft">{materials.join("; ")}</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-ink">Como o estudante pode responder</p>
            <p className="leading-relaxed text-ink-soft">{activity.responseForm}</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-ink">O que observar no resultado</p>
            <p className="leading-relaxed text-ink-soft">{activity.successCriterion}</p>
          </div>
        </div>
      </div>

      {compact ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm leading-relaxed text-ink">
          <p className="font-semibold">Apoios e alternativa</p>
          <p><span className="font-medium">Se precisar de mais apoio:</span> {withoutSupportCodes(activity.supportBelow)}</p>
          <p><span className="font-medium">Apoio planejado:</span> {withoutSupportCodes(activity.supportTarget)}</p>
          <p><span className="font-medium">Se conseguir com facilidade:</span> {withoutSupportCodes(activity.supportAbove)}</p>
          <p><span className="font-medium">Se a atividade não funcionar:</span> {activity.planB}</p>
          {activity.classParticipation ? (
            <p><span className="font-medium">Como a turma participa junto:</span> {activity.classParticipation}</p>
          ) : null}
          {adaptations.length > 0 ? (
            <div>
              <p className="font-medium">Adaptações para este estudante:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {adaptations.map((a) => <li key={a.rule}>{a.text}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <details className="mt-4 rounded-xl bg-paper px-4 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-medium text-ink">Ver apoios, adaptações e alternativa para a atividade</summary>
          <div className="space-y-3 pb-4 leading-relaxed text-ink">
          <p><span className="font-medium">Se precisar de mais apoio:</span> {withoutSupportCodes(activity.supportBelow)}</p>
          <p><span className="font-medium">Apoio planejado:</span> {withoutSupportCodes(activity.supportTarget)}</p>
          <p><span className="font-medium">Se conseguir com facilidade:</span> {withoutSupportCodes(activity.supportAbove)}</p>
          <p><span className="font-medium">Se a atividade não funcionar:</span> {activity.planB}</p>
          {activity.classParticipation ? (
            <p><span className="font-medium">Como a turma participa junto:</span> {activity.classParticipation}</p>
          ) : null}
          {adaptations.length > 0 ? (
            <div>
              <p className="font-medium">Adaptações para este estudante:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {adaptations.map((a) => <li key={a.rule}>{a.text}</li>)}
              </ul>
            </div>
          ) : null}
          </div>
        </details>
      )}
    </>
  );

  return (
    <Card className={activity.status === "rejeitada" ? "opacity-75" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge tone={CONTEXT_TONES[activity.context] ?? "neutral"}>{CONTEXTS[activity.context]}</Badge>
            {activity.status !== "sugerida" ? <Badge>{ACTIVITY_STATUS[activity.status]}</Badge> : null}
            {activity.source === "ia" ? <Badge tone="amber">Sugestão dos agentes de IA</Badge> : null}
          </div>
          <h3 className="break-words font-medium text-ink">{activity.title}</h3>
        </div>
        <span className="flex items-center gap-1 text-sm text-ink-soft">
          <Clock size={15} aria-hidden /> {activity.durationMinutes} min{compact ? ` · ${formatDate(activity.createdAt)}` : ""}
        </span>
      </div>

      {compact ? (
        <details className="mt-4 rounded-xl bg-paper px-4 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-medium text-ink">Ver passos e apoios</summary>
          <div className="pb-4">{body}</div>
        </details>
      ) : body}

      {activity.status === "sugerida" ? (
        <div className="mt-4 space-y-3">
          <form action={accept}>
            <button type="submit" className={`${linkCls} w-full sm:w-auto`}>Usar esta atividade</button>
          </form>
          <details className="rounded-xl border border-line px-4">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink-soft">Esta sugestão não serve para a aula?</summary>
            <form action={reject} className="space-y-3 pb-4">
              <ChoiceField name="reason" label="Conte o motivo (opcional)" options={REJECT_REASON_OPTIONS} placeholder="Escolha um motivo" otherPlaceholder="Ex.: a turma terá passeio neste dia" labelClassName={labelCls} inputClassName={inputCls} />
              <button type="submit" className="min-h-11 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-coral-soft hover:text-coral">Rejeitar sugestão</button>
            </form>
          </details>
        </div>
      ) : null}
      {activity.status === "aceita" ? (
        <div className="mt-4 rounded-xl bg-brand-soft p-4">
          <p className="mb-3 text-sm leading-relaxed text-ink">Atividade escolhida. Depois de aplicá-la, registre a participação e o apoio necessário.</p>
          <Link href={`/estudantes/${studentId}/diario?activityId=${encodeURIComponent(activity.id)}`} className={linkCls}>Registrar como foi a aula <ArrowRight size={16} aria-hidden /></Link>
        </div>
      ) : null}
      {activity.status === "rejeitada" && activity.rejectReason ? (
        <p className="mt-3 text-sm text-ink-soft">Motivo informado: {activity.rejectReason}</p>
      ) : null}
    </Card>
  );
}

export default async function ActivitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, objectives, activities] = await Promise.all([
    prisma.functionalProfile.findUnique({ where: { studentId: id } }),
    prisma.objective.findMany({
      where: { plan: { studentId: id, status: "ativo" }, status: "ativo" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activity.findMany({
      where: { studentId: id },
      orderBy: { createdAt: "desc" },
      // Só os metadados da imagem: o arquivo vem pela rota /api/atividades/[id]/imagem.
      include: { image: { select: { altText: true, kind: true, createdAt: true } } },
    }),
  ]);

  const generate = generateActivities.bind(null, id);
  const aiOn = isAIEnabled();
  const imagesOn = isImageGenerationEnabled();
  // Só o lote mais recente fica aberto; o resto fica compacto ou recolhido.
  const suggested = activities.filter((a) => a.status === "sugerida");
  const newest = suggested[0]?.createdAt.getTime() ?? 0;
  const latestBatch = suggested.filter((a) => newest - a.createdAt.getTime() <= BATCH_WINDOW_MS);
  const olderSuggested = suggested.slice(latestBatch.length);
  const chosen = activities.filter((a) => a.status === "aceita" || a.status === "aplicada");
  const rejected = activities.filter((a) => a.status === "rejeitada");

  return (
    <>
      <PageHeader
        title="Preparar uma atividade"
        lede="Escolha o objetivo e o conteúdo da aula. Depois, avalie as sugestões para a sala comum, o AEE e a rotina de casa."
        actions={<div className="[&_button]:min-h-11 [&_button]:text-sm"><PrintButton label="Imprimir atividades" /></div>}
      />

      <Card className="mb-6 max-w-3xl border-brand/30">
        <SectionTitle>O que vamos trabalhar?</SectionTitle>
        {!profile ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-soft">Primeiro, registre como o estudante aprende, seus interesses e os apoios de que precisa. Essas informações ajudam a preparar sugestões adequadas.</p>
            <Link href={`/estudantes/${id}/perfil`} className={linkCls}>Conhecer o estudante <ArrowRight size={16} aria-hidden /></Link>
          </div>
        ) : objectives.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-soft">O plano precisa de pelo menos um objetivo ativo. Ele indica qual aprendizagem você quer observar na atividade.</p>
            <Link href={`/estudantes/${id}/ppi`} className={linkCls}>Definir um objetivo no plano <ArrowRight size={16} aria-hidden /></Link>
          </div>
        ) : (
          <form action={generate} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="objectiveId" className={labelCls}>1. Escolha um objetivo</label>
              <select id="objectiveId" name="objectiveId" className={inputCls}>
                {objectives.map((o) => <option key={o.id} value={o.id}>{o.action}</option>)}
              </select>
            </div>
            <ChoiceField name="lessonTopic" label="2. O que a turma vai estudar?" options={LESSON_TOPIC_OPTIONS} placeholder="Escolha um conteúdo (opcional)" otherPlaceholder="Ex.: sistema solar" labelClassName={labelCls} inputClassName={inputCls} />
            {imagesOn ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper p-3 text-sm sm:col-span-2 has-checked:border-brand has-checked:bg-brand-soft/40">
                <input type="checkbox" name="gerarImagens" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                <span>
                  <span className="flex items-center gap-1.5 font-medium text-ink"><ImagePlus size={15} aria-hidden /> Criar também uma sequência visual dos passos para cada atividade</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">Imagens em estilo pictograma, geradas pela OpenAI sem nenhum dado pessoal. Acrescenta cerca de 1 minuto.</span>
                </span>
              </label>
            ) : null}
            <div className="sm:col-span-2">
              <PendingButton className={linkCls} pendingText={aiOn ? "Os agentes da sala comum, do AEE e da família estão preparando as atividades, e o revisor vai conferir." : "Preparando as sugestões…"} wait={aiOn ? "atividades" : undefined}>
                <Wand2 size={16} aria-hidden /> Preparar 3 sugestões
              </PendingButton>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Você recebe uma sugestão para a sala comum, uma para o AEE e uma para casa. Leia os passos e escolha o que faz sentido para o estudante.
              </p>
            </div>
          </form>
        )}
        <AIDisclaimer />
      </Card>

      {latestBatch.length > 0 ? (
        <section aria-labelledby="sugestoes-titulo" className="mb-8">
          <h2 id="sugestoes-titulo" className="mb-1 text-sm font-medium tracking-tight text-ink">Sugestões para você avaliar</h2>
          <p className="mb-4 text-sm text-ink-soft">Preparadas em {formatDate(latestBatch[0].createdAt)}. Use as que servem e rejeite as que não servem.</p>
          <div className="space-y-4">
            {latestBatch.map((a) => <ActivityCardView key={a.id} activity={a} studentId={id} imagesOn={imagesOn} />)}
          </div>
        </section>
      ) : null}

      {olderSuggested.length > 0 ? (
        <details className={`mb-8 ${disclosureCls}`}>
          <summary className={disclosureSummaryCls}>Sugestões anteriores ainda sem avaliação ({olderSuggested.length})</summary>
          <div className="space-y-4 pb-4">
            {olderSuggested.map((a) => <ActivityCardView key={a.id} activity={a} studentId={id} imagesOn={imagesOn} compact />)}
          </div>
        </details>
      ) : null}

      <SectionTitle>Atividades escolhidas</SectionTitle>
      {chosen.length === 0 ? (
        <EmptyState title="Nenhuma atividade escolhida ainda" hint="Prepare sugestões acima, confira os passos e toque em Usar esta atividade na que servir para a aula." />
      ) : (
        <div className="space-y-4">
          {chosen.map((a) => <ActivityCardView key={a.id} activity={a} studentId={id} imagesOn={imagesOn} compact />)}
        </div>
      )}

      {rejected.length > 0 ? (
        <details className={`mt-8 ${disclosureCls}`}>
          <summary className={disclosureSummaryCls}>Sugestões rejeitadas ({rejected.length})</summary>
          <div className="space-y-4 pb-4">
            {rejected.map((a) => <ActivityCardView key={a.id} activity={a} studentId={id} imagesOn={imagesOn} compact />)}
          </div>
        </details>
      ) : null}
    </>
  );
}

