import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { reportStatus } from "@/lib/health-report";
import { formatDate } from "@/lib/format";
import { uploadHealthReport } from "@/actions/health-reports";
import { HealthReportUpload } from "@/components/health-report-upload";
import { PageHeader } from "@/components/ui";

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
  const { excluido } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true, schoolId: true } });
  if (!isStaffOrNetwork(user.role) || !canSeePedagogicalDetail(user.role) || !canAccessStudent(user, student.schoolId, id)) redirect(`/estudantes/${id}`);

  const reports = await prisma.healthReport.findMany({
    where: { studentId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, size: true, status: true, uploadedBy: true, reviewedAt: true, reviewedBy: true, createdAt: true },
  });
  const firstName = student.name.split(" ")[0];
  const upload = uploadHealthReport.bind(null, id);

  return (
    <>
      <Link href={`/estudantes/${id}/estudo-de-caso`} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-pen underline underline-offset-4 print:hidden">
        <ArrowLeft size={16} aria-hidden /> Estudo de caso
      </Link>
      <PageHeader
        title="Laudos e relatórios de saúde"
        lede={`Opcional: o AEE é pedagógico e não depende de laudo. Se a família entregou um laudo de ${firstName}, anexe aqui. A IA lê o texto e sugere o que juntar ao estudo de caso, e você confere cada sugestão antes.`}
      />

      {excluido ? (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-lg bg-green-soft px-4 py-3 text-sm font-bold text-green">
          <CheckCircle2 size={18} aria-hidden /> Laudo excluído. O que já tinha sido juntado ao estudo de caso continua lá.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="laudos-titulo" className="min-w-0">
          <h2 id="laudos-titulo" className="mb-3 font-display text-xl font-extrabold text-ink">Anexados</h2>
          {reports.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-5 py-8 text-sm leading-relaxed text-ink-soft">
              Nenhum laudo anexado. O estudo de caso pode ser feito e concluído sem laudo.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
              {reports.map((report) => {
                const status = reportStatus(report.status, report.reviewedAt);
                return (
                  <li key={report.id}>
                    <Link href={`/estudantes/${id}/estudo-de-caso/laudos/${report.id}`} className="group flex min-h-16 items-center gap-4 px-5 py-3.5 hover:bg-paper">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-bold text-ink">{report.fileName}</span>
                        <span className="block text-sm text-ink-soft">
                          {formatDate(report.createdAt)} · anexado por {report.uploadedBy} · {sizeText(report.size)}
                        </span>
                      </span>
                      <span className={`shrink-0 text-sm ${status.needsReview ? "font-bold text-pen" : "text-ink-soft"}`}>
                        {status.needsReview ? "Revisar sugestões" : status.label}
                      </span>
                      <ArrowRight size={16} className="shrink-0 text-ink transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-labelledby="anexar-titulo" className="space-y-5 self-start">
          <section className="ui-card">
            <h2 id="anexar-titulo" className="mb-4 font-display text-xl font-extrabold text-ink">Anexar um laudo</h2>
            <HealthReportUpload action={upload} />
          </section>
          <section aria-labelledby="privacidade-titulo" className="px-1">
            <h2 id="privacidade-titulo" className="text-sm font-bold text-ink">Como o laudo é tratado</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>O arquivo fica guardado aqui. Só a equipe pedagógica de {firstName} abre, e cada abertura vai para o histórico de acessos que a família vê.</li>
              <li>A IA não recebe o arquivo, só o texto. Antes do envio, nomes conhecidos, CPF, RG, CRM, cartão do SUS, telefones, datas e endereços viram marcadores.</li>
              <li>Nada entra no estudo de caso sem a sua revisão.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
