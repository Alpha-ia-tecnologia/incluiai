import "server-only";
import type { SessionUser } from "./auth";
import { redactorFor } from "./agents/names-in-scope";
import type { Redactor } from "./agents/redactor";
import { tidyForLibras } from "./vlibras-core";

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; redactor: Redactor }>();

async function cachedRedactor(user: SessionUser | null): Promise<Redactor> {
  const key = user ? `${user.id}:${user.role}:${user.schoolId ?? ""}:${user.studentIds.join(",")}` : "anonimo";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.redactor;
  const redactor = await redactorFor({ reader: user });
  cache.set(key, { at: Date.now(), redactor });
  return redactor;
}

export async function anonymizeForLibras(user: SessionUser | null, text: string): Promise<string> {
  return tidyForLibras((await cachedRedactor(user)).redactInWords(text));
}
