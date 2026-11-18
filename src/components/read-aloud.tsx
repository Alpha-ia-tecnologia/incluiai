"use client";

import { useEffect, useId, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { SPEECH_RATES } from "@/lib/speech-text";
import { inputBoxCls, BUTTON_CLS } from "@/components/form-styles";
import { useSpeech } from "@/components/speech";

function readableText(root: HTMLElement): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.matches("button, select, input, textarea, svg, script, style, summary, [aria-hidden='true'], [data-read-skip], .sr-only")) return;
    if (!node.checkVisibility()) return;
    const block = !getComputedStyle(node).display.startsWith("inline");
    if (block) parts.push("\n");
    node.childNodes.forEach(walk);
    if (block) parts.push("\n");
  };
  walk(root);
  return parts.join("");
}

type Status = "parado" | "lendo" | "confirmar" | "sem-voz";
const selectCls = `${inputBoxCls} w-auto`;

export function ReadAloud({ targetId, label = "Ouvir" }: { targetId: string; label?: string }) {
  const { available, voice, remote, speak, cancel } = useSpeech();
  const [status, setStatus] = useState<Status>("parado");
  const [rate, setRate] = useState(1);
  const [remoteOk, setRemoteOk] = useState(false);
  const id = useId();

  useEffect(() => cancel, [cancel]);

  if (!available) return null;

  const start = (confirmed = remoteOk) => {
    if (!voice) return setStatus("sem-voz");
    if (remote && !confirmed) return setStatus("confirmar");
    const root = document.getElementById(targetId);
    if (root && speak(readableText(root), { rate, onEnd: () => setStatus("parado") })) setStatus("lendo");
  };
  const stop = () => {
    cancel();
    setStatus("parado");
  };

  return (
    <div className="grid gap-2 print:hidden" data-read-skip>
      <div className="flex flex-wrap items-center gap-2">
        {status === "lendo" ? (
          <button type="button" onClick={stop} className={BUTTON_CLS.quiet}><Square size={16} aria-hidden /> Parar a leitura</button>
        ) : (
          <button type="button" onClick={() => start()} className={BUTTON_CLS.quiet}><Volume2 size={16} aria-hidden /> {label}</button>
        )}
        <label htmlFor={`${id}-rate`} className="sr-only">Velocidade da leitura</label>
        <select id={`${id}-rate`} value={rate} onChange={(event) => setRate(Number(event.target.value))} className={selectCls}>
          {SPEECH_RATES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {status === "confirmar" ? (
        <div role="alert" className="max-w-md rounded-xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-amber">
          <p>Este navegador só tem voz pela internet: ele envia o texto ao serviço de voz dele (no Chrome, o Google), e o texto pode ter o nome do estudante.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setRemoteOk(true); start(true); }} className={BUTTON_CLS.quiet}>Ouvir mesmo assim</button>
            <button type="button" onClick={() => setStatus("parado")} className={BUTTON_CLS.quiet}>Cancelar</button>
          </div>
        </div>
      ) : null}
      {status === "sem-voz" ? <p role="alert" className="text-sm text-surface-ink-soft">Este navegador não tem voz em português. Experimente outro navegador ou o leitor de tela do aparelho.</p> : null}
      <p role="status" className="sr-only">{status === "lendo" ? "Lendo em voz alta." : ""}</p>
    </div>
  );
}
