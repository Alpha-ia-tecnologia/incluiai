import type { ReactNode } from "react";
import { Character, type CharacterVariant } from "./character";

export function StatusPage({ character, eyebrow, title, children, actions }: {
  character: CharacterVariant;
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section className="page-hero surface-navy mx-auto grid w-full max-w-3xl items-center gap-6 rounded-3xl p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-10">
      <div className="min-w-0">
        <p className="text-sm font-medium text-on-navy-soft">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-[1.15] tracking-tight text-on-navy sm:text-4xl">{title}</h1>
        <div className="mt-3 max-w-xl text-sm leading-relaxed text-on-navy-soft sm:text-base">{children}</div>
        <div className="mt-6 flex flex-wrap gap-2">{actions}</div>
      </div>
      <Character variant={character} className="row-start-1 w-28 justify-self-center sm:col-start-2 sm:w-40" />
    </section>
  );
}
