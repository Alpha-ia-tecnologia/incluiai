import { PRINCIPLE_LABEL, type DuaContent } from "@/lib/dua/domain";
import { ContentSummary } from "../content-summary";

export function VersionSummary({ content }: { content: DuaContent }) {
  return (
    <ContentSummary content={content}>
      <div className="min-w-0">
        <dt className="font-medium text-ink">Opções de acesso e participação</dt>
        <dd>
          {content.strategies.length ? (
            <ol className="list-decimal pl-5 text-ink-soft">
              {content.strategies.map((item) => (
                <li key={item.id} className="break-words">
                  {item.description || "sem descrição"}
                  {item.principles.length ? <span className="text-xs"> ({item.principles.map((principle) => PRINCIPLE_LABEL[principle] ?? principle).join(", ")})</span> : null}
                </li>
              ))}
            </ol>
          ) : <span className="text-ink-soft">Nenhuma selecionada</span>}
        </dd>
      </div>
    </ContentSummary>
  );
}
