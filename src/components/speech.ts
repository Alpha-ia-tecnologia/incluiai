"use client";

import { useCallback, useSyncExternalStore } from "react";
import { pickVoice, speechChunks } from "@/lib/speech-text";

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
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const noop = () => () => {};

type SpeakOptions = { rate?: number; onEnd?: () => void; onError?: () => void };

export function useSpeech() {
  const available = useSyncExternalStore(noop, supported, () => false);
  const list = useSyncExternalStore(voiceStore.subscribe, voiceStore.get, voiceStore.server);
  const { voice, remote } = pickVoice(list);

  const cancel = useCallback(() => {
    if (supported()) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string, { rate = 1, onEnd, onError }: SpeakOptions = {}) => {
    const chunks = supported() ? speechChunks(text) : [];
    if (!chunks.length) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      // Sem voz listada (há navegadores que não listam), o navegador escolhe a voz pelo idioma.
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "pt-BR";
      utterance.rate = rate;
      if (onError) utterance.onerror = (event) => { if (event.error !== "interrupted" && event.error !== "canceled") onError(); };
      if (onEnd && index === chunks.length - 1) utterance.onend = onEnd;
      synth.speak(utterance);
    });
    return true;
  }, [voice]);

  return { available, voice, remote, speak, cancel };
}
