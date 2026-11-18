export function firstName(name: string): string {
  return name.replace(/\([^)]*\)/g, " ").split(/\s+/).find((part) => part.length > 1 && !part.includes(".")) ?? name;
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function splitItems(value: string | null | undefined, separator: "," | ";" = ";"): string[] {
  const pattern = separator === "," ? /[,;\n]/ : /[;\n]/;
  return (value ?? "").split(pattern).map((item) => item.trim()).filter(Boolean);
}

export const joinItems = (items: readonly string[], separator: "," | ";" = ";") => items.join(separator === "," ? ", " : "; ");

export function readList(value: string | null | undefined): string[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

export const writeList = (items: readonly string[]) => JSON.stringify(items);
