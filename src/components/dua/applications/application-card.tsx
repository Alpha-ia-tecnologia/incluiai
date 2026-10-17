import { ChevronDown } from "lucide-react";
import type { ApplicationView, EvidenceView } from "@/lib/dua/applications";
import { APPLICATION_CONTEXT_LABEL, EXECUTION_STATE_LABEL, OBSERVATION_LABEL, type ExecutionState } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import { ApplicationManager } from "./application-manager";
import { EvidenceForm, type EvidenceDefaults } from "./evidence-form";
import { EvidenceSummary, observationTone } from "./evidence-summary";
import type { StudentOption } from "./participant-picker";
import { ShareRing } from "@/components/viz/share-ring";

const STATE_TONE: Record<ExecutionState, "neutral" | "brand" | "green" | "amber"> = {
  planejada: "neutral",
  em_andamento: "brand",
  concluida: "green",
  cancelada: "amber",
};

const summaryCls = "flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden";

// Data para <input type="date">, pelas partes locais (a aplicação é gravada ao meio-dia).
export const inputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function defaultsFor(application: ApplicationView, evidence: EvidenceView | undefined): EvidenceDefaults {
  return {
    date: inputDate(evidence?.date ?? application.date),
    statuses: Object.fromEntries((evidence?.criteria ?? []).map((item) => [item.criterionId, item.status])),
    optionIds: evidence?.optionIds ?? [],
    participationForm: evidence?.participationForm ?? "",
    studentChoice: evidence?.studentChoice ?? "",
    supportProvided: evidence?.supportProvided ?? "",
    observedResponse: evidence?.observedResponse ?? "",
    remainingBarriers: evidence?.remainingBarriers ?? "",
    nextStep: evidence?.nextStep ?? "",
  };
}

// Uma aplicação: versão, contexto, data, turma, situação e responsáveis; o
// controle de situação e participantes (para quem responde por ela) e o
// registro de evidência de cada participante visível, recolhido por estudante.
export function ApplicationCard({ planningId, application, students }: { planningId: string; application: ApplicationView; students: StudentOption[] }) {
  const evidenceByStudent = new Map(application.evidences.map((item) => [item.studentId, item]));
  const participantIds = new Set(application.participants.map((person) => person.id));
  // Evidência de quem foi retirado da aplicação continua visível (não se perde o registro).
  const withdrawn = application.evidences.filter((item) => !participantIds.has(item.studentId));
  const cancelled = application.state === "cancelada";
  const criteria = application.content.criteria.map(({ id, description }) => ({ id, description }));
  const strategies = application.content.strategies.map(({ id, description }) => ({ id, description }));
  const headingId = `aplicacao-${application.id}`;
  // Documentação: participantes visíveis com evidência registrada (observada ou
  // "sem oportunidade"), como no indicador do painel. Mede registro, não aprendizagem.
  const documented = application.participants.filter((person) => {
    const observation = evidenceByStudent.get(person.id)?.observation;
    return observation !== undefined && observation !== "nao_registrado";
  }).length;
  const details = [
    { label: "Onde", value: APPLICATION_CONTEXT_LABEL[application.context] },
    { label: "Turma ou grupo", value: application.className ?? "" },
    { label: "Responsáveis", value: application.responsibles.map((person) => person.name).join(", ") },
    { label: "Recursos disponíveis", value: application.resources ?? "" },
    { label: "Organização", value: application.organization ?? "" },
    { label: "Observações", value: application.notes ?? "" },
  ].filter((item) => item.value.trim());

  return (
    <Card className="min-w-0">
      <section aria-labelledby={headingId} className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <h3 id={headingId} className="min-w-0 break-words text-base font-medium text-ink">
            {application.context === "aee" ? "AEE" : "Sala comum"} · {formatDate(application.date)}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">Versão {application.versionNumber}</Badge>
            <Badge tone={STATE_TONE[application.state]}>{EXECUTION_STATE_LABEL[application.state]}</Badge>
          </div>
        </div>
        <dl className="mt-2 grid min-w-0 gap-1 text-sm">
          {details.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="inline font-medium text-ink">{item.label}: </dt>
              <dd className="inline break-words text-ink-soft">{item.value}</dd>
            </div>
          ))}
        </dl>
        {application.hiddenParticipants > 0 ? (
          <p className="mt-3 rounded-xl bg-surface-muted px-3 py-2 text-sm text-ink-soft">
            {application.hiddenParticipants} participante(s) fora do seu acesso: não aparecem aqui e não são alterados por você.
          </p>
        ) : null}

        {application.canManage ? (
          <details className="group mt-3 rounded-xl border border-line bg-paper">
            <summary className={`${summaryCls} font-medium text-brand-strong`}>
              <ChevronDown size={16} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
              Alterar situação e participantes
            </summary>
            <div className="border-t border-line p-3">
              <ApplicationManager
                planningId={planningId}
                applicationId={application.id}
                revision={application.revision}
                state={application.state}
                notes={application.notes ?? ""}
                className={application.className ?? ""}
                participants={application.participants}
                students={students}
              />
            </div>
          </details>
        ) : null}

        <h4 className="mt-5 text-sm font-medium text-ink">Participantes e evidências ({application.participants.length})</h4>
        {cancelled ? <p className="mt-1 text-sm text-ink-soft">Aplicação cancelada: não há evidência a registrar.</p> : null}
        {!cancelled && application.participants.length ? (
          <div className="mt-2 rounded-2xl bg-surface-muted/70 p-3">
            <ShareRing
              id={`documentacao-${application.id}`}
              part={documented}
              whole={application.participants.length}
              label="Documentação desta aplicação"
              caption={`${documented} de ${application.participants.length} ${application.participants.length === 1 ? "participante" : "participantes"} do seu acesso com evidência registrada (observada ou “sem oportunidade”). Mede o registro, não a aprendizagem.`}
            />
          </div>
        ) : null}
        {application.participants.length ? (
          <ul className="mt-2 grid min-w-0 gap-2">
            {application.participants.map((person) => {
              const evidence = evidenceByStudent.get(person.id);
              return (
                <li key={person.id} className="min-w-0">
                  <details className="group min-w-0 rounded-xl border border-line bg-paper-raised">
                    <summary className={summaryCls}>
                      <ChevronDown size={16} aria-hidden className="shrink-0 text-brand-strong transition-transform group-open:rotate-180" />
                      <span className="min-w-0 flex-1 break-words font-medium text-ink">{person.name}</span>
                      <Badge tone={evidence ? observationTone(evidence.observation) : "neutral"}>{evidence ? OBSERVATION_LABEL[evidence.observation] : "Ainda sem registro"}</Badge>
                    </summary>
                    <div className="grid min-w-0 gap-4 border-t border-line p-3">
                      {evidence ? <EvidenceSummary evidence={evidence} /> : null}
                      {!cancelled ? (
                        <EvidenceForm
                          planningId={planningId}
                          applicationId={application.id}
                          student={person}
                          criteria={criteria}
                          strategies={strategies}
                          defaults={defaultsFor(application, evidence)}
                          existing={Boolean(evidence)}
                        />
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">Nenhum participante no seu acesso{application.canManage ? ". Inclua participantes em “Alterar situação e participantes”." : "."}</p>
        )}

        {withdrawn.length ? (
          <div className="mt-4 min-w-0">
            <h4 className="text-sm font-medium text-ink">Registros de estudantes retirados da aplicação</h4>
            <ul className="mt-2 grid min-w-0 gap-2">
              {withdrawn.map((evidence) => (
                <li key={evidence.id} className="min-w-0">
                  <p className="mb-1 text-sm font-medium text-ink">{evidence.studentName}</p>
                  <EvidenceSummary evidence={evidence} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </Card>
  );
}
