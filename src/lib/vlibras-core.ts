// VLibras (tradução para Libras do governo federal) com os dados pessoais
// trocados antes do envio. Puro para teste com node --test
// (src/lib/vlibras-core.test.mjs); a interceptação fica em src/components/vlibras.tsx.
//
// Conferido no código do widget 7.12.2: o texto vai para o tradutor do governo
// num fetch POST com o corpo {"text": "..."}, e uma amostra das aberturas vai
// para o PostHog (estatística de uso, nos Estados Unidos) com o endereço da página.

// Versão fixa: uma atualização do widget não muda o envio sem a gente conferir.
export const VLIBRAS_VERSION = "7.12.2";
export const VLIBRAS_ROOT = `https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@v${VLIBRAS_VERSION}/app`;

const TRANSLATOR_HOSTS = new Set(["traducao2.vlibras.gov.br", "traducao2-dth.vlibras.gov.br"]);

// traducao: anonimiza e envia; bloqueado: outro pedido ao tradutor (ex.: revisão
// de tradução, que manda o texto num formato que não conferimos); analytics: não sai.
export type RequestKind = "traducao" | "bloqueado" | "analytics" | "outro";

export function requestKind(url: string): RequestKind {
  let parsed: URL;
  try {
    parsed = new URL(url, "https://plataforma.invalid");
  } catch {
    return "outro";
  }
  if (parsed.hostname === "posthog.com" || parsed.hostname.endsWith(".posthog.com")) return "analytics";
  if (!TRANSLATOR_HOSTS.has(parsed.hostname)) return "outro";
  return parsed.pathname.replace(/\/$/, "") === "/translate" ? "traducao" : "bloqueado";
}

// O texto do pedido de tradução; null se o corpo não for o esperado (aí o pedido não sai).
export function translationText(body: unknown): string | null {
  if (typeof body !== "string") return null;
  try {
    const data = JSON.parse(body) as { text?: unknown };
    return typeof data?.text === "string" ? data.text : null;
  } catch {
    return null;
  }
}

export const translationBody = (text: string) => JSON.stringify({ text });

// Limite do texto enviado para anonimizar (um parágrafo longo cabe com folga).
export const LIBRAS_MAX_CHARS = 5000;

// O anonimizador troca "EMEF X" por "a escola": "na a escola" vira "na escola".
export const tidyForLibras = (text: string) => text.replace(/\b(na|da|pela) a escola\b/gi, (_, prep: string) => `${prep} escola`);
