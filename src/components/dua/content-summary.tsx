import type { ReactNode } from "react";
import { BARRIER_STATUS_LABEL, type DuaContent } from "@/lib/dua/domain";

export function ContentSummary({ content, children }: { content: DuaContent; children?: ReactNode }) {
  return (
    <dl className="grid min-w-0 gap-3 text-sm">
      <div className="min-w-0">
        <dt className="font-medium text-ink">Atividade</dt>
        <dd className="break-words text-ink-soft">{content.title || "Sem título"}</dd>
      </div>
      <div className="min-w-0">
        <dt className="font-medium text-ink">O que os estudantes precisam aprender</dt>
        <dd className="break-words text-ink-soft">{content.objective.learning || "Ainda não definido"}{content.objective.bnccCodes.length ? ` · BNCC ${content.objective.bnccCodes.join(", ")}` : ""}{content.objective.curriculum ? ` · ${content.objective.curriculum}` : ""}</dd>
      </div>
      <div className="min-w-0">
        <dt className="font-medium text-ink">Critérios observáveis</dt>
        <dd>
          {content.criteria.length ? (
            <ul className="list-disc pl-5 text-ink-soft">{content.criteria.map((item) => <li key={item.id} className="break-words">{item.description || "—"}</li>)}</ul>
          ) : <span className="text-ink-soft">Nenhum registrado</span>}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="font-medium text-ink">Barreiras consideradas</dt>
        <dd>
          {content.barriers.length ? (
            <ul className="list-disc pl-5 text-ink-soft">
              {content.barriers.map((item) => <li key={item.id} className="break-words">{item.description || "—"} <span className="text-sm">({(BARRIER_STATUS_LABEL[item.status] ?? item.status).toLowerCase()})</span></li>)}
            </ul>
          ) : <span className="text-ink-soft">Nenhuma registrada</span>}
        </dd>
      </div>
      {children}
    </dl>
  );
}
