// O Chrome corta falas longas no meio.

export type VoiceInfo = { name: string; lang: string; localService: boolean; default?: boolean };

// remote = só há voz pela internet: o navegador envia o texto ao serviço dele (no Chrome, o Google).
export function pickVoice<V extends VoiceInfo>(voices: readonly V[]): { voice: V | null; remote: boolean } {
  const portuguese = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("pt"));
  const brazilian = (voice: V) => /^pt-br$/i.test(voice.lang.replace("_", "-"));
  const rank = (voice: V) => (brazilian(voice) ? 0 : 1) + (voice.default ? 0 : 0.5);
  const local = portuguese.filter((voice) => voice.localService).sort((a, b) => rank(a) - rank(b));
  if (local.length) return { voice: local[0], remote: false };
  const online = portuguese.sort((a, b) => rank(a) - rank(b));
  return online.length ? { voice: online[0], remote: true } : { voice: null, remote: false };
}

export function speechChunks(text: string, max = 180): string[] {
  const chunks: string[] = [];
  for (const paragraph of text.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean)) {
    for (const sentence of paragraph.split(/(?<=[.!?;:])\s+/)) {
      let rest = sentence;
      while (rest.length > max) {
        const window = rest.slice(0, max);
        const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf(" "));
        const at = cut > max / 3 ? cut + 1 : max;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) chunks.push(rest);
    }
  }
  return chunks;
}

export const SPEECH_RATES = [
  { value: 0.8, label: "Devagar" },
  { value: 1, label: "Normal" },
  { value: 1.2, label: "Rápido" },
] as const;

export const TEXT_SCALES = ["1", "2", "3"] as const;
export type TextScale = (typeof TEXT_SCALES)[number];
export const isTextScale = (value: unknown): value is TextScale => TEXT_SCALES.includes(value as TextScale);
