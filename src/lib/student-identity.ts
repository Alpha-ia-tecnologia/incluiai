export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const normalizeName = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

export const nameBirthKey = (name: string, birthDate: string) => `nb:${normalizeName(name)}|${birthDate}`;

type Identified = { inepId?: string | null; cpf?: string | null; name: string; birthDate?: string | null };

export function identityKeys(person: Identified): string[] {
  const keys: string[] = [];
  if (person.inepId) keys.push(`inep:${digitsOnly(person.inepId)}`);
  if (person.cpf && digitsOnly(person.cpf).length === 11) keys.push(`cpf:${digitsOnly(person.cpf)}`);
  if (person.birthDate) keys.push(nameBirthKey(person.name, person.birthDate));
  return keys;
}

export type MatchBy = "inep" | "cpf" | "nome_nascimento" | "nome" | "manual";

export function findMatch<T extends Identified>(person: Identified, list: readonly T[]): { found?: T; by?: MatchBy; sameName: T[] } {
  const inep = digitsOnly(person.inepId ?? "");
  const cpf = digitsOnly(person.cpf ?? "");
  if (inep) {
    const found = list.find((item) => digitsOnly(item.inepId ?? "") === inep);
    if (found) return { found, by: "inep", sameName: [] };
  }
  if (cpf.length === 11) {
    const found = list.find((item) => digitsOnly(item.cpf ?? "") === cpf);
    if (found) return { found, by: "cpf", sameName: [] };
  }
  const name = normalizeName(person.name);
  const sameName = list.filter((item) => normalizeName(item.name) === name);
  if (person.birthDate) {
    const found = sameName.find((item) => item.birthDate === person.birthDate);
    if (found) return { found, by: "nome_nascimento", sameName: [] };
  }
  if (sameName.length === 1) return { found: sameName[0], by: "nome", sameName: [] };
  return { sameName };
}
