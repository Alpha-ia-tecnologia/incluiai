import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { NOMINAL_ACCESS_HOURS, canAccessStudent, getCurrentUser, hasNominalAccess, needsNominalJustification } from "@/lib/auth";
import { requestNominalAccess } from "@/actions/access";
import { Card, PageHeader } from "@/components/ui";
import { NominalAccessForm } from "@/components/nominal-access-form";

export const dynamic = "force-dynamic";

// A Secretaria acompanha a rede pelos números do Painel. Abrir a ficha de um
// estudante com nome pede o motivo, que fica registrado e a família vê.
export default async function NominalAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!needsNominalJustification(user.role)) redirect(`/estudantes/${id}`);
  const student = await prisma.student.findUnique({ where: { id }, select: { id: true, name: true, schoolId: true, className: true, school: { select: { name: true } } } });
  if (!student || !canAccessStudent(user, student.schoolId, student.id)) notFound();
  if (await hasNominalAccess(user, student.id)) redirect(`/estudantes/${student.id}`);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Abrir a ficha com nome" lede="A Secretaria acompanha a rede pelos números do Painel. Para ver os dados de um estudante pelo nome, informe o motivo: o acesso vale por algumas horas e fica no histórico que a família consulta." />
      <Card className="mb-6 flex items-start gap-3 bg-surface-muted">
        <ShieldCheck size={20} aria-hidden className="mt-0.5 shrink-0 text-brand-strong" />
        <div className="min-w-0 text-sm leading-relaxed">
          <p className="font-medium text-ink">{student.name}</p>
          <p className="text-ink-soft">{student.className} · {student.school.name}</p>
          <p className="mt-2 text-ink-soft">O acesso vale por {NOMINAL_ACCESS_HOURS} horas, só para leitura: a Secretaria não registra aulas, planos ou atividades na ficha.</p>
        </div>
      </Card>
      <Card>
        <NominalAccessForm action={requestNominalAccess.bind(null, student.id)} />
      </Card>
    </div>
  );
}
