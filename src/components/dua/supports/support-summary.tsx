import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { BARRIER_STATUS_LABEL, type DuaSupportData } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";

// Leitura do apoio individual, usada no planejamento e na página do estudante.
// Sem hooks: renderiza no servidor, dentro do recorte já filtrado pela camada de dados.

function Item({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-medium text-ink">{term}</dt>
      <dd className="mt-1 break-words text-ink-soft">{children}</dd>
    </div>
  );
}

export function SupportSummary({ data, showProfile = true }: { data: DuaSupportData; showProfile?: boolean }) {
  const profileRefs = data.profileRefs ?? [];
  const planLinks = data.planLinks ?? [];
  const individual = data.individualObjective;
  const individualLink = individual?.objectiveId ? planLinks.find((link) => link.objectiveId === individual.objectiveId) : undefined;

  return (
    <dl className="grid min-w-0 gap-3 text-sm">
      <Item term="Barreira nesta atividade">
        <span className="whitespace-pre-line">{data.barrier?.description || "Não descrita."}</span>{" "}
        {data.barrier?.description ? <Badge tone="neutral">{BARRIER_STATUS_LABEL[data.barrier.status] ?? data.barrier.status}</Badge> : null}
      </Item>
      <Item term="Recurso ou intervenção">
        <span className="whitespace-pre-line">{data.support || "Ainda não descrito."}</span>
      </Item>
      <Item term="Finalidade">
        <span className="whitespace-pre-line">{data.purpose || "Ainda não descrita."}</span>
      </Item>
      {data.usageContext ? <Item term="Quando e onde usar">{data.usageContext}</Item> : null}
      {showProfile ? (
        <Item term="Referências do perfil">
          {profileRefs.length ? (
            <ul className="grid gap-1">
              {profileRefs.map((ref) => (
                <li key={ref.field}>
                  <span className="text-ink">{ref.label}:</span> {ref.value}{" "}
                  <span className="text-xs">({ref.source} · {ref.updatedAt ? formatDate(ref.updatedAt) : "sem data"})</span>
                </li>
              ))}
            </ul>
          ) : "Nenhuma referência escolhida."}
        </Item>
      ) : null}
      <Item term="Objetivos do Plano de ensino ligados">
        {planLinks.length ? (
          <ul className="grid list-disc gap-1 pl-5">
            {planLinks.map((link) => <li key={link.objectiveId}>{link.description}</li>)}
          </ul>
        ) : "Nenhum objetivo ligado."}
      </Item>
      {individual?.text ? (
        <Item term="Objetivo individual diferente do coletivo">
          <span className="block whitespace-pre-line text-ink">{individual.text}</span>
          <span className="mt-1 block">Justificativa: {individual.justification || "ainda não registrada."}</span>
          <span className="mt-1 block">Ligado ao plano: {individualLink?.description ?? (individual.objectiveId ? "objetivo do Plano de ensino" : "ainda sem vínculo.")}</span>
        </Item>
      ) : null}
    </dl>
  );
}
