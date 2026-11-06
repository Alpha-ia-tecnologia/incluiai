import { LoaderCircle } from "lucide-react";

// Aparece na hora ao trocar de página: em computadores e redes lentas da escola,
// mostra que o clique funcionou enquanto a próxima tela carrega.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-ink-soft">
      <LoaderCircle size={20} className="animate-spin text-brand motion-reduce:animate-none" aria-hidden />
      Carregando…
    </div>
  );
}
