"use client";

import { useEffect, useRef } from "react";

/**
 * Depois de "Entrar" (navegação no cliente, sem recarregar), o botão sai da página e o
 * Chrome segue o Tab de onde ele estava: o primeiro Tab ia ao VLibras, no fim do body.
 * Quando nada tem foco ao abrir a moldura, o ponto de partida do Tab volta ao começo,
 * logo antes de "Pular para o conteúdo". Navegar dentro da moldura não passa por aqui.
 */
export function FocusStart() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = ref.current;
    if (!start || (document.activeElement && document.activeElement !== document.body)) return;
    start.focus({ preventScroll: true });
    start.blur();
  }, []);
  return <span ref={ref} tabIndex={-1} className="absolute" />;
}
