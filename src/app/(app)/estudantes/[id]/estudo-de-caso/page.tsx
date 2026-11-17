import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, ClipboardList, Pencil, Save, Sprout } from "lucide-react";
import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { saveCaseStudy } from "@/actions/case-study";
import { AEE_TEACHER, CASE_STUDY_SECTIONS, CLINICAL_CASE_FIELDS, ESSENTIAL_GROUPS, parseCaseStudy, type CaseStudyContent, type CaseStudyField } from "@/lib/case-study";
import { splitItems } from "@/lib/form-options";
import { formatDate } from "@/lib/format";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { PillLink } from "@/components/pill-link";
import { Character } from "@/components/character";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { PrintButton } from "@/components/print-button";
import { CreatedNotice } from "@/components/materials/created-notice";
import { HealthReportsNote } from "@/components/health-report-note";
import { hintCls, labelCls, BUTTON_CLS, textareaCls } from "@/components/form-styles";

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
        <MultiChoiceField name={field.key} label={label} options={field.options ?? []} defaultValue={value} required={field.requiredToConclude} hint={field.hint} />
      </div>
    );
  }
  return (
    <div className={wrapper}>
      <ChoiceField name={field.key} label={label} options={field.options ?? []} defaultValue={value} required={field.requiredToConclude} hint={field.hint} placeholder="Escolha uma opção" />
    </div>
  );
}

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
  searchParams: Promise<{ editar?: string; salvo?: string; faltaAee?: string; concluido?: string }>;
}) {
  const prisma = await db();
  const { id } = await params;
  const { student, can } = await requireStudentPage(id, "Estudo de caso");
  const { editar, salvo, faltaAee, concluido } = await searchParams;
  const clinical = can.clinical;
  const [caseStudy, activePlan, healthReports] = await Promise.all([    prisma.caseStudy.findUnique({ where: { studentId: id } }),
    prisma.plan.findFirst({ where: { studentId: id, status: "ativo" }, select: { id: true } }),
    clinical ? prisma.healthReport.findMany({ where: { studentId: id }, select: { status: true, reviewedAt: true } }) : Promise.resolve([]),
  ]);

  const content: CaseStudyContent = parseCaseStudy(caseStudy?.content);
  if (!clinical) for (const key of CLINICAL_CASE_FIELDS) delete content[key];
  const sections = CASE_STUDY_SECTIONS.map((section) => ({ ...section, fields: section.fields.filter((field) => clinical || !CLINICAL_CASE_FIELDS.has(field.key)) }));
  const clinicalNote = clinical ? null : (
    <p className="mb-6 rounded-xl bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-soft">Os campos de saúde, diagnóstico informado, acompanhamentos fora da escola e com quem o estudante mora ficam visíveis só para o AEE e a coordenação.</p>
  );
  const concluded = caseStudy?.status === "concluido";
  const canEdit = can.edit;
  const firstName = student.name.split(" ")[0];
  const reportsNote = clinical && canEdit ? <HealthReportsNote studentId={id} reports={healthReports} /> : null;

  if (concluded && (editar !== "1" || !canEdit)) {
    const filled = (field: CaseStudyField) => Boolean(content[field.key]?.trim());
    const allFields = sections.flatMap((section) => section.fields);
    const essential = ESSENTIAL_GROUPS.flatMap((group) => group.keys)
      .map((key) => allFields.find((field) => field.key === key))
      .filter((field): field is CaseStudyField => Boolean(field) && field!.key !== "sintese" && filled(field!));
    const deeper = sections
      .map((section) => ({ section, fields: section.fields.filter((field) => !field.requiredToConclude && filled(field)) }))
      .filter((part) => part.fields.length);
    const answers = (fields: CaseStudyField[]) => (
      <dl className="@container divide-y divide-line/70 border-t border-line px-5 pb-2 sm:px-6">
        {fields.map((field) => (
          <div key={field.key} className="grid min-w-0 gap-1.5 py-3.5 @lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @lg:gap-6">
            <dt className="min-w-0 text-sm text-ink-soft">{field.label}</dt>
            <Answer field={field} value={content[field.key]} />
          </div>
        ))}
      </dl>
    );
    return (
      <>
        <PageHeader
          level={2}
          title="Estudo de caso"
          lede={`Concluído em ${formatDate(caseStudy.concludedAt ?? caseStudy.updatedAt)} · última atualização por ${caseStudy.updatedBy} em ${formatDate(caseStudy.updatedAt)}.`}
          actions={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <PillLink slug="estudo-de-caso" />
              <PrintButton label="Imprimir relatório" />
              {canEdit ? (
                <ButtonLink href={`/estudantes/${id}/estudo-de-caso?editar=1`} variant="secondary">
                  <Pencil size={15} aria-hidden /> Editar estudo de caso
                </ButtonLink>
              ) : null}
            </div>
          }
        />

        {concluido ? <CreatedNotice>Estudo de caso salvo e concluído.</CreatedNotice> : null}

        <Card className="mb-6 flex items-start gap-6 border-brand/30 bg-brand-soft/50">
          <div className="min-w-0 flex-1">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-strong"><CheckCircle2 size={17} aria-hidden /> Síntese do caso</h3>
            <p className="whitespace-pre-line break-words text-base leading-relaxed text-ink">{content.sintese}</p>
          </div>
          <Character variant="planning" className="hidden w-20 sm:block" />
        </Card>

        {canEdit ? (
          <section aria-label="Próximo passo" className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-line bg-paper-raised px-5 py-4 print:hidden sm:px-6">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink">{activePlan ? "O plano de ensino já está ativo" : "Próximo passo: criar o plano de ensino"}</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                {activePlan
                  ? "Volte ao estudo de caso quando algo mudar na vida escolar do estudante."
                  : "O estudo concluído já respalda a declaração no Censo Escolar. Agora registre o PAEE e o PEI."}
              </p>
            </div>
            <ButtonLink href={`/estudantes/${id}/ppi`} variant={activePlan ? "secondary" : "primary"} className="shrink-0">
              {activePlan ? "Abrir o plano de ensino" : "Criar o plano de ensino"} <ArrowRight size={16} aria-hidden />
            </ButtonLink>
          </section>
        ) : null}
        {reportsNote}

        <div className="min-w-0 space-y-4">
          {clinicalNote}
          <section aria-labelledby="leitura-essencial" className="min-w-0 rounded-2xl border border-line bg-paper-raised">
            <h3 id="leitura-essencial" className="px-5 py-4 text-base font-medium text-ink sm:px-6">Essencial</h3>
            {answers(essential)}
          </section>

          {deeper.length ? (
            <>
              <h3 className="pt-2 text-sm font-medium text-ink-soft">O que a equipe aprofundou</h3>
              {deeper.map(({ section, fields }) => (
                <section key={section.id} aria-labelledby={`leitura-${section.id}`} className="min-w-0 rounded-2xl border border-line bg-paper-raised print:break-inside-avoid">
                  <div className="px-5 py-4 sm:px-6">
                    <h4 id={`leitura-${section.id}`} className="text-base font-medium text-ink">{section.title}</h4>
                    <p className="mt-0.5 text-sm text-ink-soft">{section.source}</p>
                  </div>
                  {answers(fields)}
                </section>
              ))}
            </>
          ) : canEdit ? (
            <p className="text-sm leading-relaxed text-ink-soft print:hidden">
              Entrevista com a família, escuta do estudante, observação e avaliação pedagógica são opcionais e podem ser registradas quando houver informação.{" "}
              <Link href={`/estudantes/${id}/estudo-de-caso?editar=1#aprofundar`} className="font-medium text-brand-strong underline underline-offset-4">Aprofundar o estudo</Link>
            </p>
          ) : null}
        </div>
      </>
    );
  }

  if (!canEdit) redirect(`/estudantes/${id}`);
  const save = saveCaseStudy.bind(null, id);
  const fieldValue = (field: CaseStudyField) => content[field.key] ?? (field.key === "participantes" ? AEE_TEACHER : "");
  const answered = (fields: CaseStudyField[]) => fields.filter((field) => content[field.key]?.trim()).length;
  const everyField = sections.flatMap((section) => section.fields);
  const essentialGroups = ESSENTIAL_GROUPS.map((group) => ({ ...group, fields: group.keys.map((key) => everyField.find((field) => field.key === key)).filter((field): field is CaseStudyField => Boolean(field)) }));
  const essentialFields = essentialGroups.flatMap((group) => group.fields);
  const deeperSections = sections.map((section) => ({ ...section, fields: section.fields.filter((field) => !field.requiredToConclude) })).filter((section) => section.fields.length);
  const deeperFields = deeperSections.flatMap((section) => section.fields);
  const essentialFilled = answered(essentialFields);
  const deeperFilled = answered(deeperFields);

  return (
    <>
      <PageHeader
        level={2}
        title="Estudo de caso"
        lede={`Reúna o que a família, a escola e o próprio estudante contam para entender as necessidades de ${firstName} antes de planejar. Você pode salvar e continuar depois.`}
        actions={<PillLink slug="estudo-de-caso" />}
      />

      {salvo ? (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-sm font-medium text-green">
          <Sprout size={18} aria-hidden className="sprout-mark" /> Rascunho salvo. Continue quando tiver novas informações.
        </p>
      ) : null}
      {faltaAee ? (
        <p role="alert" className="mb-5 rounded-2xl bg-amber-soft px-4 py-3 text-sm font-medium text-amber">
          {concluded ? "Salvo. Marque" : "Salvo, mas não concluído: marque"} {AEE_TEACHER} em <a href="#secao-essencial" className="underline underline-offset-4">Quem participou</a>. É quem conduz o estudo de caso, segundo o INEP.
        </p>
      ) : null}
      {reportsNote}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <form action={save} className="min-w-0 space-y-5 xl:col-start-1">
          {clinicalNote}
          {!caseStudy ? (
            <Card className="bg-surface-muted">
              <h3 className="mb-2 flex items-center gap-2 text-base font-medium"><ClipboardList size={18} className="text-brand-strong" aria-hidden /> Como fazer o estudo de caso</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
                <li>Converse com a família e com o professor da sala comum.</li>
                <li>Escute o estudante e observe-o em diferentes espaços da escola.</li>
                <li>Registre o que ele já sabe e como aprende melhor.</li>
                <li>Para concluir, basta a parte Essencial. Não é preciso laudo médico.</li>
              </ul>
            </Card>
          ) : (
            <p className="text-sm text-ink-soft">
              {concluded ? "Editando o estudo de caso concluído." : "Rascunho"} · última atualização por {caseStudy.updatedBy} em {formatDate(caseStudy.updatedAt)}.
            </p>
          )}

          <section id="secao-essencial" aria-labelledby="titulo-essencial" className="ui-card scroll-mt-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="titulo-essencial" className="text-base font-semibold text-ink">Essencial</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">É o que basta para concluir, na ordem do que o INEP descreve para o estudo de caso. Concluído, ele respalda a declaração do estudante no Censo Escolar e abre o plano de ensino.</p>
              </div>
              <span className="rounded-full bg-sky-soft px-2.5 py-1 text-xs font-medium tabular-nums text-sky-ink">{essentialFilled} de {essentialFields.length}</span>
            </div>
            <div className="space-y-6">
              {essentialGroups.map((group, index) => (
                <fieldset key={group.title} className="min-w-0 rounded-2xl border border-line p-4 sm:p-5">
                  <legend className="px-1 text-sm font-semibold text-ink">{index + 1}. {group.title}</legend>
                  <p className="mb-4 text-sm leading-relaxed text-ink-soft">{group.hint}</p>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* O professor do AEE conduz o estudo (INEP). */}
                    {group.fields.map((field) => <FieldInput key={field.key} field={field} value={fieldValue(field)} />)}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          <details id="aprofundar" open={deeperFilled > 0} className="group min-w-0 scroll-mt-6 rounded-2xl border border-line bg-paper-raised">
            <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-base font-semibold text-ink">Aprofundar o estudo <span className="font-normal text-ink-soft">· opcional</span></span>
                <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">Motivo do encaminhamento, entrevista com a família, escuta do estudante, observação e avaliação pedagógica. Preencha quando tiver as informações.</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
                <span className="tabular-nums">{deeperFilled} de {deeperFields.length} respondidas</span>
                <ChevronDown size={18} aria-hidden className="transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="space-y-5 border-t border-line p-4 sm:p-5">
              {deeperSections.map((section) => (
                <section key={section.id} id={`secao-${section.id}`} aria-labelledby={`titulo-${section.id}`} className="scroll-mt-6 rounded-2xl border border-line p-4 sm:p-5">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 id={`titulo-${section.id}`} className="text-base font-semibold text-ink">{section.title}</h4>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{section.description}</p>
                    </div>
                    <span className="rounded-full bg-sky-soft px-2.5 py-1 text-xs font-medium text-sky-ink">{section.source}</span>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    {section.fields.map((field) => <FieldInput key={field.key} field={field} value={fieldValue(field)} />)}
                  </div>
                  <p className="mt-5 text-xs text-ink-soft"><span className="tabular-nums">{answered(section.fields)} de {section.fields.length}</span> perguntas com resposta salva</p>
                </section>
              ))}
            </div>
          </details>

          <div className="sticky bottom-[calc(96px_+_env(safe-area-inset-bottom,0px))] z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper-raised p-3 shadow-e2 lg:bottom-4">
            {concluded ? (
              <>
                <button type="submit" name="intent" value="concluir" className={BUTTON_CLS.primary}>
                  <Save size={16} aria-hidden /> Salvar alterações
                </button>
                <Link href={`/estudantes/${id}/estudo-de-caso`} className={BUTTON_CLS.quiet}>Cancelar</Link>
              </>
            ) : (
              <>
                <button type="submit" name="intent" value="rascunho" formNoValidate className={BUTTON_CLS.secondary}>
                  <Save size={16} aria-hidden /> Salvar rascunho
                </button>
                <button type="submit" name="intent" value="concluir" className={BUTTON_CLS.primary}>
                  <CheckCircle2 size={16} aria-hidden /> Concluir estudo de caso
                </button>
              </>
            )}
            <p className="text-xs text-ink-soft">Para concluir, basta a parte Essencial.</p>
          </div>
        </form>

        <nav aria-label="Partes do estudo de caso" className="hidden self-start xl:sticky xl:top-[calc(var(--sticky-offset,0px)_+_16px)] xl:col-start-2 xl:row-start-1 xl:block">
          <p className="mb-3 text-sm font-medium">Partes do estudo</p>
          <ol className="space-y-1">
            {[
              { href: "#secao-essencial", label: "Essencial", filled: essentialFilled, total: essentialFields.length },
              { href: "#aprofundar", label: "Aprofundar (opcional)", filled: deeperFilled, total: deeperFields.length },
            ].map((part, index) => (
              <li key={part.href}>
                <a href={part.href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-surface-muted">
                  <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${part.filled === part.total ? "bg-brand text-white" : part.filled ? "bg-brand-soft text-brand-strong" : "border border-line text-ink-soft"}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1">{part.label}</span>
                  <span className="text-xs tabular-nums text-ink-soft">{part.filled}/{part.total}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </>
  );
}
