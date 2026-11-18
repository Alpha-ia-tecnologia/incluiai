"use client";

import { useEffect, useId, useState } from "react";
import { Lightbulb, Search, X } from "lucide-react";
import { hintCls, inputCls, labelCls, BUTTON_CLS } from "@/components/form-styles";
import { bnccSearchUrl, type BnccOption, type BnccQuery } from "@/lib/bncc-query";

type Props = {
  label: string;
  hint?: string;
  studentId?: string;
  dimension?: string;
  multiple?: boolean;
  name?: string;
  value?: string[];
  onChange?: (codes: string[]) => void;
  readOnly?: boolean;
  suggestFrom?: () => string;
};

async function fetchBncc(query: BnccQuery): Promise<BnccOption[]> {
  const response = await fetch(bnccSearchUrl(query));
  return response.ok ? response.json() : [];
}

export function BnccPicker({ label, hint, studentId, dimension, multiple = false, name, value, onChange, readOnly = false, suggestFrom }: Props) {
  const id = useId();
  const [own, setOwn] = useState<string[]>([]);
  const [details, setDetails] = useState<Record<string, BnccOption>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BnccOption[] | null>(null);
  const [heading, setHeading] = useState("");
  const [busy, setBusy] = useState(false);
  const codes = value ?? own;

  const missing = codes.filter((code) => !details[code]).join(",");
  useEffect(() => {
    if (!missing) return;
    let alive = true;
    fetchBncc({ codes: missing.split(",") }).then((items) => {
      if (alive) setDetails((current) => ({ ...current, ...Object.fromEntries(items.map((item) => [item.code, item])) }));
    });
    return () => { alive = false; };
  }, [missing]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setBusy(true);
      const items = await fetchBncc({ text, studentId });
      if (!alive) return;
      setBusy(false);
      setHeading(items.length ? `Resultados para "${text}"` : `Nada encontrado para "${text}". Tente outra palavra ou o começo do código.`);
      setResults(items);
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, studentId]);

  const change = (next: string[]) => (onChange ? onChange(next) : setOwn(next));
  const select = (item: BnccOption) => {
    setDetails((current) => ({ ...current, [item.code]: item }));
    change(multiple ? [...new Set([...codes, item.code])] : [item.code]);
    setResults(null);
    setQuery("");
  };
  const remove = (code: string) => change(codes.filter((item) => item !== code));
  const suggest = async () => {
    const text = suggestFrom?.() ?? "";
    if (!text.trim()) {
      setHeading("Escreva o objetivo primeiro: a sugestão sai do texto dele.");
      setResults([]);
      return;
    }
    setBusy(true);
    const items = await fetchBncc({ suggest: text, studentId, dimension });
    setBusy(false);
    setHeading(items.length ? "Sugestões pelo texto do objetivo" : "Nenhuma habilidade parecida com o texto do objetivo. Busque por palavra ou código.");
    setResults(items);
  };

  const selected = codes.map((code) => details[code] ?? { code, component: "", years: "", description: "" });
  const canAdd = !readOnly && (multiple || !selected.length);

  return (
    <div className="grid min-w-0 gap-2">
      <p id={`${id}-label`} className={`${labelCls} mb-0`}>{label}</p>
      {hint ? <p className={`${hintCls} mb-0`}>{hint}</p> : null}
      {name ? codes.map((code) => <input key={code} type="hidden" name={name} value={code} />) : null}
      {selected.length ? (
        <ul aria-labelledby={`${id}-label`} className="grid gap-2">
          {selected.map((item) => (
            <li key={item.code} className="flex min-w-0 items-start gap-3 rounded-xl border border-line bg-paper p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink"><span className="font-mono">{item.code}</span>{item.component ? ` · ${item.component}` : ""}{item.years ? ` · ${item.years}` : ""}</p>
                {item.description ? <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{item.description}</p> : null}
              </div>
              {!readOnly ? (
                <button type="button" onClick={() => remove(item.code)} aria-label={`Tirar a habilidade ${item.code}`} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-surface-muted hover:text-ink">
                  <X size={16} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canAdd ? (
        <>
          <div className="flex min-w-0 flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 basis-52">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <label htmlFor={`${id}-busca`} className="sr-only">Buscar habilidade da BNCC por código ou palavra</label>
              <input id={`${id}-busca`} type="search" value={query} onChange={(event) => { setQuery(event.target.value); if (event.target.value.trim().length < 2) setResults(null); }} placeholder="Código (EF01LP) ou palavra (letras, contar)" autoComplete="off" className={`${inputCls} pl-9`} />
            </div>
            {suggestFrom ? <button type="button" onClick={suggest} className={BUTTON_CLS.quiet}><Lightbulb size={16} aria-hidden /> Sugerir pelo objetivo</button> : null}
          </div>
          <div aria-live="polite" className="min-w-0">
            {busy ? <p className="text-sm text-ink-soft">Buscando…</p> : results ? (
              <div className="grid gap-2">
                <p className="text-sm text-ink-soft">{heading}</p>
                {results.length ? (
                  <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                    {results.map((item) => (
                      <li key={item.code}>
                        <button type="button" onClick={() => select(item)} className="w-full rounded-xl border border-line bg-paper-raised p-3 text-left hover:border-brand hover:bg-brand-soft/40">
                          <span className="block text-sm font-medium text-ink"><span className="font-mono">{item.code}</span> · {item.component} · {item.years}</span>
                          <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">{item.description}</span>
                          <span className="sr-only">Usar esta habilidade</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
