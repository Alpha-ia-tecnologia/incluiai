import Image from "next/image";
import Link from "next/link";
import { Accessibility, CircleCheck, Clock, House, Lightbulb, Printer, Target, Trash2, TriangleAlert, Users } from "lucide-react";
import { approveMaterial, deleteMaterial } from "@/actions/materials";
import { Badge } from "@/components/ui";
import { dangerButtonCls, primaryButtonCls, quietButtonCls } from "@/components/form-styles";
import { formatDate, parseJson } from "@/lib/format";
import { MATERIAL_CONTEXT_LABEL, MATERIAL_KIND_LABEL, normalizeMaterialContent, type MaterialActivity, type MaterialContext, type MaterialKind } from "@/lib/material-content";
import type { TraceStep } from "@/lib/agents/schemas";
import { cardPictogram } from "@/lib/pictograms";
import { MaterialImagesButton, SendActivityButton } from "./material-actions";
import { Pictogram } from "./pictogram";
import { ReadAloud } from "@/components/read-aloud";

// Um material de apoio completo. O mesmo componente serve à página (com ações)
// e à impressão (printMode: sem botões, cartões grandes e marca de sugestão).

export type MaterialRow = {
  id: string;
  kind: string;
  title: string;
  content: string;
  source: string;
  topic: string | null;
  context: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  trace: string | null;
  createdAt: Date;
  images: { cardIndex: number; altText: string; createdAt: Date }[];
};

export const materialImageUrl = (materialId: string, index: number, at: Date) => `/api/materiais/${materialId}/imagens/${index}?v=${at.getTime()}`;

function ActivityCard({ activity, index, studentId, materialId, printMode, canEdit }: { activity: MaterialActivity; index: number; studentId: string; materialId: string; printMode: boolean; canEdit: boolean }) {
  const ContextIcon = activity.context === "casa" ? House : activity.context === "sala_comum" ? Users : Target;
  return (
    <li className="min-w-0 rounded-2xl border border-line bg-paper p-4 print:break-inside-avoid sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand"><ContextIcon size={12} aria-hidden /> {MATERIAL_CONTEXT_LABEL[activity.context as MaterialContext] ?? activity.context}</Badge>
        <Badge tone="neutral"><Clock size={12} aria-hidden /> {activity.durationMinutes} min</Badge>
      </div>
      <h3 className="mt-2 font-display text-xl font-medium text-ink">{index + 1}. {activity.title}</h3>
      {activity.goal ? <p className="mt-1 text-sm text-ink-soft">{activity.goal}</p> : null}
      <div className="mt-3 grid min-w-0 gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Passo a passo</p>
          <ol className="mt-1.5 grid gap-1.5">
            {activity.steps.map((step, stepIndex) => (
              <li key={stepIndex} className="flex gap-2 text-sm text-ink">
                <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft tabular-nums text-xs text-brand-strong">{stepIndex + 1}</span>
                <span className="min-w-0 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          {activity.materials.length ? <p className="mt-3 text-sm text-ink-soft"><span className="font-medium text-ink">Materiais:</span> {activity.materials.join(", ")}</p> : null}
          {activity.classParticipation ? <p className="mt-2 text-sm text-ink-soft"><span className="font-medium text-ink">A turma participa assim:</span> {activity.classParticipation}</p> : null}
        </div>
        <div className="grid min-w-0 content-start gap-3">
          {activity.responseForms.length ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Pode responder</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">{activity.responseForms.map((form) => <li key={form} className="rounded-full bg-sky-soft px-2.5 py-1 text-xs text-sky-ink">{form}</li>)}</ul>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Escada de apoio</p>
            <dl className="mt-1.5 grid gap-1.5 text-sm">
              <div className="rounded-lg bg-amber-soft/60 px-2.5 py-1.5"><dt className="text-xs font-medium text-amber-900">Se ficar difícil</dt><dd className="text-ink">{activity.supportBelow}</dd></div>
              <div className="rounded-lg bg-brand-soft/60 px-2.5 py-1.5"><dt className="text-xs font-medium text-brand-strong">Apoio de hoje</dt><dd className="text-ink">{activity.supportTarget}</dd></div>
              <div className="rounded-lg bg-green-soft/70 px-2.5 py-1.5"><dt className="text-xs font-medium text-green">Quando estiver pronto</dt><dd className="text-ink">{activity.supportAbove}</dd></div>
            </dl>
          </div>
        </div>
      </div>
      <dl className="mt-3 grid min-w-0 gap-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="font-medium text-ink">Deu certo quando</dt><dd className="text-ink-soft">{activity.successCriterion}</dd></div>
        <div className="min-w-0"><dt className="font-medium text-ink">Se não der certo</dt><dd className="text-ink-soft">{activity.planB}</dd></div>
      </dl>
      {canEdit && !printMode ? <div className="mt-3"><SendActivityButton studentId={studentId} materialId={materialId} index={index} title={activity.title} /></div> : null}
    </li>
  );
}

// printHref: onde fica a versão para imprimir (null = a página já imprime por conta
// própria, como a leitura do portal da família).
export function MaterialView({ studentId, material, objective, imagesOn, printMode = false, canEdit = true, printHref }: { studentId: string; material: MaterialRow; objective: string | null; imagesOn: boolean; printMode?: boolean; canEdit?: boolean; printHref?: string | null }) {
  // Ações só para a equipe pedagógica; o servidor confere de novo em cada uma.
  const actions = canEdit && !printMode;
  const content = normalizeMaterialContent(parseJson<unknown>(material.content, {}));
  const trace = parseJson<TraceStep[]>(material.trace, []);
  const images = new Map(material.images.map((image) => [image.cardIndex, image]));
  const missingImages = content.cards.slice(0, 12).filter((_, index) => !images.has(index)).length;
  const approved = material.status === "aprovado";
  const kindLabel = MATERIAL_KIND_LABEL[material.kind as MaterialKind] ?? material.kind;
  const approve = approveMaterial.bind(null, studentId, material.id);
  const remove = deleteMaterial.bind(null, studentId, material.id);
  const story = material.kind === "historia_social";

  return (
    <article id={`material-${material.id}`} aria-labelledby={`material-${material.id}-titulo`} className="min-w-0 scroll-mt-24 rounded-2xl border border-line bg-paper-raised p-4 shadow-e1 print:border-0 print:shadow-none sm:p-6">
      {!approved ? (
        <p className={`mb-4 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${printMode ? "border-2 border-amber-800 font-medium text-amber-900" : "bg-amber-soft text-amber-900"}`}>
          <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          {printMode ? "SUGESTÃO — material ainda não aprovado pela equipe para uso pedagógico." : "Sugestão: revise o conteúdo e aprove antes de usar com o estudante."}
        </p>
      ) : null}

      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{kindLabel}</Badge>
            {approved ? <Badge tone="green"><CircleCheck size={12} aria-hidden /> Aprovado para uso</Badge> : <Badge tone="amber">Aguarda aprovação</Badge>}
            <Badge tone="neutral">{material.source === "ia" ? "Criado com IA" : "Criado pelas regras"}</Badge>
            {material.context ? <Badge tone="neutral">{MATERIAL_CONTEXT_LABEL[material.context as MaterialContext] ?? material.context}</Badge> : null}
          </div>
          <h2 id={`material-${material.id}-titulo`} className="mt-2 break-words font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">{material.title}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Criado em {formatDate(material.createdAt)}
            {material.topic ? ` · situação: ${material.topic}` : ""}
            {approved && material.approvedBy ? ` · aprovado por ${material.approvedBy}${material.approvedAt ? ` em ${formatDate(material.approvedAt)}` : ""}` : ""}
          </p>
          {objective ? <p className="mt-1 text-xs text-ink-soft"><span className="font-medium text-ink">Objetivo do plano:</span> {objective}</p> : null}
        </div>
        {!printMode ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ReadAloud targetId={`material-${material.id}`} label="Ouvir o material" />
            {actions && !approved ? (
              <form action={approve}>
                <button type="submit" className={primaryButtonCls}>
                  <CircleCheck size={16} aria-hidden /> Aprovar para uso
                </button>
              </form>
            ) : null}
            {printHref === null ? null : (
              <Link href={printHref ?? `/estudantes/${studentId}/materiais/${material.id}/imprimir`} className={quietButtonCls}>
                <Printer size={16} aria-hidden /> Imprimir<span className="sr-only">: {material.title}</span>
              </Link>
            )}
            {actions ? <form action={remove}>
              <button type="submit" aria-label={`Excluir material: ${material.title}`} className={dangerButtonCls}>
                <Trash2 size={16} aria-hidden /> Excluir
              </button>
            </form> : null}
          </div>
        ) : null}
      </header>

      {content.purpose ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink"><span className="font-medium">Para que serve:</span> {content.purpose}</p> : null}
      {content.intro ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft"><span className="font-medium text-ink">Como apresentar:</span> {content.intro}</p> : null}

      {content.reviewNotes.length && !approved ? (
        <div className="mt-4 rounded-xl border border-amber-800/20 bg-amber-soft/50 p-3 text-sm text-amber-900 print:hidden">
          <p className="font-medium">Confira antes de aprovar</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{content.reviewNotes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      ) : null}

      <section aria-label="Cartões do material" className="mt-5">
        <ol className={`grid min-w-0 gap-3 ${story ? "sm:grid-cols-2" : printMode ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
          {content.cards.map((card, index) => (
            <li key={index} className={`relative flex min-w-0 flex-col items-center rounded-2xl border bg-paper p-3 text-center print:break-inside-avoid ${printMode ? "border-dashed border-ink/40" : "border-line"}`}>
              <span aria-hidden className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full border border-line bg-paper-raised tabular-nums text-xs text-brand-strong">{index + 1}</span>
              {images.has(index) ? (
                <Image src={materialImageUrl(material.id, index, images.get(index)!.createdAt)} alt={images.get(index)!.altText || card.alt} width={1024} height={1024} unoptimized className="aspect-square h-auto w-full max-w-44 rounded-xl bg-white object-contain" />
              ) : (
                <span className="block w-full max-w-44">
                  <Pictogram pictogram={cardPictogram(card)} />
                  <span className="sr-only">Sem imagem. Descrição do pictograma: {card.visual}</span>
                </span>
              )}
              <span className={`mt-2 font-medium text-ink ${printMode ? "text-xl" : "text-sm"} ${story ? "text-left" : ""}`}>{card.label}</span>
              {card.caption ? <span className="mt-0.5 text-xs text-ink-soft">{card.caption}</span> : null}
            </li>
          ))}
        </ol>
        {actions && imagesOn && missingImages > 0 ? <div className="mt-3"><MaterialImagesButton studentId={studentId} materialId={material.id} missing={missingImages} /></div> : null}
      </section>

      {content.activities.length ? (
        <details open className="group mt-6 print:break-before-page" >
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-display text-xl font-medium text-ink">
            Atividades para aplicar ({content.activities.length})
          </summary>
          <p className="mb-3 text-sm text-ink-soft">Propostas adaptadas ao perfil. Leve para Atividades a que for usar: ela segue o caminho de sempre (aceitar, aplicar e registrar a aula).</p>
          <ol className="grid min-w-0 gap-3">
            {content.activities.map((activity, index) => <ActivityCard key={index} activity={activity} index={index} studentId={studentId} materialId={material.id} printMode={printMode} canEdit={canEdit} />)}
          </ol>
        </details>
      ) : null}

      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2">
        {content.howToUse.length ? (
          <section className="min-w-0 rounded-2xl bg-surface-muted/60 p-4 print:break-inside-avoid">
            <h3 className="flex items-center gap-2 text-sm font-medium text-ink"><Lightbulb size={16} aria-hidden /> Como usar</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">{content.howToUse.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ) : null}
        {content.adaptations.length ? (
          <section className="min-w-0 rounded-2xl bg-surface-muted/60 p-4 print:break-inside-avoid">
            <h3 className="flex items-center gap-2 text-sm font-medium text-ink"><Target size={16} aria-hidden /> Por que assim</h3>
            <ul className="mt-2 grid gap-2 text-sm">
              {content.adaptations.map((item) => (
                <li key={item.text}><span className="text-ink">{item.text}</span><span className="block text-xs text-ink-soft">{item.basis}</span></li>
              ))}
            </ul>
          </section>
        ) : null}
        {content.accessibility.length ? (
          <section className="min-w-0 rounded-2xl bg-surface-muted/60 p-4 print:break-inside-avoid">
            <h3 className="flex items-center gap-2 text-sm font-medium text-ink"><Accessibility size={16} aria-hidden /> Acessibilidade</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">{content.accessibility.map((item) => <li key={item} className="rounded-full bg-paper-raised px-2.5 py-1 text-xs text-ink">{item}</li>)}</ul>
          </section>
        ) : null}
        {content.familyTip ? (
          <section className="min-w-0 rounded-2xl bg-surface-muted/60 p-4 print:break-inside-avoid">
            <h3 className="flex items-center gap-2 text-sm font-medium text-ink"><House size={16} aria-hidden /> Para a família</h3>
            <p className="mt-2 text-sm text-ink-soft">{content.familyTip}</p>
          </section>
        ) : null}
      </div>

      {!printMode && canEdit && trace.length ? (
        <details className="mt-4 print:hidden">
          <summary className="min-h-11 cursor-pointer py-2 text-xs font-medium text-brand-strong">Como este material foi feito</summary>
          <ul className="mt-1 grid gap-1 text-xs text-ink-soft">{trace.map((step, index) => <li key={index}><span className="font-medium text-ink">{step.agent}:</span> {step.summary}</li>)}</ul>
        </details>
      ) : null}
    </article>
  );
}

export type { MaterialActivity };
