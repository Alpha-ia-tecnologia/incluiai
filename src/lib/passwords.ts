import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

let dummyHash: string | null = null;
export function verifyPasswordOrDummy(password: string, stored: string | null): boolean {
  if (stored) return verifyPassword(password, stored);
  dummyHash ??= hashPassword("incluiedu-conta-inexistente");
  verifyPassword(password, dummyHash);
  return false;
}
