import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronDown, ClipboardList, Pencil, Save, Sprout } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { saveCaseStudy } from "@/actions/case-study";
import { CASE_STUDY_SECTIONS, parseCaseStudy, sectionProgress, type CaseStudyContent, type CaseStudyField } from "@/lib/case-study";
import { splitItems } from "@/lib/form-options";
import { formatDate } from "@/lib/format";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { Character } from "@/components/character";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { PrintButton } from "@/components/print-button";
import { OpenDetailsOnPrint } from "@/components/open-details-on-print";
import { hintCls, inputCls, labelCls, primaryButtonCls, quietButtonCls, secondaryButtonCls, textareaCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

function FieldInput({ field, value }: { field: CaseStudyField; value: string }) {
  const label = field.requiredToConclude ? `${field.label} *` : field.label;
  const wrapper = field.wide ? "md:col-span-2" : "";
  if (field.type === "textarea") {
    return (
      <div className={wrapper}>
        <label htmlFor={field.key} className={labelCls}>{label}</label>
        {field.hint ? <p id={`${field.key}-hint`} className={`-mt-1 ${hintCls}`}>{field.hint}</p> : null}
        <textarea id={field.key} name={field.key} rows={4} defaultValue={value} required={field.requiredToConclude} placeholder={field.placeholder} aria-describedby={field.hint ? `${field.key}-hint` : undefined} className={textareaCls} />
      </div>
    );
  }
  if (field.type === "multi") {
    return (
      <div className={wrapper}>
        <MultiChoiceField name={field.key} label={label} options={field.options ?? []} defaultValue={value} required={field.requiredToConclude} hint={field.hint} legendClassName={labelCls} inputClassName={inputCls} />
      </div>
    );
  }
  return (
    <div className={wrapper}>
      <ChoiceField name={field.key} label={label} options={field.options ?? []} defaultValue={value} required={field.requiredToConclude} hint={field.hint} placeholder="Escolha uma opção" labelClassName={labelCls} inputClassName={inputCls} />
    </div>
  );
}

// Resposta ao lado da pergunta: os selos de uma escolha múltipla ficam juntos
// da pergunta que os originou, em vez de formar um bloco único.
function Answer({ field, value }: { field: CaseStudyField; value: string }) {
  if (field.type === "multi") {
    return <dd className="flex min-w-0 flex-wrap gap-1.5">{splitItems(value).map((item) => <Badge key={item}>{item}</Badge>)}</dd>;
  }
  return <dd className="min-w-0 whitespace-pre-line break-words text-sm leading-relaxed text-ink">{value}</dd>;
}

export default async function CaseStudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string; salvo?: string }>;
}) {
  const { id } = await params;
  const { editar, salvo } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Reúne dados da família e da escola: só a equipe pedagógica acessa.
  if (!canSeePedagogicalDetail(user.role)) redirect(`/estudantes/${id}`);

  const [student, caseStudy] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.caseStudy.findUnique({ where: { studentId: id } }),
  ]);
  if (caseStudy) {
    await prisma.accessLog.create({ data: { studentId: id, actor: user.name, role: user.role, action: "visualizou", detail: "Estudo de caso" } });
  }

  const content: CaseStudyContent = parseCaseStudy(caseStudy?.content);
  const concluded = caseStudy?.status === "concluido";
  const canEdit = isStaffOrNetwork(user.role);
  const firstName = student.name.split(" ")[0];

  if (concluded && (editar !== "1" || !canEdit)) {
    // A síntese aparece em destaque no topo; na parte 7 ficam só os encaminhamentos.
    const parts = CASE_STUDY_SECTIONS.map((section, index) => {
      const fields = section.fields.filter((field) => field.key !== "sintese");
      return { section, number: index + 1, fields, answered: fields.filter((field) => content[field.key]?.trim()) };
    });
    return (
      <>
        <PageHeader
          level={2}
          title="Estudo de caso"
          lede={`Concluído em ${formatDate(caseStudy.concludedAt ?? caseStudy.updatedAt)} · última atualização por ${caseStudy.updatedBy} em ${formatDate(caseStudy.updatedAt)}.`}
          actions={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {/* O botão de imprimir é compartilhado: aqui ganha o alvo de 44 px e a pílula. */}
              <PrintButton label="Imprimir relatório" />
              {canEdit ? (
                <ButtonLink href={`/estudantes/${id}/estudo-de-caso?editar=1`} variant="secondary">
                  <Pencil size={15} aria-hidden /> Editar estudo de caso
                </ButtonLink>
              ) : null}
            </div>
          }
        />

        <Card className="mb-6 flex items-start gap-6 border-brand/30 bg-brand-soft/50">
          <div className="min-w-0 flex-1">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-strong"><CheckCircle2 size={17} aria-hidden /> Síntese do caso</h3>
            <p className="whitespace-pre-line break-words text-base leading-relaxed text-ink">{content.sintese}</p>
          </div>
          <Character variant="planning" className="hidden w-20 sm:block" />
        </Card>

        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] print:block">
          <nav aria-label="Partes do estudo de caso" className="min-w-0 self-start print:hidden lg:sticky lg:top-[calc(var(--sticky-offset,0px)_+_16px)]">
            <p className="mb-3 text-sm font-medium text-ink">Partes do estudo</p>
            <ol className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {parts.map(({ section, number }) => (
                <li key={section.id} className="min-w-0 max-w-full">
                  <a
                    href={`#parte-${section.id}`}
                    className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-line bg-paper-raised px-3.5 py-2 text-sm text-ink transition-colors hover:border-brand hover:text-brand-strong lg:flex lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-3 lg:hover:bg-surface-muted"
                  >
                    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold tabular-nums text-brand-strong">{number}</span>
                    <span className="min-w-0">{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div id="partes-estudo" className="min-w-0 space-y-4">
            <OpenDetailsOnPrint selector="#partes-estudo details" />
            {parts.map(({ section, number, fields, answered }) => (
              // Aberta por padrão: quem chega lê tudo; recolher é escolha de quem lê.
              <details key={section.id} id={`parte-${section.id}`} open className="group min-w-0 scroll-mt-4 rounded-2xl border border-line bg-paper-raised">
                <summary className="grid min-h-11 list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl px-5 py-4 transition-colors hover:bg-surface-muted/60 group-open:rounded-b-none sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className="row-span-2 flex size-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold tabular-nums text-brand-strong">{number}</span>
                  <h3 className="min-w-0 text-base font-medium text-ink">{section.title}</h3>
                  <ChevronDown size={20} aria-hidden className="col-start-3 row-span-2 row-start-1 text-ink-soft group-open:rotate-180 motion-safe:transition-transform print:hidden" />
                  <span className="col-start-2 text-sm text-ink-soft">
                    {section.source} · <span className="tabular-nums">{answered.length} de {fields.length}</span> {fields.length === 1 ? "pergunta respondida" : "perguntas respondidas"}
                  </span>
                </summary>
                {/* Duas colunas pela largura do cartão, não da tela: com o índice ao lado, sobra menos espaço. */}
                <div className="@container border-t border-line px-5 pb-2 sm:px-6">
                  {answered.length ? (
                    <dl className="divide-y divide-line/70">
                      {answered.map((field) => (
                        <div key={field.key} className="grid min-w-0 gap-1.5 py-3.5 @lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @lg:gap-6">
                          <dt className="min-w-0 text-sm text-ink-soft">{field.label}</dt>
                          <Answer field={field} value={content[field.key]} />
                        </div>
                      ))}
                    </dl>
                  ) : <p className="py-4 text-sm text-ink-soft">Nenhuma informação registrada nesta parte.</p>}
                </div>
              </details>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!canEdit) redirect(`/estudantes/${id}`);
  const save = saveCaseStudy.bind(null, id);

  return (
    <>
      <PageHeader
        level={2}
        title="Estudo de caso"
        lede={`Reúna o que a família, a escola e o próprio estudante contam para entender as necessidades de ${firstName} antes de planejar. Você pode salvar e continuar depois.`}
      />

      {salvo ? (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-sm font-medium text-green">
          <Sprout size={18} aria-hidden className="sprout-mark" /> Rascunho salvo. Continue quando tiver novas informações.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <form action={save} className="min-w-0 space-y-5">
          {!caseStudy ? (
            <Card className="bg-surface-muted">
              <h3 className="mb-2 flex items-center gap-2 text-base font-medium"><ClipboardList size={18} className="text-brand-strong" aria-hidden /> Como fazer o estudo de caso</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
                <li>Converse com a família e com o professor da sala comum.</li>
                <li>Escute o estudante e observe-o em diferentes espaços da escola.</li>
                <li>Registre o que ele já sabe e como aprende melhor.</li>
                <li>Conclua com uma síntese e os apoios necessários. Não é preciso laudo médico.</li>
              </ul>
            </Card>
          ) : (
            <p className="text-sm text-ink-soft">
              {concluded ? "Editando o estudo de caso concluído." : "Rascunho"} · última atualização por {caseStudy.updatedBy} em {formatDate(caseStudy.updatedAt)}.
            </p>
          )}

          {CASE_STUDY_SECTIONS.map((section, index) => {
            const progress = sectionProgress(section, content);
            return (
              <section key={section.id} id={`secao-${section.id}`} aria-labelledby={`titulo-${section.id}`} className="ui-card scroll-mt-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold tabular-nums text-brand-strong">{index + 1}</span>
                    <div className="min-w-0">
                      <h3 id={`titulo-${section.id}`} className="text-base font-semibold text-ink">{section.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{section.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-sky-soft px-2.5 py-1 text-xs font-medium text-sky-ink">{section.source}</span>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {section.fields.map((field) => <FieldInput key={field.key} field={field} value={content[field.key] ?? ""} />)}
                </div>
                <p className="mt-5 text-xs text-ink-soft"><span className="tabular-nums">{progress.filled} de {progress.total}</span> perguntas com resposta salva</p>
              </section>
            );
          })}

          <div className="sticky bottom-[calc(96px_+_env(safe-area-inset-bottom,0px))] z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper-raised p-3 shadow-e2 lg:bottom-4">
            {concluded ? (
              <>
                <button type="submit" name="intent" value="concluir" className={primaryButtonCls}>
                  <Save size={16} aria-hidden /> Salvar alterações
                </button>
                <Link href={`/estudantes/${id}/estudo-de-caso`} className={quietButtonCls}>Cancelar</Link>
              </>
            ) : (
              <>
                <button type="submit" name="intent" value="rascunho" formNoValidate className={secondaryButtonCls}>
                  <Save size={16} aria-hidden /> Salvar rascunho
                </button>
                <button type="submit" name="intent" value="concluir" className={primaryButtonCls}>
                  <CheckCircle2 size={16} aria-hidden /> Concluir estudo de caso
                </button>
              </>
            )}
            <p className="text-xs text-ink-soft">Para concluir, responda os itens com *.</p>
          </div>
        </form>

        <nav aria-label="Partes do estudo de caso" className="hidden self-start xl:sticky xl:top-[calc(var(--sticky-offset,0px)_+_16px)] xl:block">
          <p className="mb-3 text-sm font-medium">Partes do estudo</p>
          <ol className="space-y-1">
            {CASE_STUDY_SECTIONS.map((section, index) => {
              const progress = sectionProgress(section, content);
              const complete = progress.filled === progress.total;
              return (
                <li key={section.id}>
                  <a href={`#secao-${section.id}`} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-surface-muted">
                    <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${complete ? "bg-brand text-white" : progress.filled ? "bg-brand-soft text-brand-strong" : "border border-line text-ink-soft"}`}>{index + 1}</span>
                    <span className="min-w-0 flex-1">{section.title}</span>
                    <span className="text-xs tabular-nums text-ink-soft">{progress.filled}/{progress.total}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </>
  );
}
