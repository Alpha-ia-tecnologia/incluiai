import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Quote } from "lucide-react";
import { HatchedDonut, SIGNAL, type ChartSegment } from "./charts";

// Kit de visualização de dados no padrão do Painel de indicadores: cartões
// brancos sobre quadro cinza (dash-board / dash-card), números grandes,
// pílulas de situação (lima = bom, amarelo = intermediário, laranja = atenção,
// azul-claro = informação) e gráficos em SVG listrado, sem biblioteca.
// Regras de acesso: todo gráfico tem o valor também em texto (aria-label ou
// tabela para leitor de tela) e nenhuma informação depende só da cor.

export type Tone = "good" | "mid" | "alert" | "neutral" | "info";
const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-signal-lime text-ink-strong",
  mid: "bg-signal-yellow text-ink-strong",
  alert: "bg-signal-orange text-ink-strong",
  neutral: "bg-signal-track text-ink-soft",
  info: "bg-sky-soft text-sky-ink",
};
export const TONE_COLOR: Record<Tone, string> = { good: SIGNAL.lime, mid: SIGNAL.yellow, alert: SIGNAL.orange, neutral: SIGNAL.track, info: SIGNAL.cyan };

// Cores das divisões usadas na plataforma (mesmas do painel).
export const SEGMENT_COLORS: Record<string, string> = {
  total: SIGNAL.lime, sim: SIGNAL.lime, avancando: SIGNAL.lime, aplicada: SIGNAL.lime, demonstrado: SIGNAL.lime, alcancado: SIGNAL.lime, validado: SIGNAL.lime,
  parcial: SIGNAL.yellow, sugerida: SIGNAL.yellow, em_revisao: SIGNAL.yellow,
  recusou: SIGNAL.orange, nao: SIGNAL.orange, atencao: SIGNAL.orange, rejeitada: SIGNAL.orange, ainda_nao_demonstrado: SIGNAL.orange,
  estavel: SIGNAL.cyan, aceita: SIGNAL.cyan, ativo: SIGNAL.cyan, realizado: SIGNAL.cyan, rascunho: SIGNAL.cyan,
  falta: SIGNAL.yellow, cancelamento: SIGNAL.track, sem_oportunidade: SIGNAL.track, nao_registrado: SIGNAL.track, sem_dados: SIGNAL.track,
};
export const withSegmentColors = (rows: ReadonlyArray<{ key: string; label: string; value: number }>): ChartSegment[] =>
  rows.map((row) => ({ ...row, color: SEGMENT_COLORS[row.key] ?? SIGNAL.lime }));

// Cor do nível de apoio: 0–1 lima, 2–3 amarelo, 4–5 laranja.
export const supportColor = (level: number) => (level <= 1 ? SIGNAL.lime : level <= 3 ? SIGNAL.yellow : SIGNAL.orange);
const SUPPORT_CODES = ["IND", "SUP", "VERB", "MOD", "FIS-P", "FIS-T"];
const SUPPORT_NAMES = ["Independente", "Supervisão", "Instrução verbal", "Modelo", "Apoio físico parcial", "Apoio físico total"];
const levelText = (level: number) => `${SUPPORT_NAMES[Math.round(Math.min(5, Math.max(0, level)))]} (${level.toLocaleString("pt-BR", { maximumFractionDigits: 1 })})`;
const decimal = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}>{children}</span>;
}

// Quadro cinza que agrupa cartões, como no painel.
export function DataBoard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dash-board grid min-w-0 gap-3 ${className}`}>{children}</div>;
}

// Cartão com título, dica e seta para o detalhe.
export function DataCard({ title, hint, href, linkLabel, children, className = "", id }: { title: string; hint?: string; href?: string; linkLabel?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-label={title} className={`dash-card min-w-0 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-medium tracking-tight text-ink">{title}</h3>
          {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-soft">{hint}</p> : null}
        </div>
        {href ? <Link href={href} className="circle-link" aria-label={linkLabel ?? `Abrir ${title.toLowerCase()}`}><ArrowUpRight size={16} aria-hidden /></Link> : null}
      </div>
      {children}
    </section>
  );
}

// Mudança entre dois momentos. `better` diz o sentido bom (no apoio, menos é avanço).
export function TrendBadge({ delta, better, text }: { delta: number | null; better: "up" | "down"; text?: string }) {
  if (delta === null) return null;
  const good = delta === 0 ? null : (delta < 0) === (better === "down");
  const Icon = delta === 0 ? Minus : delta < 0 ? ArrowDownRight : ArrowUpRight;
  const tone: Tone = good === null ? "neutral" : good ? "good" : "alert";
  return <StatusPill tone={tone}><Icon size={12} aria-hidden /> {text ?? `${delta > 0 ? "+" : ""}${decimal(delta)}`}</StatusPill>;
}

// Número grande com rótulo, pílula, tendência e um minigráfico opcional.
export function StatTile({ label, value, unit, hint, tone, status, trend, chart, href, linkLabel }: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: Tone;
  status?: string;
  trend?: ReactNode;
  chart?: ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <article className="dash-card flex min-w-0 flex-col !p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-ink">{label}</h3>
        {href ? <Link href={href} className="circle-link !size-8" aria-label={linkLabel ?? `Ver detalhes: ${label}`}><ArrowUpRight size={15} aria-hidden /></Link> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-display text-3xl font-normal leading-none tracking-tight text-ink tabular-nums">{value}{unit ? <span className="ml-0.5 text-xl text-ink-soft">{unit}</span> : null}</p>
        {status && tone ? <StatusPill tone={tone}>{status}</StatusPill> : null}
        {trend}
      </div>
      {chart ? <div className="mt-3">{chart}</div> : null}
      {hint ? <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">{hint}</p> : null}
    </article>
  );
}

// Minigráfico de linha. `invert` põe o 0 em cima (nível de apoio: subir = menos apoio).
// Ao abrir, a área cresce de baixo para cima e a linha se revela por recorte
// (viz-wipe): com non-scaling-stroke, o viz-draw (tracejado) cortava a linha no meio.
export function Sparkline({ values, label, domain, invert = false, color = SIGNAL.ink, height = 36 }: { values: ReadonlyArray<number>; label: string; domain?: [number, number]; invert?: boolean; color?: string; height?: number }) {
  if (values.length < 2) return <p className="text-xs text-ink-soft">Poucos registros para a linha.</p>;
  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  const span = max - min || 1;
  const x = (index: number) => (index / (values.length - 1)) * 100;
  const y = (value: number) => {
    const t = (value - min) / span;
    return (invert ? t : 1 - t) * 90 + 5;
  };
  const line = values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={label}>
        <path d={`${line} L100,100 L0,100 Z`} fill="var(--signal-lime-soft)" opacity={0.7} className="viz-grow-y" />
        <path d={line} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="viz-wipe" />
      </svg>
      <span aria-hidden className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-e1" style={{ left: "100%", top: `${y(last)}%`, backgroundColor: color }} />
    </div>
  );
}

// Evolução do nível de apoio (0 em cima = independente). A área mostra a autonomia
// ganha; a linha tracejada é a meta. Tabela para leitor de tela com cada registro.
// Ao abrir, só a área cresce; linha, pontos e referências ficam parados (ver Sparkline).
export function SupportChart({ points, start, target, label, height = 168 }: { points: ReadonlyArray<{ date: string; value: number }>; start?: number | null; target?: number | null; label: string; height?: number }) {
  if (points.length < 2) return <p className="text-sm text-ink-soft">Com dois registros ou mais, a evolução do apoio aparece aqui.</p>;
  const x = (index: number) => (index / (points.length - 1)) * 100;
  const y = (level: number) => (Math.min(5, Math.max(0, level)) / 5) * 100;
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const middle = Math.floor((points.length - 1) / 2);
  return (
    <figure className="min-w-0">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
        <div className="flex flex-col justify-between text-right text-xs leading-none text-ink-soft" style={{ height }} aria-hidden>
          <span>0 · IND</span><span>5 · FIS-T</span>
        </div>
        <div className="relative min-w-0" style={{ height }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={label}>
            {[0, 1, 2, 3, 4, 5].map((level) => <line key={level} x1={0} x2={100} y1={y(level)} y2={y(level)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
            <path d={`${line} L100,100 L0,100 Z`} fill="var(--signal-lime-soft)" className="viz-grow-y" />
            {typeof target === "number" ? <line x1={0} x2={100} y1={y(target)} y2={y(target)} stroke={SIGNAL.ink} strokeWidth={1.2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" /> : null}
            {typeof start === "number" ? <line x1={0} x2={100} y1={y(start)} y2={y(start)} stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" /> : null}
            <path d={line} fill="none" stroke={SIGNAL.ink} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="viz-wipe" />
          </svg>
          {points.map((point, index) => (
            <span key={index} aria-hidden title={`${point.date}: ${levelText(point.value)}`} className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-e1" style={{ left: `${x(index)}%`, top: `${y(point.value)}%`, backgroundColor: supportColor(point.value) }} />
          ))}
          {typeof target === "number" ? <span aria-hidden className="absolute right-0 -translate-y-full rounded-full bg-paper-raised px-1.5 text-xs font-medium text-ink" style={{ top: `${y(target)}%` }}>meta</span> : null}
        </div>
      </div>
      <div className="ml-[3.25rem] mt-1.5 flex justify-between text-xs text-ink-soft" aria-hidden>
        <span>{points[0].date}</span>{points.length > 2 ? <span className="max-sm:hidden">{points[middle].date}</span> : null}<span>{points[points.length - 1].date}</span>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-ink" /> Apoio registrado</span>
        {typeof target === "number" ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-2 border-dashed border-ink" /> Meta: {levelText(target)}</span> : null}
        {typeof start === "number" ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-2 border-dotted border-ink-soft" /> Início: {levelText(start)}</span> : null}
        <span>Subir é precisar de menos apoio.</span>
      </figcaption>
      {/* Tabela ignora width:1px; o bloco sr-only em volta impede que ela alargue a página a 320px. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">Data</th><th scope="col">Nível de apoio</th></tr></thead>
          <tbody>{points.map((point, index) => <tr key={index}><td>{point.date}</td><td>{levelText(point.value)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}

// Anel com percentual (listrado). Sem base (null), mostra o texto e não desenha arco.
export function RingStat({ id, value, label, size = 112, color = SIGNAL.lime, children }: { id: string; value: number | null; label: string; size?: number; color?: string; children?: ReactNode }) {
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <HatchedDonut id={id} size={size} thickness={Math.round(size / 8)} label={value === null ? `${label}: sem base para cálculo` : `${label}: ${pct}%`} segments={[{ key: "feito", label, value: pct, color }, { key: "falta", label: "restante", value: 100 - pct, color: SIGNAL.track }]}>
      {children ?? <span className="font-display text-2xl leading-none text-ink tabular-nums">{value === null ? "—" : `${pct}%`}</span>}
    </HatchedDonut>
  );
}

// Uma marca por registro, em ordem (ex.: participação de cada aula), com legenda e texto.
export function DotStrip({ items, label, legend }: { items: ReadonlyArray<{ key: string; title: string; tone: Tone }>; label: string; legend?: ReadonlyArray<{ tone: Tone; label: string }> }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <ol className="flex flex-wrap gap-1.5" aria-label={label}>
        {items.map((item) => (
          <li key={item.key} title={item.title} className="size-4 rounded-[5px] border border-black/5 hatch" style={{ backgroundColor: TONE_COLOR[item.tone] }}>
            <span className="sr-only">{item.title}</span>
          </li>
        ))}
      </ol>
      {legend ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft" aria-hidden>
          {legend.map((item) => <li key={item.label} className="inline-flex items-center gap-1.5"><span className="hatch size-2.5 rounded-[3px]" style={{ backgroundColor: TONE_COLOR[item.tone] }} />{item.label}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

// Nível de apoio por área (0–5), com o código e o nome sempre em texto.
export function SupportBars({ rows }: { rows: ReadonlyArray<{ label: string; level: number }> }) {
  return (
    <ul className="grid min-w-0 gap-2.5">
      {rows.map((row) => {
        const level = Math.round(Math.min(5, Math.max(0, row.level)));
        return (
          <li key={row.label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            <span className="min-w-0 text-ink">{row.label}</span>
            <span aria-hidden className="col-span-2 row-start-2 flex gap-1 sm:col-span-1 sm:row-start-auto">
              {[1, 2, 3, 4, 5].map((cell) => <span key={cell} className={`h-2.5 flex-1 rounded-full ${cell <= level ? "hatch viz-grow-x" : ""}`} style={{ backgroundColor: cell <= level ? supportColor(level) : SIGNAL.track }} />)}
            </span>
            <span className="text-right text-xs tabular-nums text-ink-soft"><span className="font-medium text-ink">{SUPPORT_CODES[level]}</span><span className="max-sm:sr-only"> · {SUPPORT_NAMES[level]}</span></span>
          </li>
        );
      })}
    </ul>
  );
}

// Itens com contagem, como pílulas (ex.: o que funcionou nas aulas).
export function CountChips({ items, tone = "good", unit = "x" }: { items: ReadonlyArray<{ label: string; value?: number }>; tone?: Tone; unit?: string }) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item.label} className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${tone === "good" ? "bg-signal-lime-soft text-ink" : "bg-surface-muted text-ink"}`}>
          <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
          {typeof item.value === "number" ? <span className="rounded-full bg-paper-raised px-1.5 text-xs tabular-nums text-ink-soft">{item.value}{unit}</span> : null}
        </li>
      ))}
    </ul>
  );
}

// Fala da família ou do estudante, em destaque.
export function QuoteCard({ text, source }: { text: string; source: string }) {
  return (
    <figure className="dash-card relative min-w-0 overflow-hidden">
      <Quote size={40} aria-hidden className="absolute -right-1 -top-1 text-brand-soft" />
      <blockquote className="relative text-base leading-relaxed text-ink">{text}</blockquote>
      <figcaption className="relative mt-2 text-xs text-ink-soft">{source}</figcaption>
    </figure>
  );
}

// Colunas pequenas para uma série curta (ex.: aulas por semana), com o total em texto.
export function MiniColumns({ points, label }: { points: ReadonlyArray<{ label: string; title: string; value: number }>; label: string }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <div className="min-w-0">
      <div className="flex h-14 items-end gap-1" role="img" aria-label={`${label}: ${points.map((point) => `${point.title}, ${point.value}`).join("; ")}`}>
        {points.map((point, index) => (
          <div key={`${point.label}-${index}`} title={`${point.title}: ${point.value}`} className="hatch viz-grow-y min-w-0 flex-1 rounded-t-md rounded-b-sm" style={{ height: `${Math.max(point.value > 0 ? 12 : 6, (point.value / max) * 100)}%`, backgroundColor: point.value > 0 ? SIGNAL.lime : SIGNAL.track }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-soft" aria-hidden><span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span></div>
    </div>
  );
}
