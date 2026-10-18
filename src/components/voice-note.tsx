"use client";

import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

// Ditado pelo reconhecimento de fala do navegador — item 5. O professor
// revisa e edita antes de salvar (a gravação nunca salva sozinha).
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function VoiceNote({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");

  function toggle() {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }

    if (listening) {
      recRef.current?.stop();
      return;
    }

    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = value ? value + " " : "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setValue(baseRef.current + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={name} className="text-sm font-medium text-ink">{label}</label>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={listening}
          className={`flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            listening ? "bg-coral-soft text-coral" : "bg-brand-soft text-brand-strong hover:opacity-80"
          }`}
        >
          {listening ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
          {listening ? "Parar ditado" : "Ditar texto"}
        </button>
      </div>
      <textarea
        id={name}
        name={name}
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 rounded-xl border border-line bg-paper px-3.5 py-2 text-sm text-ink"
      />
      {!supported ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Reconhecimento de voz não disponível neste navegador — digite o registro.</p>
      ) : (
        // LGPD: o reconhecimento de fala do navegador manda o áudio para fora (no Chrome, ao Google).
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          <strong className="font-medium text-ink">Antes de ditar:</strong> o navegador envia o áudio para o serviço de voz dele (no Chrome, o Google). Não diga nomes nem informações de saúde. Confira o texto antes de salvar.
        </p>
      )}
    </div>
  );
}

