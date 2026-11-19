import { Quote } from "lucide-react";

export function QuoteCard({ text, source }: { text: string; source: string }) {
  return (
    <figure className="dash-card relative min-w-0 overflow-hidden">
      <Quote size={40} aria-hidden className="absolute -right-1 -top-1 text-brand-soft" />
      <blockquote className="relative text-base leading-relaxed text-ink">{text}</blockquote>
      <figcaption className="relative mt-2 text-sm text-ink-soft">{source}</figcaption>
    </figure>
  );
}
