"use client";

import { useCallback, useEffect, useState } from "react";

// Voz do próprio navegador para as instruções dos jogos. As frases não têm
// dado pessoal (nem o nome do estudante), então qualquer voz em português serve;
// a que roda no aparelho tem preferência. Sem voz, o botão "Ouvir" some.
export function useSpeech() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const pick = () => {
      const voices = synth.getVoices().filter((item) => item.lang.toLowerCase().startsWith("pt"));
      setVoice(voices.find((item) => item.lang.toLowerCase() === "pt-br" && item.localService) ?? voices.find((item) => item.localService) ?? voices[0] ?? null);
      setAvailable(true);
    };
    pick();
    synth.addEventListener("voiceschanged", pick);
    return () => {
      synth.removeEventListener("voiceschanged", pick);
      synth.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? "pt-BR";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    synth.speak(utterance);
  }, [voice]);

  return { available, speak };
}
