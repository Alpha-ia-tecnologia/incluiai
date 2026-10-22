"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import { SPEECH_RATES, pickVoice, speechChunks } from "@/lib/speech-text";
import { inputCls, quietButtonCls } from "@/components/form-styles";

// Ler em voz alta um trecho da página (material, portal da família) com a voz
// do próprio navegador. Prefere uma voz que roda no aparelho; se só houver voz
// pela internet, avisa antes, como no ditado (o texto pode ter o nome do estudante).

const NO_VOICES: SpeechSynthesisVoice[] = [];
let voices = NO_VOICES;
const voiceStore = {
  subscribe(callback: () => void) {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return () => {};
    const update = () => {
      voices = synth.getVoices();
      callback();
    };
    update();
    synth.addEventListener("voiceschanged", update);
    return () => synth.removeEventListener("voiceschanged", update);
  },
  get: () => voices,
  server: () => NO_VOICES,
};
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;
const noop = () => () => {};

// Texto visível do trecho, sem botões, campos, ícones e textos só para leitor de tela.
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
// O seletor de velocidade fica do tamanho do texto, não da largura toda.
const selectCls = inputCls.replace("w-full ", "w-auto ");

export function ReadAloud({ targetId, label = "Ouvir" }: { targetId: string; label?: string }) {
  const available = useSyncExternalStore(noop, supported, () => false);
  const list = useSyncExternalStore(voiceStore.subscribe, voiceStore.get, voiceStore.server);
  const [status, setStatus] = useState<Status>("parado");
  const [rate, setRate] = useState(1);
  const [remoteOk, setRemoteOk] = useState(false);
  const id = useId();

  // Sair da página para a leitura.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!available) return null;
  const { voice, remote } = pickVoice(list);

  const start = (confirmed = remoteOk) => {
    if (!voice) return setStatus("sem-voz");
    if (remote && !confirmed) return setStatus("confirmar");
    const root = document.getElementById(targetId);
    const chunks = root ? speechChunks(readableText(root)) : [];
    if (!chunks.length) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      if (index === chunks.length - 1) utterance.onend = () => setStatus("parado");
      synth.speak(utterance);
    });
    setStatus("lendo");
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setStatus("parado");
  };

  return (
    <div className="grid gap-2 print:hidden" data-read-skip>
      <div className="flex flex-wrap items-center gap-2">
        {status === "lendo" ? (
          <button type="button" onClick={stop} className={quietButtonCls}><Square size={16} aria-hidden /> Parar a leitura</button>
        ) : (
          <button type="button" onClick={() => start()} className={quietButtonCls}><Volume2 size={16} aria-hidden /> {label}</button>
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
            <button type="button" onClick={() => { setRemoteOk(true); start(true); }} className={quietButtonCls}>Ouvir mesmo assim</button>
            <button type="button" onClick={() => setStatus("parado")} className={quietButtonCls}>Cancelar</button>
          </div>
        </div>
      ) : null}
      {status === "sem-voz" ? <p role="alert" className="text-sm text-ink-soft">Este navegador não tem voz em português. Experimente outro navegador ou o leitor de tela do aparelho.</p> : null}
      <p role="status" className="sr-only">{status === "lendo" ? "Lendo em voz alta." : ""}</p>
    </div>
  );
}
