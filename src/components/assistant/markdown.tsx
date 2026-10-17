"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// Markdown leve para as respostas do assistente: títulos curtos, listas,
// negrito, código e links. Links internos abrem na própria plataforma.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^(#{1,3})\s+(.*)$/;

function inline(text: string, prefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, index) => {
    const key = `${prefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={key} className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    const link = part.match(LINK);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith("/")) return <Link key={key} href={href} className="font-medium text-brand-strong underline underline-offset-2">{label}</Link>;
      if (/^https?:\/\//.test(href)) return <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-strong underline underline-offset-2">{label}</a>;
      return <span key={key}>{label}</span>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push(<p key={key++} className="mt-3 text-sm font-semibold text-ink first:mt-0">{inline(heading[2], `h${key}`)}</p>);
      index++;
      continue;
    }
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(lines[index].replace(pattern, ""));
        index++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key++} className={`my-2 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, itemIndex) => <li key={itemIndex} className="leading-relaxed">{inline(item, `l${key}-${itemIndex}`)}</li>)}
        </ListTag>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !HEADING.test(lines[index]) && !BULLET.test(lines[index]) && !NUMBERED.test(lines[index])) {
      paragraph.push(lines[index]);
      index++;
    }
    blocks.push(
      <p key={key++} className="my-2 leading-relaxed first:mt-0 last:mb-0">
        {paragraph.map((part, partIndex) => <Fragment key={partIndex}>{partIndex ? <br /> : null}{inline(part, `p${key}-${partIndex}`)}</Fragment>)}
      </p>,
    );
  }
  return <div className="text-sm text-ink">{blocks}</div>;
}
