import Link from "next/link";
import { CircleCheck, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canEditStudentRecord, requireStudentPage } from "@/lib/auth";
import { newReport } from "@/actions/reports";
import { currentSemester } from "@/lib/period-report";
import { periodLabel, reportData } from "@/lib/reports";
import { formatDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { NewReportForm } from "@/components/reports/report-forms";

export const dynamic = "force-dynamic";

// Relatórios do período (devolutiva à família): a plataforma junta os registros,
// a equipe escreve o parecer e valida. Quem só lê (Secretaria com motivo) vê os validados.
export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudentPage(id, "Relatórios do período");
  const team = canEditStudentRecord(user.role);
  const reports = await prisma.studentReport.findMany({
    where: { studentId: id, ...(team ? {} : { status: "validado" }) },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
    select: { id: true, status: true, data: true, validatedByName: true, validatedAt: true, updatedAt: true },
  });
  const semester = currentSemester();

  return (
    <>
      <PageHeader level={2} title="Relatórios do período" lede="O relatório junta o que foi registrado no período (objetivos, apoio, atendimentos e o que funcionou) com o parecer da equipe. Validado, a família lê no portal." />
      <div className="grid min-w-0 max-w-3xl gap-6">
        {team ? (
          <Card>
            <SectionTitle>Novo relatório</SectionTitle>
            <p className="mb-4 text-sm leading-relaxed text-ink-soft">Escolha o período. A plataforma monta o relatório com os registros e um rascunho do parecer, que você revisa antes de validar.</p>
            <NewReportForm action={newReport.bind(null, id)} start={semester.start} end={semester.end} />
          </Card>
        ) : null}
        {reports.length ? (
          <section aria-labelledby="relatorios-lista" className="min-w-0">
            <h3 id="relatorios-lista" className="mb-3 text-base font-medium text-ink">Relatórios ({reports.length})</h3>
            <ul className="grid gap-3">
              {reports.map((report) => (
                <li key={report.id} className="ui-card flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink"><Link href={`/estudantes/${id}/relatorios/${report.id}`} className="underline-offset-4 hover:underline">Período de {periodLabel(reportData(report.data))}</Link></p>
                    <p className="mt-1 text-xs text-ink-soft">{report.status === "validado" ? `Validado por ${report.validatedByName} em ${formatDate(report.validatedAt!)}` : `Rascunho, atualizado em ${formatDate(report.updatedAt)}`}</p>
                  </div>
                  {report.status === "validado" ? <Badge tone="green"><CircleCheck size={12} aria-hidden /> Validado</Badge> : <Badge tone="amber">Rascunho</Badge>}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState character="planning" title="Nenhum relatório ainda" hint={team ? "Monte o primeiro relatório escolhendo o período acima." : "Quando a equipe validar um relatório, ele aparece aqui."} action={undefined} />
        )}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft"><FileText size={14} aria-hidden className="mt-0.5 shrink-0" /> O relatório usa só a parte pedagógica do estudo de caso: diagnóstico, saúde e dados da família não entram.</p>
      </div>
    </>
  );
}
