import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Pencil, Save } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { saveCaseStudy } from "@/actions/case-study";
import {
  CASE_STUDY_SECTIONS, missingToConclude, parseCaseStudy, resumeSection, sectionOfField, sectionProgress,
  type CaseStudyContent, type CaseStudyField,
} from "@/lib/case-study";
import { splitItems } from "@/lib/form-options";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { PrintButton } from "@/components/print-button";
import { HealthReportsNote } from "@/components/health-report-note";

export const dynamic = "force-dynamic";

const inputCls = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";
const labelCls = "mb-2 block text-sm font-medium text-ink";
const FORM_ID = "estudo-de-caso-form";
const CHIPS_VISIBLE = 6;
const PRIMARY_BTN = "inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-white hover:bg-brand-hover";
const SECONDARY_BTN = "inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-soft px-5 text-sm font-medium text-brand-strong hover:bg-lilac";
const TERTIARY_BTN = "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm text-ink-soft hover:bg-surface-muted";
const CURRENT_RING = "ring-2 ring-brand ring-offset-2 ring-offset-paper";

// Cor do número da parte: completa, começada ou ainda vazia.
function partTone({ filled, total }: { filled: number; total: number }) {
  if (filled === total) return "bg-brand text-white";
  if (filled > 0) return "bg-brand-soft text-brand-strong";
  return "border border-line bg-paper-raised text-ink-soft";
}


function FieldInput({ field, value }: { field: CaseStudyField; value: string }) {
  const label = field.requiredToConclude ? `${field.label} *` : field.label;
  const wrapper = field.wide ? "md:col-span-2" : "";
  const heading = field.group ? <h3 className="border-t border-line pt-5 text-sm font-semibold text-ink first:border-t-0 first:pt-0 md:col-span-2">{field.group}</h3> : null;
  if (field.type === "textarea") {
    return (
      <>
      {heading}
      <div className={wrapper}>
        <label htmlFor={field.key} className={labelCls}>{label}</label>
        {field.hint ? <p id={`${field.key}-hint`} className="-mt-1 mb-2 text-xs leading-relaxed text-ink-soft">{field.hint}</p> : null}
        <textarea id={field.key} name={field.key} rows={4} defaultValue={value} required={field.requiredToConclude} placeholder={field.placeholder} aria-describedby={field.hint ? `${field.key}-hint` : undefined} className={inputCls} />
      </div>
      </>
    );
  }
  if (field.type === "multi") {
    return (
      <>
      {heading}
      <div className={wrapper}>
        <MultiChoiceField name={field.key} label={label} options={field.options ?? []} defaultValue={value} required={field.requiredToConclude} hint={field.hint} legendClassName={labelCls} inputClassName={inputCls} visibleCount={CHIPS_VISIBLE} />
      </div>
      </>
    );
  }
  return (
    <>
    {heading}
    <div className={wrapper}>
      <ChoiceField name={field.key} label={label} options={field.options ?? []} defaultValue={value} required={field.requiredToConclude} hint={field.hint} placeholder="Escolha uma opção" labelClassName={labelCls} inputClassName={inputCls} />
    </div>
    </>
  );
}

function Answer({ field, value }: { field: CaseStudyField; value: string }) {
  if (field.type === "multi") {
    return <dd className="mt-1.5 flex flex-wrap gap-1.5">{splitItems(value).map((item) => <Badge key={item}>{item}</Badge>)}</dd>;
  }
  return <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">{value}</dd>;
}

export default async function CaseStudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string; salvo?: string; parte?: string; faltam?: string }>;
}) {
  const { id } = await params;
  const { editar, salvo, parte, faltam } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Reúne dados da família e da escola: só a equipe pedagógica acessa.
  if (!canSeePedagogicalDetail(user.role)) redirect(`/estudantes/${id}`);

  const [student, caseStudy, profile, reports] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.caseStudy.findUnique({ where: { studentId: id } }),
    prisma.functionalProfile.findUnique({ where: { studentId: id }, select: { id: true } }),
    prisma.healthReport.findMany({ where: { studentId: id }, select: { status: true, reviewedAt: true } }),
  ]);
  if (caseStudy) {
    await prisma.accessLog.create({ data: { studentId: id, actor: user.name, role: user.role, action: "visualizou", detail: "Estudo de caso" } });
  }

  const content: CaseStudyContent = parseCaseStudy(caseStudy?.content);
  const concluded = caseStudy?.status === "concluido";
  const canEdit = isStaffOrNetwork(user.role);
  const firstName = student.name.split(" ")[0];

  if (concluded && (editar !== "1" || !canEdit)) {
    return (
      <>
        <PageHeader
          title="Estudo de caso"
          lede={`Concluído em ${formatDate(caseStudy.concludedAt ?? caseStudy.updatedAt)} · última atualização por ${caseStudy.updatedBy} em ${formatDate(caseStudy.updatedAt)}.`}
          actions={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <PrintButton label="Imprimir relatório" />
              {canEdit ? (
                <Link href={`/estudantes/${id}/estudo-de-caso?editar=1`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-soft px-4 text-sm font-medium text-brand-strong hover:bg-lilac">
                  <Pencil size={15} aria-hidden /> Editar estudo de caso
                </Link>
              ) : null}
            </div>
          }
        />

        <Card className="mb-6 border-brand/30 bg-brand-soft/50">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-strong"><CheckCircle2 size={17} aria-hidden /> Síntese do caso</h2>
          <p className="whitespace-pre-line text-base leading-relaxed text-ink">{content.sintese}</p>
        </Card>

        {canEdit ? <HealthReportsNote studentId={id} reports={reports} /> : null}

        {!profile ? (
          <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="max-w-xl">
              <h2 className="text-base font-medium">Próximo passo: contar como {firstName} aprende</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">Os interesses e as barreiras levantados no estudo de caso já aparecem como sugestão. Confira e complete.</p>
            </div>
            <Link href={`/estudantes/${id}/perfil`} className="task-action">Preencher Como aprende <ArrowRight size={16} aria-hidden /></Link>
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          {CASE_STUDY_SECTIONS.map((section, index) => {
            const answered = section.fields.filter((field) => content[field.key] && field.key !== "sintese");
            return (
              <Card key={section.id} className={section.id === "sintese" || section.id === "familia" ? "lg:col-span-2" : ""}>
                <h2 className="text-base font-medium">{index + 1}. {section.title}</h2>
                <p className="mb-4 mt-0.5 text-xs text-ink-soft">{section.source}</p>
                {answered.length ? (
                  <dl className={`grid gap-4 ${section.id === "sintese" || section.id === "familia" ? "md:grid-cols-2" : ""}`}>
                    {answered.map((field) => (
                      <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                        <dt className="text-xs font-medium text-ink-soft">{field.label}</dt>
                        <Answer field={field} value={content[field.key]} />
                      </div>
                    ))}
                  </dl>
                ) : <p className="text-sm text-ink-soft">Nenhuma informação registrada nesta parte.</p>}
              </Card>
            );
          })}
        </div>
      </>
    );
  }

  if (!canEdit) redirect(`/estudantes/${id}`);
  const save = saveCaseStudy.bind(null, id);
  const base = `/estudantes/${id}/estudo-de-caso`;

  // Uma parte por vez. Sem `parte` na URL, o rascunho retoma de onde parou.
  const requested = CASE_STUDY_SECTIONS.findIndex((item) => item.id === parte);
  const index = requested >= 0 ? requested : concluded ? 0 : CASE_STUDY_SECTIONS.indexOf(resumeSection(content));
  const section = CASE_STUDY_SECTIONS[index];
  const previous = CASE_STUDY_SECTIONS[index - 1];
  const next = CASE_STUDY_SECTIONS[index + 1];
  const progress = sectionProgress(section, content);
  const hasRequired = section.fields.some((field) => field.requiredToConclude);
  // No rascunho, trocar de parte não exige os itens com *; ao editar um estudo
  // concluído, a parte aberta precisa continuar completa.
  const skipValidation = !concluded;
  const missing = faltam ? missingToConclude(content) : [];
  const missingByPart = CASE_STUDY_SECTIONS
    .map((item, i) => ({ item, number: i + 1, fields: missing.filter((field) => sectionOfField(field.key).id === item.id) }))
    .filter((group) => group.fields.length > 0);

  return (
    <>
      <PageHeader
        title="Estudo de caso"
        lede={`Reúna o que a família, a escola e o próprio estudante contam para entender as necessidades de ${firstName} antes de planejar. Uma parte por vez: as respostas ficam salvas sempre que você muda de parte.`}
      />

      <HealthReportsNote studentId={id} reports={reports} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <form id={FORM_ID} action={save} className="min-w-0 space-y-5">
          {/* Enter num campo de texto salva e fica nesta parte. */}
          <button type="submit" name="irPara" value={section.id} formNoValidate={skipValidation} tabIndex={-1} aria-hidden="true" className="sr-only">Salvar</button>
          <input type="hidden" name="parte" value={section.id} />

          <nav aria-label="Partes do estudo de caso" className="xl:hidden">
            <ol className="grid grid-cols-7 gap-1">
              {CASE_STUDY_SECTIONS.map((item, i) => {
                const itemProgress = sectionProgress(item, content);
                return (
                  <li key={item.id} className="flex justify-center">
                    <button
                      type="submit" name="irPara" value={item.id} formNoValidate={skipValidation}
                      aria-current={i === index ? "step" : undefined}
                      aria-label={`Parte ${i + 1}: ${item.title} (${itemProgress.filled} de ${itemProgress.total} com resposta)`}
                      className={`flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm font-semibold transition-colors ${partTone(itemProgress)} ${i === index ? CURRENT_RING : "hover:ring-1 hover:ring-brand/40"}`}
                    >
                      {i + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-sm text-ink-soft">Parte {index + 1} de {CASE_STUDY_SECTIONS.length}</p>
          </nav>

          {salvo ? (
            <p role="status" className="flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-sm font-medium text-green">
              <CheckCircle2 size={18} aria-hidden /> Respostas salvas. Continue agora ou quando tiver novas informações.
            </p>
          ) : null}

          {missingByPart.length > 0 ? (
            <div role="alert" className="rounded-2xl bg-amber-soft px-4 py-3 text-sm text-ink">
              <p className="font-medium">Para concluir, ainda faltam estas respostas:</p>
              <ul className="mt-2 space-y-1.5">
                {missingByPart.map((group) => (
                  <li key={group.item.id} className="leading-relaxed">
                    <button type="submit" name="irPara" value={group.item.id} formNoValidate={skipValidation} className="font-medium text-brand-strong underline underline-offset-4 hover:text-brand">
                      Parte {group.number}: {group.item.title}
                    </button>
                    <span className="text-ink-soft"> · {group.fields.map((field) => field.label).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!caseStudy && index === 0 ? (
            <Card className="bg-surface-muted">
              <h2 className="mb-2 flex items-center gap-2 text-base font-medium"><ClipboardList size={18} className="text-brand-strong" aria-hidden /> Como fazer o estudo de caso</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
                <li>Converse com a família e com o professor da sala comum.</li>
                <li>Escute o estudante e observe-o em diferentes espaços da escola.</li>
                <li>Registre o que ele já sabe e como aprende melhor.</li>
                <li>Conclua com uma síntese e os apoios necessários. Não é preciso laudo médico.</li>
              </ul>
            </Card>
          ) : caseStudy ? (
            <p className="text-sm text-ink-soft">
              {concluded ? "Editando o estudo de caso concluído." : "Rascunho"} · última atualização por {caseStudy.updatedBy} em {formatDate(caseStudy.updatedAt)}.
            </p>
          ) : null}

          <section aria-labelledby="titulo-parte" className="ui-card">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{index + 1}</span>
                <div>
                  <h2 id="titulo-parte" className="text-base font-semibold text-ink">{section.title}</h2>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{section.description}</p>
                </div>
              </div>
              <span className="rounded-full bg-sky-soft px-2.5 py-1 text-xs font-medium text-sky-ink">{section.source}</span>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {section.fields.map((field) => <FieldInput key={field.key} field={field} value={content[field.key] ?? ""} />)}
            </div>

            <p className="mt-6 text-xs text-ink-soft">
              {progress.filled} de {progress.total} perguntas com resposta salva{hasRequired ? " · os itens com * são necessários para concluir" : ""}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              {previous ? (
                <button type="submit" name="irPara" value={previous.id} formNoValidate={skipValidation} className={TERTIARY_BTN}>
                  <ArrowLeft size={16} aria-hidden /> Parte anterior
                </button>
              ) : <span />}
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto [&>button:last-child]:flex-1 [&>button:last-child]:justify-center sm:[&>button:last-child]:flex-none">
                {concluded ? (
                  <>
                    <Link href={base} className={TERTIARY_BTN}>Cancelar</Link>
                    {next ? (
                      <button type="submit" name="irPara" value={next.id} className={SECONDARY_BTN}>
                        Próxima parte <ArrowRight size={16} aria-hidden />
                      </button>
                    ) : null}
                    <button type="submit" name="intent" value="concluir" className={PRIMARY_BTN}>
                      <Save size={16} aria-hidden /> Salvar alterações
                    </button>
                  </>
                ) : next ? (
                  <button type="submit" name="irPara" value={next.id} formNoValidate className={PRIMARY_BTN}>
                    Salvar e continuar <ArrowRight size={16} aria-hidden />
                  </button>
                ) : (
                  <>
                    <button type="submit" name="irPara" value={section.id} formNoValidate className={SECONDARY_BTN}>
                      <Save size={16} aria-hidden /> Salvar rascunho
                    </button>
                    <button type="submit" name="intent" value="concluir" className={PRIMARY_BTN}>
                      <CheckCircle2 size={16} aria-hidden /> Concluir estudo de caso
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        </form>

        <nav aria-label="Partes do estudo de caso" className="hidden self-start xl:sticky xl:top-6 xl:block">
          <p className="mb-3 text-sm font-medium">Partes do estudo</p>
          <ol className="space-y-1">
            {CASE_STUDY_SECTIONS.map((item, i) => {
              const itemProgress = sectionProgress(item, content);
              const current = i === index;
              return (
                <li key={item.id}>
                  <button
                    type="submit" form={FORM_ID} name="irPara" value={item.id} formNoValidate={skipValidation}
                    aria-current={current ? "step" : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${current ? "bg-surface-muted font-medium text-ink" : "text-ink hover:bg-surface-muted"}`}
                  >
                    <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${partTone(itemProgress)}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">{item.title}</span>
                    <span className="text-xs tabular-nums text-ink-soft">{itemProgress.filled}/{itemProgress.total}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </>
  );
}
