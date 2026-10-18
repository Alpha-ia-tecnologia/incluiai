// Regras da sessão e do limite de tentativas, puras (sem banco nem cookies),
// para teste com node --test (src/lib/session-core.test.mjs). Seção 14 da
// proposta: perfis de acesso com sessão que expira e pode ser revogada.
import { createHash, randomBytes } from "node:crypto";

// Validade absoluta: um turno de trabalho. Sem uso por 2 horas, a sessão cai:
// computadores de escola costumam ser compartilhados.
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
// O último uso é gravado no máximo a cada 5 minutos (não a cada clique).
export const SESSION_TOUCH_MS = 5 * 60 * 1000;

// 5 erros no mesmo e-mail em 15 minutos bloqueiam novas tentativas por 15 minutos.
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Código da sessão: 32 bytes aleatórios. O banco guarda só o resumo SHA-256,
// então quem ler o banco não consegue usar a sessão de ninguém.
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionState = "valida" | "expirada" | "ociosa";

export function sessionState(session: { expiresAt: Date; lastSeenAt: Date }, now: Date = new Date()): SessionState {
  if (session.expiresAt.getTime() <= now.getTime()) return "expirada";
  if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_IDLE_MS) return "ociosa";
  return "valida";
}

export function shouldTouchSession(lastSeenAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastSeenAt.getTime() >= SESSION_TOUCH_MS;
}

// Bloqueado = já houve o máximo de erros na janela, contados depois do último acerto.
export function loginBlocked(attempts: ReadonlyArray<{ success: boolean; createdAt: Date }>, now: Date = new Date()): boolean {
  const recent = attempts
    .filter((attempt) => now.getTime() - attempt.createdAt.getTime() < LOGIN_WINDOW_MS)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lastSuccess = recent.findLastIndex((attempt) => attempt.success);
  const failures = recent.slice(lastSuccess + 1).filter((attempt) => !attempt.success).length;
  return failures >= LOGIN_MAX_FAILURES;
}
