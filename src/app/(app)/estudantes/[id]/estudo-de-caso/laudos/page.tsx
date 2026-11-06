import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldAlert, Sprout } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canSeeClinicalDetail, requireStudentPage } from "@/lib/auth";
import { recordView } from "@/lib/access-log";
import { studentConsent } from "@/lib/consent";
import { hasApiKey } from "@/lib/env";
import { reportStatus } from "@/lib/health-report";
import { formatDate } from "@/lib/format";
import { uploadHealthReport } from "@/actions/health-reports";
import { HealthReportUpload } from "@/components/health-report-upload";
import { Badge, Card, PageHeader } from "@/components/ui";
import { linkCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default async function HealthReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ excluido?: string }>;
}) {
  const { id } = await params;
  const user = await requireStudentPage(id);
  // Laudo é dado clínico: só o AEE e a coordenação. A leitura só vai para o
  // histórico depois da permissão, para não registrar quem foi redirecionado.
  if (!canSeeClinicalDetail(user.role)) redirect(`/estudantes/${id}/estudo-de-caso`);
  await recordView(user, id, "Laudos do estudo de caso");
  const { excluido } = await searchParams;

  const [student, reports, consent] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.healthReport.findMany({
      where: { studentId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, size: true, status: true, uploadedBy: true, reviewedAt: true, createdAt: true },
    }),
    studentConsent(id),
  ]);
  const firstName = student.name.split(" ")[0];
  const upload = uploadHealthReport.bind(null, id);
  // Só o Claude lê laudos: sem a chave dele, ou sem a autorização da família, o laudo fica guardado sem leitura.
  const consentMissing = hasApiKey("ANTHROPIC_API_KEY") && !consent.aiUse;

  return (
    <>
      <Link href={`/estudantes/${id}/estudo-de-caso`} className={`${linkCls} mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm print:hidden`}>
        <ArrowLeft size={16} aria-hidden /> Estudo de caso
      </Link>
      <PageHeader
        level={2}
        title="Laudos e relatórios de saúde"
        lede={`Opcional: o AEE é pedagógico e não depende de laudo. Se a família entregou um laudo de ${firstName}, anexe aqui. A IA lê o texto e sugere o que juntar ao estudo de caso, e você confere cada sugestão antes.`}
      />

      {excluido ? (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-sm font-medium text-green">
          <Sprout size={18} aria-hidden className="sprout-mark" /> Laudo excluído. O que já tinha sido juntado ao estudo de caso continua lá.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="laudos-titulo" className="min-w-0">
          <h3 id="laudos-titulo" className="mb-3 text-base font-semibold text-ink">Anexados</h3>
          {reports.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-surface-muted/40 px-5 py-8 text-sm leading-relaxed text-ink-soft">
              Nenhum laudo anexado. O estudo de caso pode ser feito e concluído sem laudo.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
              {reports.map((report) => {
                const status = reportStatus(report.status, report.reviewedAt);
                return (
                  <li key={report.id}>
                    <Link href={`/estudantes/${id}/estudo-de-caso/laudos/${report.id}`} className="group flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-muted/60">
                      <span className="min-w-0 flex-1 basis-56">
                        <span className="block truncate text-base font-medium text-ink">{report.fileName}</span>
                        <span className="block text-sm text-ink-soft">
                          {formatDate(report.createdAt)} · anexado por {report.uploadedBy} · {sizeText(report.size)}
                        </span>
                      </span>
                      <Badge tone={status.needsReview ? "brand" : report.reviewedAt ? "green" : "neutral"}>{status.needsReview ? "Revisar sugestões" : status.label}</Badge>
                      <ArrowRight size={16} className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="min-w-0 space-y-5 self-start">
          <Card>
            <h3 className="mb-4 text-base font-semibold text-ink">Anexar um laudo</h3>
            {consentMissing ? (
              <p role="note" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-amber">
                <ShieldAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
                A família ainda não autorizou o uso de IA: o laudo fica guardado, sem leitura pela IA. A família decide no portal dela.
              </p>
            ) : null}
            <HealthReportUpload action={upload} />
          </Card>
          <section aria-labelledby="privacidade-titulo" className="px-1">
            <h3 id="privacidade-titulo" className="text-sm font-medium text-ink">Como o laudo é tratado</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>O arquivo fica guardado aqui. Só o AEE e a coordenação abrem, e cada abertura vai para o histórico de acessos que a família vê.</li>
              <li>A IA só lê o laudo se a família autorizou o uso de IA. Ela não recebe o arquivo, só o texto. Antes do envio, nomes conhecidos, CPF, RG, CRM, cartão do SUS, telefones, datas e endereços viram marcadores.</li>
              <li>Nada entra no estudo de caso sem a sua revisão.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
