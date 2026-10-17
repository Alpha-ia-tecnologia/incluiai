import { SIGNAL } from "@/components/charts";

// Barra fina e listrada de um valor contra um máximo (ex.: uso de cada item
// comparado ao mais usado da lista). É só reforço visual: quem usa precisa
// mostrar o número em texto ao lado, por isso a barra fica fora da leitura de
// tela. Valor zero não desenha preenchimento. Feita de <span> para caber
// também dentro de links e textos.

export function UsageMeter({ value, max, color = SIGNAL.lime, track = "bg-signal-track", className = "" }: {
  value: number;
  max: number;
  color?: string;
  track?: string;
  className?: string;
}) {
  const width = value > 0 && max > 0 ? Math.max(4, Math.round((Math.min(value, max) / max) * 100)) : 0;
  return (
    <span aria-hidden className={`block h-2 min-w-0 overflow-hidden rounded-full ${track} ${className}`}>
      <span className="hatch block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
    </span>
  );
}
