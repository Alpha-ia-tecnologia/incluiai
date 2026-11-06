import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { parseCaseStudy } from "@/lib/case-study";
import { REPORT_FIELDS, isReadingStalled, parseAccepted, parseReading, reviewRows, type ReviewRow } from "@/lib/health-report";
import { formatDate } from "@/lib/format";
import { deleteHealthReport, retryHealthReport, reviewHealthReport } from "@/actions/health-reports";
import { AIDisclaimer, PageHeader } from "@/components/ui";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PendingButton } from "@/components/pending-button";

export const dynamic = "force-dynamic";

const h2 = "font-display text-xl font-extrabold text-ink";
const quote = (value: string) => `“${value}”`;
const listText = (values: string[]) => values.map(quote).join(", ");
const choiceCls = "flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-line bg-paper px-3 py-3 text-base text-ink has-checked:border-ink has-checked:bg-brand-soft";
const checkboxCls = "mt-0.5 size-5 shrink-0 accent-[var(--brand)]";

function Excerpt({ text }: { text: string }) {
  if (!text) return null;
  return <p className="mt-3 border-l-2 border-line pl-3 text-sm leading-relaxed text-ink-soft">No laudo: {quote(text)}</p>;
}

function SuggestionRow({ row }: { row: ReviewRow }) {
  const replacing = row.field.type !== "multi" && row.current.length > 0;
  return (
    <fieldset className="rounded-lg border border-line bg-paper-raised p-4 sm:p-5">
      <legend className="float-left mb-1 w-full text-base font-bold text-ink">{row.field.label}</legend>
      <p className="clear-both text-sm text-ink-soft">Já registrado: {row.current.length ? row.current.join(", ") : "nada ainda"}</p>
      <div className="mt-3 grid gap-2">
        {row.fresh.map((value) => (
          <label key={value} className={choiceCls}>
            <input type="checkbox" name={`campo:${row.field.key}`} value={value} defaultChecked={!replacing} className={checkboxCls} />
            <span>{replacing ? `Trocar por ${quote(value)}` : `Juntar ${quote(value)}`}</span>
          </label>
        ))}
      </div>
      {row.known.length ? <p className="mt-2 text-sm text-ink-soft">O laudo confirma o que já está registrado: {listText(row.known)}.</p> : null}
      {row.replaces.length && !replacing ? <p className="mt-2 text-sm text-ink-soft">Se você juntar, {listText(row.replaces)} sai do campo.</p> : null}
      <Excerpt text={row.excerpt} />
    </fieldset>
  );
}

export default async function HealthReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; laudoId: string }>;
  searchParams: Promise<{ revisado?: string }>;
}) {
  const { id, laudoId } = await params;
  const { revisado } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true, schoolId: true } });
  if (!isStaffOrNetwork(user.role) || !canSeePedagogicalDetail(user.role) || !canAccessStudent(user, student.schoolId, id)) redirect(`/estudantes/${id}`);

  const report = await prisma.healthReport.findUnique({
    where: { id: laudoId },
    select: {
      id: true, studentId: true, fileName: true, mimeType: true, status: true, reading: true, privacyNote: true, failure: true,
      uploadedBy: true, createdAt: true, reviewedBy: true, reviewedAt: true, accepted: true,
    },
  });
  if (!report || report.studentId !== id) notFound();
  const caseStudy = await prisma.caseStudy.findUnique({ where: { studentId: id }, select: { content: true } });

  const firstName = student.name.split(" ")[0];
  const base = `/estudantes/${id}/estudo-de-caso`;
  const fileHref = `/api/laudos/${report.id}`;
  const reading = parseReading(report.reading);
  const accepted = parseAccepted(report.accepted);
  const rows = reading && !report.reviewedAt ? reviewRows(reading, parseCaseStudy(caseStudy?.content)) : [];
  const freshRows = rows.filter((row) => row.fresh.length > 0);
  const confirmed = rows.filter((row) => row.fresh.length === 0 && row.known.length > 0);
  const nothingNew = Boolean(reading) && freshRows.length === 0 && (reading?.guidance.length ?? 0) === 0;
  const stale = isReadingStalled(report.status, report.createdAt);
  const canRetry = !report.reviewedAt && (report.status === "ia_desligada" || stale || (report.status === "falhou" && Boolean(report.privacyNote)));
  const joinedFields = REPORT_FIELDS.filter((field) => accepted.fields[field.key]?.length);

  return (
    <>
      <Link href={`${base}/laudos`} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-pen underline underline-offset-4 print:hidden">
        <ArrowLeft size={16} aria-hidden /> Laudos e relatórios de saúde
      </Link>
      <PageHeader
        title="Leitura do laudo"
        lede={`${report.fileName} · anexado por ${report.uploadedBy} em ${formatDate(report.createdAt)}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <a href={fileHref} target="_blank" rel="noopener" className="task-action task-action-secondary !min-h-11 !py-2">
              Abrir o arquivo <ExternalLink size={15} aria-hidden /><span className="sr-only"> (abre em nova aba)</span>
            </a>
            <ConfirmDelete
              action={deleteHealthReport.bind(null, report.id)}
              question="Excluir este laudo? O que já foi juntado ao estudo de caso continua lá."
              confirmLabel="Excluir laudo"
              triggerAriaLabel={`Excluir o laudo ${report.fileName}`}
            />
          </div>
        }
      />

      <div className="max-w-3xl space-y-6">
        {report.reviewedAt ? (
          <>
            {revisado ? (
              <p role="status" className="flex items-center gap-2 rounded-lg bg-green-soft px-4 py-3 text-sm font-bold text-green">
                <CheckCircle2 size={18} aria-hidden /> Revisão salva. {joinedFields.length ? "O estudo de caso foi atualizado." : "Nada foi juntado ao estudo de caso."}
              </p>
            ) : null}
            <section aria-labelledby="juntado-titulo" className="ui-card">
              <h2 id="juntado-titulo" className={h2}>O que a equipe juntou</h2>
              <p className="mt-1 text-sm text-ink-soft">Revisado por {report.reviewedBy} em {formatDate(report.reviewedAt)}.</p>
              {joinedFields.length || accepted.guidance.length ? (
                <dl className="mt-4 space-y-3 text-base">
                  {joinedFields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-sm text-ink-soft">{field.label}</dt>
                      <dd className="text-ink">{accepted.fields[field.key]?.join(", ")}</dd>
                    </div>
                  ))}
                  {accepted.guidance.length ? (
                    <div>
                      <dt className="text-sm text-ink-soft">Orientações para a escola</dt>
                      <dd>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                          {accepted.guidance.map((text) => <li key={text}>{text}</li>)}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : <p className="mt-4 text-base text-ink">A equipe revisou as sugestões e não juntou nenhuma.</p>}
              <Link href={base} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-pen underline underline-offset-4">
                Abrir o estudo de caso <ArrowRight size={16} aria-hidden />
              </Link>
            </section>
            {reading?.summary ? (
              <section aria-labelledby="resumo-titulo">
                <h2 id="resumo-titulo" className="text-sm font-bold text-ink">O que a IA leu no laudo</h2>
                <p className="mt-1 text-base leading-relaxed text-ink-soft">{reading.summary}</p>
              </section>
            ) : null}
          </>
        ) : report.status === "lido" && reading ? (
          <>
            <section aria-labelledby="resumo-titulo" className="ui-card">
              <h2 id="resumo-titulo" className={h2}>O que o laudo traz para a escola</h2>
              {reading.documentType === "outro" ? (
                <p className="mt-3 text-base font-bold text-ink">A IA não reconheceu este arquivo como laudo ou relatório de saúde. Confira se é o documento certo.</p>
              ) : null}
              <p className="mt-3 text-base leading-relaxed text-ink">{reading.summary}</p>
              {reading.limits ? <p className="mt-3 text-sm leading-relaxed text-ink-soft"><span className="font-bold text-ink">Limites da leitura:</span> {reading.limits}</p> : null}
              <AIDisclaimer />
              {report.privacyNote ? <p className="mt-3 text-sm text-ink-soft">{report.privacyNote}</p> : null}
            </section>

            <form action={reviewHealthReport.bind(null, report.id)} className="space-y-6">
              {reading.guidance.length ? (
                <fieldset className="space-y-3">
                  <legend className={`${h2} mb-1`}>Orientações para a escola</legend>
                  <p className="text-sm leading-relaxed text-ink-soft">As marcadas aparecem no resumo de {firstName} e ajudam a IA a propor o plano individual.</p>
                  <div className="grid gap-2">
                    {reading.guidance.map((item, index) => (
                      <label key={item.text} className={choiceCls}>
                        <input type="checkbox" name="orientacao" value={index} defaultChecked className={checkboxCls} />
                        <span>
                          {item.text}
                          {item.excerpt ? <span className="mt-1 block text-sm text-ink-soft">No laudo: {quote(item.excerpt)}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {freshRows.length ? (
                <div className="space-y-3">
                  <h2 className={h2}>Para o estudo de caso</h2>
                  <p className="text-sm leading-relaxed text-ink-soft">O que você marcar se junta ao que já está registrado no estudo de caso. Confira cada item com o trecho do laudo.</p>
                  {freshRows.map((row) => <SuggestionRow key={row.field.key} row={row} />)}
                </div>
              ) : null}

              {confirmed.length ? (
                <p className="text-sm leading-relaxed text-ink-soft">
                  O laudo confirma o que já está no estudo de caso: {confirmed.map((row) => `${row.field.label.replace(/ \(opcional\)$/, "")} (${row.known.join(", ")})`).join("; ")}.
                </p>
              ) : null}

              {nothingNew ? <p className="text-base text-ink">O laudo não trouxe nada novo para o estudo de caso de {firstName}.</p> : null}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5">
                <PendingButton className="task-action" pendingText="Salvando a revisão...">
                  {nothingNew ? "Marcar como revisado" : "Juntar ao estudo de caso"} <ArrowRight size={16} aria-hidden />
                </PendingButton>
                {!nothingNew ? (
                  <button type="submit" name="intent" value="descartar" className="min-h-12 text-sm font-bold text-ink underline underline-offset-4 hover:decoration-2">
                    Descartar as sugestões
                  </button>
                ) : null}
              </div>
            </form>
          </>
        ) : (
          <section aria-labelledby="situacao-titulo" className="ui-card">
            {report.status === "sem_texto" ? (
              <>
                <h2 id="situacao-titulo" className={h2}>A IA não consegue ler este arquivo</h2>
                <p className="mt-3 text-base leading-relaxed text-ink">
                  {report.mimeType === "application/pdf" ? "Este PDF não tem texto que a plataforma consiga extrair, como acontece com documentos escaneados." : "Este arquivo é uma imagem (foto ou digitalização)."}{" "}
                  Ele ficou guardado para a equipe consultar. Abra o arquivo e registre no estudo de caso o que for útil para a escola.
                </p>
              </>
            ) : report.status === "ia_desligada" ? (
              <>
                <h2 id="situacao-titulo" className={h2}>Laudo guardado, sem leitura pela IA</h2>
                <p className="mt-3 text-base leading-relaxed text-ink">A leitura pela IA está desligada nesta instalação. O arquivo ficou guardado para a equipe consultar e registrar no estudo de caso o que for útil.</p>
              </>
            ) : report.status === "lendo" && !stale ? (
              <>
                <h2 id="situacao-titulo" className={h2}>A IA ainda está lendo este laudo</h2>
                <p className="mt-3 text-base leading-relaxed text-ink">Atualize a página em instantes para ver as sugestões.</p>
              </>
            ) : (
              <>
                <h2 id="situacao-titulo" className={h2}>A leitura não terminou</h2>
                <p className="mt-3 text-base leading-relaxed text-ink">{report.failure ?? "A leitura pela IA foi interrompida. O arquivo continua guardado."}</p>
              </>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              {canRetry ? (
                <form action={retryHealthReport.bind(null, report.id)}>
                  <PendingButton className="task-action" pendingText="Lendo o laudo de novo. Pode levar até um minuto.">
                    <RotateCcw size={16} aria-hidden /> Tentar ler de novo
                  </PendingButton>
                </form>
              ) : null}
              <Link href={base} className={canRetry ? "inline-flex min-h-12 items-center text-sm font-bold text-ink underline underline-offset-4" : "task-action"}>
                Ir para o estudo de caso {canRetry ? null : <ArrowRight size={16} aria-hidden />}
              </Link>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
