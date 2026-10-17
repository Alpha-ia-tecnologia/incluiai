export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// Primeiro nome para saudações, sem títulos e observações entre parênteses:
// "Prof.ª Beatriz (AEE)" → "Beatriz"; "Carla (mãe de Dante)" → "Carla".
export function firstName(name: string): string {
  return name.replace(/\([^)]*\)/g, " ").split(/\s+/).find((part) => part.length > 1 && !part.includes(".")) ?? name;
}

export function formatDateShort(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ageFrom(birthDate: Date | string): number {
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
