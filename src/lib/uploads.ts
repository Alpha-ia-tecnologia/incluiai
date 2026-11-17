import { UserError } from "./user-error.ts";

const MB = 1024 * 1024;

// O Next recusa o corpo da ação acima de serverActions.bodySizeLimit (next.config.ts)
// antes de a ação rodar, e a pessoa não vê a mensagem do limite: ele precisa ficar
// acima de todos estes (uploads.test.mjs confere).
export const UPLOAD_LIMIT_BYTES = {
  censusFile: 5 * MB,
  healthReport: 10 * MB,
  cardPhoto: 5 * MB,
  studentSheet: 512 * 1024,
  taskFile: 10 * MB,
} as const;

export const megabytes = (bytes: number): number => bytes / MB;

type UploadRules = { maxBytes: number; missing: string; tooLarge: string };

export function optionalUpload(value: FormDataEntryValue | null, rules: Omit<UploadRules, "missing">): File | null {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > rules.maxBytes) throw new UserError(rules.tooLarge);
  return value;
}

export function requiredUpload(value: FormDataEntryValue | null, rules: UploadRules): File {
  const file = optionalUpload(value, rules);
  if (!file) throw new UserError(rules.missing);
  return file;
}

// Excel em português e sistemas de gestão às vezes gravam em Windows-1252: sem UTF-8 válido, relê assim.
export async function readUploadedText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
