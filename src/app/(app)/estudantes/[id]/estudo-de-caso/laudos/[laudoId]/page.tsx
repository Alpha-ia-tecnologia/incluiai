import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, RotateCcw, Sprout, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canSeeClinicalDetail, requireStudentPage } from "@/lib/auth";
import { recordView } from "@/lib/access-log";
import { parseCaseStudy } from "@/lib/case-study";
import { REPORT_FIELDS, RETRY_STATUSES, isReadingStalled, parseAccepted, parseReading, reviewRows, type ReviewRow } from "@/lib/health-report";
import { formatDate } from "@/lib/format";
import { deleteHealthReport, retryHealthReport, reviewHealthReport } from "@/actions/health-reports";
import { AIDisclaimer, ButtonLink, Card, PageHeader } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { choiceCls, dangerButtonCls, linkCls, primaryButtonCls, quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const h3 = "text-base font-semibold text-ink";
const quote = (value: string) => `“${value}”`;
const listText = (values: string[]) => values.map(quote).join(", ");
const checkboxCls = "size-5 shrink-0 accent-[var(--brand)]";

function Excerpt({ text }: { text: string }) {
  if (!text) return null;
  return <p className="mt-3 border-l-2 border-line pl-3 text-sm leading-relaxed text-ink-soft">No laudo: {quote(text)}</p>;
}

function SuggestionRow({ row }: { row: ReviewRow }) {
  // Campo de uma resposta só que já tem resposta: a sugestão troca, então vem desmarcada.
  const replacing = row.field.type !== "multi" && row.current.length > 0;
  return (
    <fieldset className="min-w-0 rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
      <legend className="float-left mb-1 w-full text-base font-medium text-ink">{row.field.label}</legend>
      <p className="clear-both text-sm text-ink-soft">Já registrado: {row.current.length ? row.current.join(", ") : "nada ainda"}</p>
      <div className="mt-3 grid gap-2">
        {row.fresh.map((value) => (
          <label key={value} className={choiceCls}>
            <input type="checkbox" name={`campo:${row.field.key}`} value={value} defaultChecked={!replacing} className={checkboxCls} />
            <span className="min-w-0">{replacing ? `Trocar por ${quote(value)}` : `Juntar ${quote(value)}`}</span>
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
  const user = await requireStudentPage(id);
  // Só o AEE e a coordenação; a leitura vai para o histórico depois da permissão.
  if (!canSeeClinicalDetail(user.role)) redirect(`/estudantes/${id}/estudo-de-caso`);
  await recordView(user, id, "Laudos do estudo de caso");
  const { revisado } = await searchParams;

  const [student, report, caseStudy] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.healthReport.findUnique({
      where: { id: laudoId },
      select: {
        id: true, studentId: true, fileName: true, mimeType: true, status: true, reading: true, privacyNote: true, failure: true,
        uploadedBy: true, createdAt: true, reviewedBy: true, reviewedAt: true, accepted: true,
      },
    }),
    prisma.caseStudy.findUnique({ where: { studentId: id }, select: { content: true } }),
  ]);
  if (!report || report.studentId !== id) notFound();

  const firstName = student.name.split(" ")[0];
  const base = `/estudantes/${id}/estudo-de-caso`;
  const reading = parseReading(report.reading);
  const accepted = parseAccepted(report.accepted);
  const rows = reading && !report.reviewedAt ? reviewRows(reading, parseCaseStudy(caseStudy?.content)) : [];
  const freshRows = rows.filter((row) => row.fresh.length > 0);
  const confirmed = rows.filter((row) => row.fresh.length === 0 && row.known.length > 0);
  const nothingNew = Boolean(reading) && freshRows.length === 0 && (reading?.guidance.length ?? 0) === 0;
  const stale = isReadingStalled(report.status, report.createdAt);
  // "falhou" só volta quando a falha foi na IA (há nota de privacidade); PDF com senha ou danificado precisa de outro arquivo.
  const canRetry = !report.reviewedAt && RETRY_STATUSES.has(report.status) && (report.status !== "lendo" || stale) && (report.status !== "falhou" || Boolean(report.privacyNote));
  const joinedFields = REPORT_FIELDS.filter((field) => accepted.fields[field.key]?.length);

  return (
    <>
      <Link href={`${base}/laudos`} className={`${linkCls} mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm print:hidden`}>
        <ArrowLeft size={16} aria-hidden /> Laudos e relatórios de saúde
      </Link>
      <PageHeader
        level={2}
        title="Leitura do laudo"
        lede={`${report.fileName} · anexado por ${report.uploadedBy} em ${formatDate(report.createdAt)}.`}
        actions={
          <a href={`/api/laudos/${report.id}`} target="_blank" rel="noopener" className={`${quietButtonCls} print:hidden`}>
            Abrir o arquivo <ExternalLink size={15} aria-hidden /><span className="sr-only"> (abre em nova aba)</span>
          </a>
        }
      />

      <div className="max-w-3xl space-y-6">
        {report.reviewedAt ? (
          <>
            {revisado ? (
              <p role="status" className="flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-sm font-medium text-green">
                <Sprout size={18} aria-hidden className="sprout-mark" /> Revisão salva. {joinedFields.length ? "O estudo de caso foi atualizado." : "Nada foi juntado ao estudo de caso."}
              </p>
            ) : null}
            <Card>
              <h3 className={h3}>O que a equipe juntou</h3>
              <p className="mt-1 text-sm text-ink-soft">Revisado por {report.reviewedBy} em {formatDate(report.reviewedAt)}.</p>
              {joinedFields.length || accepted.guidance.length ? (
                <dl className="mt-4 space-y-3 text-sm">
                  {joinedFields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-ink-soft">{field.label}</dt>
                      <dd className="text-base text-ink">{accepted.fields[field.key]?.join(", ")}</dd>
                    </div>
                  ))}
                  {accepted.guidance.length ? (
                    <div>
                      <dt className="text-ink-soft">Orientações para a escola</dt>
                      <dd>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-base text-ink">
                          {accepted.guidance.map((text) => <li key={text}>{text}</li>)}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : <p className="mt-4 text-base text-ink">A equipe revisou as sugestões e não juntou nenhuma.</p>}
              <ButtonLink href={base} variant="secondary" className="mt-5">
                Abrir o estudo de caso <ArrowRight size={16} aria-hidden />
              </ButtonLink>
            </Card>
            {reading?.summary ? (
              <section aria-labelledby="resumo-titulo" className="px-1">
                <h3 id="resumo-titulo" className="text-sm font-medium text-ink">O que a IA leu no laudo</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{reading.summary}</p>
              </section>
            ) : null}
          </>
        ) : report.status === "lido" && reading ? (
          <>
            <Card>
              <h3 className={h3}>O que o laudo traz para a escola</h3>
              {reading.documentType === "outro" ? (
                <p className="mt-3 text-base font-medium text-ink">A IA não reconheceu este arquivo como laudo ou relatório de saúde. Confira se é o documento certo.</p>
              ) : null}
              <p className="mt-3 text-base leading-relaxed text-ink">{reading.summary}</p>
              {reading.limits ? <p className="mt-3 text-sm leading-relaxed text-ink-soft"><span className="font-medium text-ink">Limites da leitura:</span> {reading.limits}</p> : null}
              <AIDisclaimer />
              {report.privacyNote ? <p className="mt-3 text-xs leading-relaxed text-ink-soft">{report.privacyNote}</p> : null}
            </Card>

            <form action={reviewHealthReport.bind(null, report.id)} className="space-y-6">
              {reading.guidance.length ? (
                <fieldset className="min-w-0 space-y-3">
                  <legend className={`${h3} mb-1`}>Orientações para a escola</legend>
                  <p className="text-sm leading-relaxed text-ink-soft">As marcadas aparecem no resumo de {firstName} e ajudam a IA a propor o plano individual.</p>
                  <div className="grid gap-2">
                    {reading.guidance.map((item, index) => (
                      <label key={item.text} className={choiceCls}>
                        <input type="checkbox" name="orientacao" value={index} defaultChecked className={checkboxCls} />
                        <span className="min-w-0">
                          {item.text}
                          {item.excerpt ? <span className="mt-1 block text-xs leading-relaxed text-ink-soft">No laudo: {quote(item.excerpt)}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {freshRows.length ? (
                <div className="space-y-3">
                  <h3 className={h3}>Para o estudo de caso</h3>
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

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                <PendingButton className={primaryButtonCls} pendingText="Salvando a revisão…">
                  {nothingNew ? "Marcar como revisado" : "Juntar ao estudo de caso"} <ArrowRight size={16} aria-hidden />
                </PendingButton>
                {!nothingNew ? (
                  <button type="submit" name="intent" value="descartar" className={quietButtonCls}>
                    Descartar as sugestões
                  </button>
                ) : null}
              </div>
            </form>
          </>
        ) : (
          <Card>
            {report.status === "sem_texto" ? (
              <>
                <h3 className={h3}>A IA não consegue ler este arquivo</h3>
                <p className="mt-3 text-base leading-relaxed text-ink">
                  {report.mimeType === "application/pdf" ? "Este PDF não tem texto que a plataforma consiga extrair, como acontece com documentos escaneados." : "Este arquivo é uma imagem (foto ou digitalização)."}{" "}
                  Ele ficou guardado para a equipe consultar. Abra o arquivo e registre no estudo de caso o que for útil para a escola.
                </p>
              </>
            ) : report.status === "sem_autorizacao" ? (
              <>
                <h3 className={h3}>Laudo guardado, sem leitura pela IA</h3>
                <p className="mt-3 text-base leading-relaxed text-ink">
                  A família de {firstName} ainda não autorizou o uso de IA, e nada foi enviado. O arquivo ficou guardado para a equipe consultar e registrar no estudo de caso o que for útil. A família decide no portal dela; depois da autorização, peça a leitura aqui.
                </p>
              </>
            ) : report.status === "ia_desligada" ? (
              <>
                <h3 className={h3}>Laudo guardado, sem leitura pela IA</h3>
                <p className="mt-3 text-base leading-relaxed text-ink">A leitura pela IA está desligada nesta instalação. O arquivo ficou guardado para a equipe consultar e registrar no estudo de caso o que for útil.</p>
              </>
            ) : report.status === "lendo" && !stale ? (
              <>
                <h3 className={h3}>A IA ainda está lendo este laudo</h3>
                <p className="mt-3 text-base leading-relaxed text-ink">Atualize a página em instantes para ver as sugestões.</p>
              </>
            ) : (
              <>
                <h3 className={h3}>A leitura não terminou</h3>
                <p className="mt-3 text-base leading-relaxed text-ink">{report.failure ?? "A leitura pela IA foi interrompida. O arquivo continua guardado."}</p>
              </>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {canRetry ? (
                <form action={retryHealthReport.bind(null, report.id)}>
                  <PendingButton className={primaryButtonCls} pendingText="Lendo o laudo. Pode levar até um minuto.">
                    <RotateCcw size={16} aria-hidden /> {report.status === "sem_autorizacao" ? "Pedir a leitura" : "Tentar ler de novo"}
                  </PendingButton>
                </form>
              ) : null}
              <ButtonLink href={base} variant={canRetry ? "quiet" : "primary"}>
                Ir para o estudo de caso {canRetry ? null : <ArrowRight size={16} aria-hidden />}
              </ButtonLink>
            </div>
          </Card>
        )}

        <details className="rounded-2xl bg-surface-muted p-4 print:hidden">
          <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Excluir este laudo</summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">O arquivo e a leitura da IA saem da plataforma. O que já foi juntado ao estudo de caso continua lá.</p>
          <form action={deleteHealthReport.bind(null, report.id)} className="mt-3">
            <button type="submit" className={dangerButtonCls}><Trash2 size={16} aria-hidden /> Excluir o laudo</button>
          </form>
        </details>
      </div>
    </>
  );
}
