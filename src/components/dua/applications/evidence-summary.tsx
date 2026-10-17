import { CRITERION_STATUS_LABEL, OBSERVATION_LABEL, type CriterionStatus, type EvidenceObservation } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui";

export type EvidenceSummaryData = {
  date: Date;
  authorName: string;
  observation: EvidenceObservation;
  criteria: { criterionId: string; description: string; status: CriterionStatus }[];
  optionsOffered: string[];
  participationForm: string;
  studentChoice: string;
  supportProvided: string;
  observedResponse: string;
  remainingBarriers: string;
  nextStep: string;
};

// Tom do estado de cada critério: só o que foi observado ganha cor de resultado;
// "sem oportunidade" e "não registrado" ficam neutros (não são "ainda não").
const STATUS_TONE: Record<CriterionStatus, "green" | "brand" | "amber" | "neutral"> = {
  demonstrado: "green",
  parcial: "brand",
  ainda_nao_demonstrado: "amber",
  sem_oportunidade: "neutral",
  nao_registrado: "neutral",
};

export const observationTone = (observation: EvidenceObservation) => (observation === "observado" ? "green" : "neutral");

// Resumo do registro já feito, para conferir antes de atualizar.
export function EvidenceSummary({ evidence }: { evidence: EvidenceSummaryData }) {
  const texts = [
    { label: "Forma de participação", value: evidence.participationForm },
    { label: "Escolha ou manifestação do estudante", value: evidence.studentChoice },
    { label: "Apoio oferecido", value: evidence.supportProvided },
    { label: "Resposta observada", value: evidence.observedResponse },
    { label: "Barreiras que permaneceram", value: evidence.remainingBarriers },
    { label: "Próximo passo sugerido", value: evidence.nextStep },
  ].filter((item) => item.value.trim());

  return (
    <div className="min-w-0 rounded-xl bg-surface-muted p-3 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-medium text-ink">Registro atual</span>
        <Badge tone={observationTone(evidence.observation)}>{OBSERVATION_LABEL[evidence.observation]}</Badge>
        <span className="text-ink-soft">Observação de {formatDate(evidence.date)} · registrada por {evidence.authorName}</span>
      </div>
      {evidence.criteria.length ? (
        <ul className="mt-2 grid min-w-0 gap-1">
          {evidence.criteria.map((item) => (
            <li key={item.criterionId} className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 break-words text-ink-soft">{item.description}</span>
              <Badge tone={STATUS_TONE[item.status]}>{CRITERION_STATUS_LABEL[item.status]}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {evidence.optionsOffered.length ? <p className="mt-2 break-words text-ink-soft"><span className="font-medium text-ink">Opções oferecidas:</span> {evidence.optionsOffered.join("; ")}</p> : null}
      {texts.length ? (
        <dl className="mt-2 grid min-w-0 gap-1">
          {texts.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="inline font-medium text-ink">{item.label}: </dt>
              <dd className="inline break-words text-ink-soft">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
