export type LogoType = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TOO_BIG = "O logo passa de 2 MB. Envie um arquivo menor.";
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);

export function svgText(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function sniffLogo(bytes: Uint8Array): LogoType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  const text = svgText(bytes);
  return text !== null && /^\s*</.test(text) && /<svg[\s>]/.test(text) ? "image/svg+xml" : null;
}

const codePoint = (value: number) => (value <= 0x10ffff ? String.fromCodePoint(value) : "");
const decodeCharacterReferences = (text: string) => text
  .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => codePoint(parseInt(hex, 16)))
  .replace(/&#([0-9]+);?/g, (_, decimal: string) => codePoint(Number(decimal)));

// Os navegadores ignoram tabulação, quebra de linha e controles no meio do esquema de um endereço.
const JAVASCRIPT_URL = new RegExp(`${[..."javascript"].join("[\\s\\u0000-\\u001f]*")}[\\s\\u0000-\\u001f]*:`, "i");

const FORBIDDEN: [RegExp, string][] = [
  [/<!(?!--|\[CDATA\[)/, "tem declaração DOCTYPE ou ENTITY"],
  [/<([\w.-]+:)?script[\s/>]/i, "tem script"],
  [/<([\w.-]+:)?foreignObject[\s/>]/i, "tem conteúdo HTML embutido (foreignObject)"],
  [/<([\w.-]+:)?(iframe|embed|object|handler|listener)[\s/>]/i, "tem conteúdo embutido"],
  [/(^|[\s"'/])on[a-z]+\s*=/i, "tem código em atributo de evento (onload, onclick…)"],
  [JAVASCRIPT_URL, "tem link javascript:"],
  [/@import|<\?xml-stylesheet/i, "puxa folha de estilo de fora"],
  [/attributeName\s*=\s*["']?\s*([\w.-]+:)?href/i, "troca um link por animação"],
];

const SAFE_REFERENCE = /^(#|data:image\/(png|jpe?g|gif|webp)[;,])/i;
const REFERENCE_ATTRIBUTE = /(?:^|[\s"'/])(?:[\w.-]+:)?(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi;
const EXTERNAL = "aponta para arquivo ou endereço de fora (só valem referências internas, #…, e imagens embutidas)";

function externalReference(text: string): boolean {
  for (const match of text.matchAll(REFERENCE_ATTRIBUTE)) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (value && !SAFE_REFERENCE.test(value)) return true;
  }
  for (const match of text.matchAll(/url\(/gi)) {
    const rest = text.slice(match.index + 4);
    const end = rest.indexOf(")");
    if (end < 0) return true;
    const value = rest.slice(0, end).trim().replace(/^["']|["']$/g, "").trim();
    if (!SAFE_REFERENCE.test(value)) return true;
  }
  return false;
}

export function svgProblem(text: string): string | null {
  const decoded = decodeCharacterReferences(text);
  const reason = FORBIDDEN.find(([pattern]) => pattern.test(decoded))?.[1] ?? (externalReference(decoded) ? EXTERNAL : null);
  return reason ? `O logo em SVG ${reason}, e isso não é aceito. Exporte de novo como SVG simples ou envie em PNG.` : null;
}
