import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DuaError, studentsInReach } from "@/lib/dua/shared";
import { loadPlanning } from "@/lib/dua/plannings";
import { listApplications } from "@/lib/dua/applications";
import { formatDate } from "@/lib/format";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { linkCls } from "@/components/dua/dua-ui";
import { NewApplicationForm } from "@/components/dua/applications/new-application-form";
import { ApplicationCard, inputDate } from "@/components/dua/applications/application-card";

export const dynamic = "force-dynamic";

const today = () => inputDate(new Date());

// Aplicação e evidências (RF07, CA10): quando, onde e com quem a atividade
// aconteceu, e o que foi observado com cada participante.
export default async function ApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let data;
  try {
    const loaded = await loadPlanning(user, id);
    const [applications, students] = await Promise.all([listApplications(user, id), studentsInReach(user)]);
    data = { ...loaded, applications, students };
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const { planning, versions, validated, applications, students } = data;
  const versionInfo = new Map(versions.map((item) => [item.version, item]));
  const validatedOptions = validated.map((item) => {
    const info = versionInfo.get(item.version);
    return {
      version: item.version,
      label: `Versão ${item.version}${info?.validatedAt ? ` · validada em ${formatDate(info.validatedAt)}${info.validatedByName ? ` por ${info.validatedByName}` : ""}` : ""}`,
      resources: item.content.context.resources.join(", "),
      organization: item.content.context.organization,
    };
  });

  return (
    <div className="grid min-w-0 gap-8">
      <section aria-labelledby="aplicacao-titulo" className="max-w-3xl min-w-0">
        <h2 id="aplicacao-titulo" className="mb-2 font-display text-xl font-medium text-ink">Aplicação e evidências</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Registre quando, onde e com quem a atividade aconteceu e, depois, o que foi observado com cada participante.
          A situação de execução (planejada, em andamento, concluída ou cancelada) é separada da revisão pedagógica do planejamento.
        </p>
        <p className="mt-2 rounded-xl bg-amber-soft px-3 py-2 text-sm leading-relaxed text-amber-900">
          Concluir uma aplicação não registra presença, não cria atendimento do AEE e não é conclusão sobre a aprendizagem.
          A frequência do AEE (realizado, falta ou cancelamento) tem registro próprio.
        </p>
      </section>

      <Card className="min-w-0">
        <SectionTitle>Registrar uma aplicação</SectionTitle>
        {validatedOptions.length ? (
          <NewApplicationForm
            planningId={planning.id}
            versions={validatedOptions}
            defaultClassName={planning.className ?? ""}
            defaultContext={user.role === "professor_aee" ? "aee" : "sala_comum"}
            today={today()}
            students={students}
          />
        ) : (
          <p className="text-sm leading-relaxed text-ink-soft">
            Só uma versão validada pode ser aplicada. Valide antes o planejamento, na etapa de revisão.{" "}
            <Link href={`/planejamento/${planning.id}?etapa=4`} className={linkCls}>Ir para a revisão</Link>
          </p>
        )}
      </Card>

      <section aria-labelledby="aplicacoes-titulo" className="min-w-0">
        <h2 id="aplicacoes-titulo" className="mb-4 font-display text-xl font-medium text-ink">Aplicações registradas ({applications.length})</h2>
        {applications.length ? (
          <ul className="grid min-w-0 gap-4">
            {applications.map((application) => (
              <li key={application.id} className="min-w-0">
                <ApplicationCard planningId={planning.id} application={application} students={students} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhuma aplicação registrada" hint={validatedOptions.length ? "Registre a primeira aplicação no formulário acima." : "Depois da validação, registre aqui cada vez que a atividade for aplicada."} />
        )}
      </section>
    </div>
  );
}
