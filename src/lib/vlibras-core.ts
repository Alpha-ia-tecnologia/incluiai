// VLibras (tradução para Libras do governo federal) com os dados pessoais
// trocados antes do envio. Puro para teste com node --test
// (src/lib/vlibras-core.test.mjs); a interceptação fica em src/components/vlibras.tsx.
//
// Conferido no código do widget 7.12.2: o texto vai para o tradutor do governo
// num fetch POST com o corpo {"text": "..."}, e uma amostra das aberturas vai
// para o PostHog (estatística de uso, nos Estados Unidos) com o endereço da página.

// O widget vem do endereço oficial: o avatar roda numa página HTML (unity/index.html)
// que só o servidor do governo entrega como página (o jsDelivr a entrega como texto).
// A versão conferida fica anotada: o E2E avisa quando o governo atualizar o widget.
export const VLIBRAS_ROOT = "https://vlibras.gov.br/app";
export const VLIBRAS_VERSION = "7.12.2";

const TRANSLATOR_HOSTS = new Set(["traducao2.vlibras.gov.br", "traducao2-dth.vlibras.gov.br"]);
const READS = new Set(["GET", "HEAD", "OPTIONS"]);

// traducao: anonimiza e envia. bloqueado: qualquer outro envio de dados para fora
// da plataforma (fechado por padrão: uma mudança no widget não abre caminho sem a
// troca). analytics: a estatística de uso do widget, que não sai. outro: segue.
export type RequestKind = "traducao" | "bloqueado" | "analytics" | "outro";

export function requestKind(url: string, method = "GET", origin = "https://plataforma.invalid"): RequestKind {
  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return "outro";
  }
  if (parsed.hostname === "posthog.com" || parsed.hostname.endsWith(".posthog.com")) return "analytics";
  const verb = method.toUpperCase();
  if (TRANSLATOR_HOSTS.has(parsed.hostname)) return parsed.pathname.replace(/\/$/, "") === "/translate" && verb === "POST" ? "traducao" : "bloqueado";
  if (parsed.origin === new URL(origin).origin || READS.has(verb)) return "outro";
  return "bloqueado";
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
