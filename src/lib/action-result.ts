import { z } from "zod/v4";
import { UserError, type Problem } from "./user-error.ts";

export type ActionResult<T = void> =
  | { ok: true; value: T; message?: string }
  | { ok: false; message: string; problems?: Problem[] };

type ActionFailure = Extract<ActionResult<never>, { ok: false }>;

export const SESSION_ENDED = "Sua sessão terminou. Entre de novo para continuar.";
const UNEXPECTED_INPUT = "Alguns campos vieram em formato inesperado. Atualize a página e tente de novo.";
export const FALLBACK = "Não foi possível concluir agora. Tente de novo em instantes.";

export function failureOf(error: unknown): ActionFailure | null {
  if (error instanceof UserError) return { ok: false, message: error.message, problems: error.problems };
  if (error instanceof z.ZodError) return { ok: false, message: UNEXPECTED_INPUT };
  return null;
}
