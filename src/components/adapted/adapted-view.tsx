import { CheckSquare, MessageCircle, Paintbrush, PencilLine, Spline, TextCursorInput } from "lucide-react";
import { ANSWER_FORMAT_LABEL, highlightParts, printPages, type AdaptedContent, type AnswerFormat } from "@/lib/task-adaptation";

// A atividade adaptada como o estudante recebe (tela e impressão). Na tela, o
// apoio de cada questão aparece para o professor; na impressão, não.

const FORMAT_ICON: Record<AnswerFormat, typeof PencilLine> = {
  escrever: PencilLine, marcar: CheckSquare, ligar: Spline, completar: TextCursorInput, desenhar: Paintbrush, oral: MessageCircle,
};

function Prompt({ text, highlight }: { text: string; highlight: boolean }) {
  return (
    <p className="whitespace-pre-line leading-relaxed text-ink">
      {highlight ? highlightParts(text).map((part, index) => (part.command ? <strong key={index} className="font-semibold underline decoration-2 underline-offset-4">{part.text}</strong> : <span key={index}>{part.text}</span>)) : text}
    </p>
  );
}

// forStudent: a folha do estudante (impressão), sem o apoio do professor.
export function AdaptedView({ content, highlight, icons, largeText = false, itemsPerPage = null, forStudent = false }: {
  content: AdaptedContent;
  highlight: boolean;
  icons: boolean;
  largeText?: boolean;
  itemsPerPage?: number | null;
  forStudent?: boolean;
}) {
  const pages = printPages(content.items, itemsPerPage);
  return (
    <div className={`grid min-w-0 gap-5 ${largeText ? "text-lg print:text-xl" : "text-base"}`}>
      <div>
        <h3 className="break-words font-display text-2xl font-semibold tracking-tight text-ink">{content.title}</h3>
        {content.instructions.length ? <ul className="mt-2 grid gap-1 text-ink-soft">{content.instructions.map((line) => <li key={line}>{line}</li>)}</ul> : null}
      </div>
      {pages.map((page, pageIndex) => (
        <ol key={pageIndex} className={`grid min-w-0 gap-4 ${pageIndex > 0 ? "print:break-before-page" : ""}`}>
          {page.map((item) => {
            const Icon = FORMAT_ICON[item.answerFormat];
            return (
              <li key={item.number} className="min-w-0 rounded-2xl border border-line bg-paper p-4 print:break-inside-avoid">
                <div className="flex min-w-0 items-start gap-3">
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-medium tabular-nums text-brand-strong">{item.number}</span>
                  <div className="min-w-0 flex-1">
                    <Prompt text={item.prompt} highlight={highlight} />
                    {icons ? <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft"><Icon size={18} aria-hidden /> {ANSWER_FORMAT_LABEL[item.answerFormat]}</p> : null}
                    {item.options.length ? (
                      <ul className="mt-3 grid gap-2">
                        {item.options.map((option) => (
                          <li key={option} className="flex items-start gap-2"><span aria-hidden className="mt-1 size-5 shrink-0 rounded border-2 border-ink/50" /><span>{option}</span></li>
                        ))}
                      </ul>
                    ) : item.answerFormat === "escrever" || item.answerFormat === "completar" ? (
                      <div aria-hidden className="mt-3 grid gap-5 pt-2">{[0, 1].map((line) => <span key={line} className="block border-b border-ink/30" />)}</div>
                    ) : item.answerFormat === "desenhar" ? (
                      <div aria-hidden className="mt-3 h-32 rounded-xl border-2 border-dashed border-ink/30" />
                    ) : null}
                    {item.support && !forStudent ? <p className="mt-3 rounded-xl bg-sky-soft/60 px-3 py-2 text-sm text-ink print:hidden"><span className="font-medium">Para o professor:</span> {item.support}</p> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ))}
    </div>
  );
}
