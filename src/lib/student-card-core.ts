// Carteirinha digital do estudante: regras puras, testadas com node --test
// (src/lib/student-card-core.test.mjs). O código do QR, a foto e o contato de
// emergência ficam em src/lib/student-card.ts.

// O código do QR é aleatório (18 bytes, 24 caracteres): não deriva do nome nem
// do id do estudante, e trocar o código invalida a carteirinha anterior.
export const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

export function newCardToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

export const MAX_CARD_PHOTO_MB = 5;
export const MAX_CARD_PHOTO_BYTES = MAX_CARD_PHOTO_MB * 1024 * 1024;

export type CardPhotoType = "image/jpeg" | "image/png";

// O tipo vem dos primeiros bytes, não da extensão nem do que o navegador declara.
export function sniffCardPhoto(bytes: Uint8Array): CardPhotoType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) return "image/png";
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// JPEG sem metadados: saem o APP1 (Exif, com a localização do GPS, e XMP), o
// APP13 (IPTC), os blocos de fabricante (APP3 a APP12 e APP15) e os comentários.
// Ficam o APP0 (JFIF), o APP2 (perfil de cor) e o APP14 (Adobe, necessário
// para as cores de alguns arquivos). Estrutura inesperada: null.
function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let index = 2;
  while (index + 4 <= bytes.length) {
    if (bytes[index] !== 0xff) return null;
    const marker = bytes[index + 1];
    // Bytes de preenchimento (0xFF repetido) antes do marcador.
    if (marker === 0xff) {
      index += 1;
      continue;
    }
    // Início da imagem comprimida (SOS) ou fim: o resto segue como está.
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.subarray(index));
      return concat(parts);
    }
    const length = (bytes[index + 2] << 8) | bytes[index + 3];
    if (length < 2 || index + 2 + length > bytes.length) return null;
    const metadata = marker === 0xe1 || marker === 0xed || marker === 0xfe || (marker >= 0xe3 && marker <= 0xec) || marker === 0xef;
    if (!metadata) parts.push(bytes.subarray(index, index + 2 + length));
    index += 2 + length;
  }
  return null;
}

// PNG sem metadados: saem os blocos de texto, data e Exif.
const PNG_METADATA = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
function stripPng(bytes: Uint8Array): Uint8Array | null {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let index = 8;
  while (index + 12 <= bytes.length) {
    const length = ((bytes[index] << 24) >>> 0) + (bytes[index + 1] << 16) + (bytes[index + 2] << 8) + bytes[index + 3];
    const type = String.fromCharCode(...bytes.subarray(index + 4, index + 8));
    const end = index + 12 + length;
    if (end > bytes.length) return null;
    if (!PNG_METADATA.has(type)) parts.push(bytes.subarray(index, end));
    index = end;
    if (type === "IEND") return concat(parts);
  }
  return null;
}

export function stripPhotoMetadata(bytes: Uint8Array, type: CardPhotoType): Uint8Array | null {
  return type === "image/jpeg" ? stripJpeg(bytes) : stripPng(bytes);
}

// Telefone brasileiro com DDD, guardado só com os dígitos (10 ou 11).
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return digits;
}

export function formatPhone(digits: string): string {
  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

// "Como me ajudar", na voz do estudante: só o que é funcional (comunicação, o
// que acalma, o que incomoda), duas ideias por linha para caber no cartão.
// Nada de diagnóstico.
export type CardHelp = { communication: string | null; calming: string[]; avoid: string[] };

export function cardHelp(input: { channel: string | null; commandSteps: number | null; calming: string[]; triggers: string[] }): CardHelp {
  const pick = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, 2);
  const steps = input.commandSteps && input.commandSteps > 0
    ? input.commandSteps === 1 ? "um pedido por vez" : `pedidos de até ${input.commandSteps} etapas`
    : null;
  return {
    communication: input.channel ? [input.channel, steps].filter(Boolean).join("; entendo ") : null,
    calming: pick(input.calming),
    avoid: pick(input.triggers),
  };
}

export const hasHelp = (help: CardHelp) => Boolean(help.communication || help.calming.length || help.avoid.length);
