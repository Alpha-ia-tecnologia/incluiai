import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardList, Pencil, Save } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { saveCaseStudy } from "@/actions/case-study";
import { CASE_STUDY_SECTIONS, parseCaseStudy, sectionProgress, type CaseStudyContent, type CaseStudyField } from "@/lib/case-study";
import { splitItems } from "@/lib/form-options";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const inputCls = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";
const labelCls = "mb-2 block text-sm font-medium text-ink";

function FieldInput({ field, value }: { field: CaseStudyField; value: string }) {
  const label = field.requiredToConclude ? `${field.label} *` : field.label;
  const wrapper = field.wide ? "md:col-span-2" : "";
  if (field.type === "textarea") {
    return (
      <div className={wrapper}>
        <label htmlFor={field.key} className={labelCls}>{label}</label>
        {field.hint ? <p id={`${field.key}-hint`} className="-mt-1 mb-2 text-xs leading-relaxed text-ink-soft">{field.hint}</p> : null}
        <textarea id={field.key} name={field.key} rows={4} defaultValue={value} required={field.requiredToConclude} placeholder={field.placeholder} aria-describedby={field.hint ? `${field.key}-hint` : undefined} className={inputCls} />
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
  searchParams: Promise<{ editar?: string; salvo?: string }>;
}) {
  const { id } = await params;
  const { editar, salvo } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Reúne dados da família e da escola: só a equipe pedagógica acessa.
  if (!canSeePedagogicalDetail(user.role)) redirect(`/estudantes/${id}`);

  const [student, caseStudy, profile] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.caseStudy.findUnique({ where: { studentId: id } }),
    prisma.functionalProfile.findUnique({ where: { studentId: id }, select: { id: true } }),
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

  return (
    <>
      <PageHeader
        title="Estudo de caso"
        lede={`Reúna o que a família, a escola e o próprio estudante contam para entender as necessidades de ${firstName} antes de planejar. Você pode salvar e continuar depois.`}
      />

      {salvo ? (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-sm font-medium text-green">
          <CheckCircle2 size={18} aria-hidden /> Rascunho salvo. Continue quando tiver novas informações.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <form action={save} className="min-w-0 space-y-5">
          {!caseStudy ? (
            <Card className="bg-surface-muted">
              <h2 className="mb-2 flex items-center gap-2 text-base font-medium"><ClipboardList size={18} className="text-brand-strong" aria-hidden /> Como fazer o estudo de caso</h2>
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
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{index + 1}</span>
                    <div>
                      <h2 id={`titulo-${section.id}`} className="text-base font-semibold text-ink">{section.title}</h2>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{section.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-sky-soft px-2.5 py-1 text-[11px] font-medium text-sky-ink">{section.source}</span>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {section.fields.map((field) => <FieldInput key={field.key} field={field} value={content[field.key] ?? ""} />)}
                </div>
                <p className="mt-5 text-xs text-ink-soft">{progress.filled} de {progress.total} perguntas com resposta salva</p>
              </section>
            );
          })}

          <div className="sticky bottom-[calc(96px_+_env(safe-area-inset-bottom,0px))] z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper-raised p-3 shadow-e2 lg:bottom-4">
            {concluded ? (
              <>
                <button type="submit" name="intent" value="concluir" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-white hover:bg-brand-strong">
                  <Save size={16} aria-hidden /> Salvar alterações
                </button>
                <Link href={`/estudantes/${id}/estudo-de-caso`} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-ink-soft hover:bg-surface-muted">Cancelar</Link>
              </>
            ) : (
              <>
                <button type="submit" name="intent" value="rascunho" formNoValidate className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-soft px-5 text-sm font-medium text-brand-strong hover:bg-lilac">
                  <Save size={16} aria-hidden /> Salvar rascunho
                </button>
                <button type="submit" name="intent" value="concluir" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-white hover:bg-brand-strong">
                  <CheckCircle2 size={16} aria-hidden /> Concluir estudo de caso
                </button>
              </>
            )}
            <p className="text-xs text-ink-soft">Para concluir, responda os itens com *.</p>
          </div>
        </form>

        <nav aria-label="Partes do estudo de caso" className="hidden self-start xl:sticky xl:top-6 xl:block">
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
                    <span className="text-xs text-ink-soft">{progress.filled}/{progress.total}</span>
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
