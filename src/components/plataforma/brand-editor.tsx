"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import { Check, Home, Layers, LoaderCircle, Sparkles, Sprout, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import { StatusPill } from "@/components/data-viz";
import { hintCls, inputCls, labelCls, linkCls, BUTTON_CLS } from "@/components/form-styles";
import { DEFAULT_BRAND, derivePalette, normalizeHex } from "@/lib/branding/palette";
import { LOGO_ACCEPT, LOGO_MAX_BYTES, LOGO_TOO_BIG } from "@/lib/branding/logo-core";
import type { BrandSuggestion } from "@/lib/branding/colors-core";

export type SuggestResult = { ok: true; value: BrandSuggestion } | { ok: false; message: string };
type Source = "ia" | "regras" | "manual";

const SOURCE_LABEL: Record<Source, string> = { ia: "sugestão da IA", regras: "sugestão pela regra", manual: "escolha manual" };
const decimal = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function ColorField({ label, hint, name, value, onChange }: { label: string; hint: string; name: string; value: string; onChange: (hex: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState({ for: value, text: value });
  const text = draft.for === value ? draft.text : value;
  const invalid = normalizeHex(text) === null;
  return (
    <div className="min-w-0">
      <label htmlFor={`${id}-cor`} className={labelCls}>{label}</label>
      <p id={`${id}-dica`} className={hintCls}>{hint}</p>
      <div className="flex min-w-0 items-center gap-2">
        <input
          id={`${id}-cor`} name={name} type="color" value={value} aria-describedby={`${id}-dica`}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-line bg-paper p-1"
        />
        <input
          type="text" autoComplete="off" spellCheck={false} value={text}
          aria-label={`${label}, código hexadecimal`} aria-invalid={invalid} aria-describedby={invalid ? `${id}-erro` : `${id}-dica`}
          onChange={(event) => {
            const hex = normalizeHex(event.target.value);
            setDraft({ for: hex ?? value, text: event.target.value });
            if (hex && hex !== value) onChange(hex);
          }}
          className={`${inputCls} max-w-36 font-mono`}
        />
      </div>
      {invalid ? <p id={`${id}-erro`} className="mt-1.5 text-xs text-coral">Use o formato #1f6f43.</p> : null}
    </div>
  );
}

function Chip({ hex }: { hex: string }) {
  return <span aria-hidden className="inline-block size-5 shrink-0 rounded-md border border-line align-middle" style={{ backgroundColor: hex }} />;
}

export function BrandEditor({ suggest, initial, municipalityName }: {
  suggest: (formData: FormData) => Promise<SuggestResult>;
  initial: { primary: string; menu: string; logoUrl: string | null; source: Source | null };
  municipalityName: string;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [primary, setPrimary] = useState(normalizeHex(initial.primary) ?? DEFAULT_BRAND.primary);
  const [menu, setMenu] = useState(normalizeHex(initial.menu) ?? DEFAULT_BRAND.menu);
  const [source, setSource] = useState<Source | null>(initial.source);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<BrandSuggestion | null>(null);
  const [status, setStatus] = useState<{ text: string; problem: boolean }>({ text: "", problem: false });
  const [pending, startTransition] = useTransition();
  const palette = useMemo(() => derivePalette({ primary, menu }), [primary, menu]);
  const logoSrc = fileUrl ?? initial.logoUrl;

  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const setByHand = (role: "primary" | "menu", hex: string) => {
    if (role === "primary") setPrimary(hex);
    else setMenu(hex);
    setSource("manual");
  };

  function chooseFile(file: File | undefined) {
    setSuggestion(null);
    if (file && file.size > LOGO_MAX_BYTES) {
      if (fileInput.current) fileInput.current.value = "";
      setFileUrl(null);
      setStatus({ text: LOGO_TOO_BIG, problem: true });
      return;
    }
    setFileUrl(file?.size ? URL.createObjectURL(file) : null);
    setStatus({ text: "", problem: false });
  }

  function runSuggestion() {
    const logo = fileInput.current?.files?.[0];
    if (!logo) return;
    const data = new FormData();
    data.set("logo", logo);
    data.set("municipalityName", municipalityName);
    setStatus({ text: "Lendo as cores do logo…", problem: false });
    startTransition(async () => {
      try {
        const result = await suggest(data);
        if (!result.ok) {
          setStatus({ text: result.message, problem: true });
          return;
        }
        const { colors, note } = result.value;
        setSuggestion(result.value);
        setPrimary(colors.primary);
        setMenu(colors.menu);
        setSource(result.value.source);
        setStatus({ text: `Cores aplicadas: principal ${colors.primary}, menu ${colors.menu}. ${note}`, problem: false });
      } catch {
        setStatus({ text: "Não foi possível ler o logo agora. Tente de novo.", problem: true });
      }
    });
  }

  const adjustments = ([
    ["primary", primary, palette.colors.primary, "A cor principal fica mais escura", "para o texto branco dos botões e os links ficarem legíveis"],
    ["menu", menu, palette.colors.menu, "O menu fica mais escuro", "para o texto branco do menu ficar legível"],
  ] as const).filter(([, chosen, used]) => chosen !== used);
  const passing = palette.checks.filter((check) => check.ok).length;
  const inSwatches = (hex: string) => suggestion?.swatches.some((swatch) => swatch.hex === hex) ?? false;

  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 gap-8 @3xl:grid-cols-2">
        <div className="grid min-w-0 content-start gap-8">
          <fieldset className="min-w-0">
            <legend className="mb-3 text-base font-semibold text-ink">Logo</legend>
            <label htmlFor={`${id}-logo`} className={labelCls}>Arquivo do logo</label>
            <p id={`${id}-logo-dica`} className={hintCls}>
              PNG, JPG, WebP ou SVG, até 2 MB.{initial.logoUrl ? " Sem arquivo novo, fica o logo atual." : ""} Escolha o arquivo para a plataforma sugerir as cores.
            </p>
            <input
              ref={fileInput} id={`${id}-logo`} name="logo" type="file" accept={LOGO_ACCEPT} aria-describedby={`${id}-logo-dica`}
              onChange={(event) => chooseFile(event.target.files?.[0])}
              className={`${inputCls} py-2 file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-medium file:text-brand-strong`}
            />
            <button type="button" onClick={runSuggestion} disabled={!fileUrl || pending} aria-busy={pending} className={`${BUTTON_CLS.secondary} mt-3 disabled:cursor-wait`}>
              {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
              Sugerir cores pelo logo
            </button>
            <p role="status" aria-live="polite" className={status.text && (pending || status.problem) ? `mt-2 text-sm ${status.problem ? "text-coral" : "text-ink-soft"}` : "sr-only"}>
              {status.text}
            </p>

            {suggestion ? (
              <div className="mt-4 min-w-0 rounded-2xl bg-surface-muted p-4">
                <p className="text-sm font-medium text-ink">{suggestion.source === "ia" ? "Sugestão da IA" : "Sugestão pela regra"}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{suggestion.note}</p>
                <dl className="mt-3 grid gap-1.5 text-sm text-ink">
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="font-medium">Cor principal:</dt>
                    <dd className="flex items-center gap-1.5"><Chip hex={suggestion.colors.primary} /><span className="font-mono">{suggestion.colors.primary}</span></dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="font-medium">Menu:</dt>
                    <dd className="flex items-center gap-1.5">
                      <Chip hex={suggestion.colors.menu} /><span className="font-mono">{suggestion.colors.menu}</span>
                      {inSwatches(suggestion.colors.menu) ? null : <span className="text-ink-soft">(tom escuro da cor principal)</span>}
                    </dd>
                  </div>
                </dl>
                {suggestion.swatches.length ? (
                  <>
                    <p className="mt-4 text-sm font-medium text-ink">Cores do logo</p>
                    <ul className="mt-2 grid gap-2">
                      {suggestion.swatches.map((swatch) => (
                        <li key={swatch.hex} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-paper-raised p-2.5">
                          <span aria-hidden className="size-9 shrink-0 rounded-lg border border-line" style={{ backgroundColor: swatch.hex }} />
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="font-mono text-ink">{swatch.hex}</span>
                            <span className="text-ink-soft"> · {Math.round(swatch.share * 100)}% do logo</span>
                          </span>
                          {swatch.hex === primary ? <Badge tone="info">principal</Badge> : null}
                          {swatch.hex === menu ? <Badge>menu</Badge> : null}
                          <span className="flex gap-1.5">
                            <button type="button" onClick={() => setByHand("primary", swatch.hex)} aria-label={`Usar ${swatch.hex} como cor principal`} className={`${BUTTON_CLS.quiet} px-3`}>Principal</button>
                            <button type="button" onClick={() => setByHand("menu", swatch.hex)} aria-label={`Usar ${swatch.hex} como cor do menu`} className={`${BUTTON_CLS.quiet} px-3`}>Menu</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
          </fieldset>

          <fieldset className="@container min-w-0">
            <legend className="mb-3 text-base font-semibold text-ink">Cores</legend>
            <div className="grid min-w-0 gap-5 @md:grid-cols-2">
              <ColorField label="Cor principal" hint="Botões, links e destaques." name="primaryColor" value={primary} onChange={(hex) => setByHand("primary", hex)} />
              <ColorField label="Cor do menu" hint="Fundo do menu lateral, com texto branco." name="menuColor" value={menu} onChange={(hex) => setByHand("menu", hex)} />
            </div>
            <input type="hidden" name="colorSource" value={source ?? "manual"} />
            {source ? <p className="mt-3 text-xs text-ink-soft">Origem das cores: {SOURCE_LABEL[source]}.</p> : null}
            <p role="status" className="sr-only">{adjustments.length ? "A prévia usa uma cor ajustada para manter o contraste." : ""}</p>
            {adjustments.map(([role, chosen, used, what, why]) => (
              <div key={role} className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-soft px-3 py-2.5 text-sm text-amber">
                <p className="min-w-0 flex-1">{what} (<span className="font-mono">{used}</span> em vez de <span className="font-mono">{chosen}</span>) {why}.</p>
                <button type="button" onClick={() => setByHand(role, used)} className={`${BUTTON_CLS.quiet} px-3`}>Usar {used}</button>
              </div>
            ))}
          </fieldset>
        </div>

        <figure className="@container min-w-0">
          <figcaption className="mb-3 text-base font-semibold text-ink">Prévia</figcaption>
          <div style={palette.tokens as CSSProperties} className="grid min-w-0 gap-3 rounded-2xl border border-line bg-paper p-3 @md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <div className="surface-navy min-w-0 rounded-xl p-3">
              <div className="mb-3 flex min-w-0 items-center gap-2 px-1">
                {logoSrc ? (
                  <Image src={logoSrc} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded-md bg-paper-raised object-contain p-0.5" />
                ) : (
                  <Sprout size={24} className="shrink-0 text-accent-sky" aria-hidden />
                )}
                <span className="min-w-0 truncate text-sm font-semibold text-on-navy">{municipalityName || "Município"}</span>
              </div>
              <ul className="grid gap-1 text-sm">
                <li className="flex min-h-10 items-center gap-2 rounded-lg bg-accent-sky px-3 font-medium text-ink-strong"><Home size={16} aria-hidden /> Início</li>
                <li className="flex min-h-10 items-center gap-2 px-3 text-on-navy-soft"><Users size={16} aria-hidden /> Estudantes</li>
                <li className="flex min-h-10 items-center gap-2 px-3 text-on-navy-soft"><Layers size={16} aria-hidden /> Planejamento</li>
              </ul>
            </div>
            <div className="min-w-0 rounded-xl bg-paper-raised p-4">
              <p className="font-display text-lg font-semibold text-ink">Acompanhamento da rede</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">Texto de apoio, como nas telas da plataforma.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={BUTTON_CLS.primary}>Salvar</span>
                <span className={BUTTON_CLS.secondary}>Ver detalhes</span>
              </div>
              <p className="mt-4 text-sm text-ink">Um <span className={linkCls}>link no texto</span> leva a outra tela.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="info">Em dia</Badge>
                <StatusPill tone="info">Informativo</StatusPill>
              </div>
            </div>
          </div>
          <details className="mt-3 rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
            <summary className="font-medium text-ink">Contraste: {passing} de {palette.checks.length} pares passam (WCAG AA)</summary>
            <ul className="mt-3 grid gap-2">
              {palette.checks.map((check) => (
                <li key={check.label} className="flex min-w-0 items-start gap-2">
                  {check.ok ? <Check size={16} className="mt-0.5 shrink-0 text-green" aria-hidden /> : <TriangleAlert size={16} className="mt-0.5 shrink-0 text-coral" aria-hidden />}
                  <span className="min-w-0 flex-1 text-ink">{check.label}<span className="sr-only">{check.ok ? ": passa" : ": não passa"}</span></span>
                  <span className="shrink-0 tabular-nums text-ink-soft">{decimal(check.ratio)}:1 <span className="text-xs">(mín. {decimal(check.min)})</span></span>
                </li>
              ))}
            </ul>
          </details>
        </figure>
      </div>
    </div>
  );
}
