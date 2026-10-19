// Código de verificação em duas etapas (TOTP, RFC 6238), puro para teste com
// node --test (src/lib/totp.test.mjs). Compatível com os aplicativos
// autenticadores comuns: SHA-1, 6 dígitos, janela de 30 segundos.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// Segredo novo: 20 bytes aleatórios (160 bits), em base32 como os aplicativos esperam.
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

// Janela de 30 segundos de um instante (o contador do RFC 6238).
export const totpStep = (timeMs: number) => Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);

// HOTP (RFC 4226) com o contador do tempo (RFC 6238).
function hotp(secret: string, counter: number, digits: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totpAt(secret: string, timeMs: number, digits = TOTP_DIGITS): string {
  return hotp(secret, totpStep(timeMs), digits);
}

// Janela em que o código bate (a atual, a anterior ou a seguinte: relógio do
// celular adiantado ou atrasado), ou null. Quem chama guarda a janela usada e
// recusa as que não forem posteriores: o mesmo código não entra duas vezes.
export function matchTotpStep(secret: string, code: string, nowMs: number = Date.now(), window = 1): number | null {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== TOTP_DIGITS) return null;
  const now = totpStep(nowMs);
  for (let step = now - window; step <= now + window; step++) {
    if (timingSafeEqual(Buffer.from(hotp(secret, step, TOTP_DIGITS)), Buffer.from(clean))) return step;
  }
  return null;
}

export function verifyTotp(secret: string, code: string, nowMs: number = Date.now(), window = 1): boolean {
  return matchTotpStep(secret, code, nowMs, window) !== null;
}

// Endereço que o aplicativo autenticador lê pelo QR code.
export function otpauthUri(secret: string, account: string, issuer = "IncluiEdu"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

// Segredo em grupos de 4 letras, para digitar no aplicativo sem o QR code.
export const groupSecret = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

// Códigos de recuperação: 8 códigos de uso único (XXXX-XXXX); o banco guarda só o resumo.
export function newRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(5)).slice(0, 8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase().replace(/[^A-Z2-7]/g, "")).digest("hex");
}
