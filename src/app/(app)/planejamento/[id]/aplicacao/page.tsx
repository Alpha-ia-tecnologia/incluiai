import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck, CalendarDays, CalendarX, Eye, Scale, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { DuaError, studentsInReach } from "@/lib/dua/shared";
import { loadPlanning } from "@/lib/dua/plannings";
import { listApplications } from "@/lib/dua/applications";
import { CRITERION_STATUSES, CRITERION_STATUS_LABEL, isObserved } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { linkCls } from "@/components/dua/dua-ui";
import { NewApplicationForm } from "@/components/dua/applications/new-application-form";
import { ApplicationCard, inputDate } from "@/components/dua/applications/application-card";
import { DataBoard, DataCard, StatTile, withSegmentColors } from "@/components/data-viz";
import { StackedBar } from "@/components/charts";
import { ShareRing } from "@/components/viz/share-ring";
import { Assurances, HowToRead, Steps } from "@/components/explain";

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

  // Resumo das evidências que a pessoa pode ver (os dados já carregados acima).
  // Critério observado (demonstrou, em parte, ainda não) fica na barra; "sem
  // oportunidade" e "não registrado" ficam à parte: não são progresso nem "ainda não".
  const statuses = applications.flatMap((application) => application.evidences.flatMap((evidence) => evidence.criteria.map((item) => item.status)));
  const criterionRows = CRITERION_STATUSES.map((status) => ({ key: status, label: CRITERION_STATUS_LABEL[status], value: statuses.filter((item) => item === status).length }));
  const observedSegments = withSegmentColors(criterionRows.filter((row) => isObserved(row.key)));
  const outsideRows = criterionRows.filter((row) => !isObserved(row.key));
  // Documentação geral: participações visíveis em aplicações não canceladas com
  // evidência registrada (observada ou "sem oportunidade"), como no painel.
  const active = applications.filter((application) => application.state !== "cancelada");
  const participations = active.reduce((sum, application) => sum + application.participants.length, 0);
  const documented = active.reduce((sum, application) => sum + application.participants.filter((person) => application.evidences.some((evidence) => evidence.studentId === person.id && evidence.observation !== "nao_registrado")).length, 0);

  return (
    <div className="grid min-w-0 gap-8">
      <section aria-labelledby="aplicacao-titulo" className="max-w-3xl min-w-0">
        <h2 id="aplicacao-titulo" className="mb-3 font-display text-xl font-medium text-ink">Aplicação e evidências</h2>
        <Steps
          label="Como registrar"
          items={[
            { icon: CalendarDays, label: "Quando e onde" },
            { icon: Users, label: "Com quem" },
            { icon: Eye, label: "O que foi observado" },
          ]}
        />
        <Assurances
          label="O que concluir uma aplicação não faz"
          className="mt-3"
          items={[
            { icon: CalendarX, text: "Não registra presença nem atendimento" },
            { icon: Scale, text: "Não conclui sobre a aprendizagem" },
            { icon: CalendarCheck, text: "Frequência do AEE tem registro próprio" },
          ]}
        />
        <HowToRead summary="Situação da aplicação" className="mt-1">
          Planejada, em andamento, concluída ou cancelada: a situação de execução é separada da revisão pedagógica do planejamento.
        </HowToRead>
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
            Só uma versão validada pode ser aplicada.{" "}
            <Link href={`/planejamento/${planning.id}?etapa=4`} className={linkCls}>Ir para a revisão</Link>
          </p>
        )}
      </Card>

      <section aria-labelledby="aplicacoes-titulo" className="min-w-0">
        <h2 id="aplicacoes-titulo" className="mb-4 font-display text-xl font-medium text-ink">Aplicações registradas ({applications.length})</h2>
        {applications.length ? (
          <DataBoard className="mb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <StatTile
              label="Documentação das participações"
              value={`${documented} de ${participations}`}
              chart={<ShareRing id="documentacao-geral" part={documented} whole={participations} label="Documentação das participações" caption="das participações têm evidência registrada (sem contar as canceladas)." />}
              hint="Só estudantes do seu acesso. Mede o registro, não a aprendizagem."
            />
            <DataCard title="Critérios nas evidências registradas" hint="Todas as aplicações desta atividade. Não é nota.">
              <StackedBar segments={observedSegments} empty="Nenhum critério observado ainda." />
              <div className="mt-4 rounded-2xl bg-surface-muted/70 px-3.5 py-3">
                <p className="text-xs font-medium text-ink">Fora da análise</p>
                <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                  {outsideRows.map((row) => (
                    <li key={row.key} className="inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-dashed border-line bg-paper-raised px-3 py-1.5 text-xs text-ink">
                      <span className="min-w-0">{row.label}</span>
                      <span className="tabular-nums font-medium">{row.value}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">Não são progresso nem “ainda não demonstrou”.</p>
              </div>
            </DataCard>
          </DataBoard>
        ) : null}
        {applications.length ? (
          <ul className="grid min-w-0 gap-4">
            {applications.map((application) => (
              <li key={application.id} className="min-w-0">
                <ApplicationCard planningId={planning.id} application={application} students={students} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState character="planning" title="Nenhuma aplicação registrada" hint={validatedOptions.length ? "Registre a primeira no formulário acima." : "Registre aqui depois da validação."} />
        )}
      </section>
    </div>
  );
}
