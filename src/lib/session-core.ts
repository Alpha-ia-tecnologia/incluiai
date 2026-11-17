import { createHash, randomBytes } from "node:crypto";

export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
export const MFA_PENDING_MS = 10 * 60 * 1000;
export const SESSION_TOUCH_MS = 5 * 60 * 1000;

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

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

export function loginBlocked(attempts: ReadonlyArray<{ success: boolean; createdAt: Date }>, now: Date = new Date()): boolean {
  const recent = attempts
    .filter((attempt) => now.getTime() - attempt.createdAt.getTime() < LOGIN_WINDOW_MS)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lastSuccess = recent.findLastIndex((attempt) => attempt.success);
  const failures = recent.slice(lastSuccess + 1).filter((attempt) => !attempt.success).length;
  return failures >= LOGIN_MAX_FAILURES;
}
