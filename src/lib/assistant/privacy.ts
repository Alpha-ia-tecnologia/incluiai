import { aiConsentAmong } from "../consent";
import type { SessionUser } from "../auth";
import { can } from "../roles";
import { namesInScope } from "../agents/names-in-scope";
import { createPseudonymizer, type PseudonymMap, type Pseudonymizer } from "../agents/redactor";
import { parseJson } from "../format";

export function parsePseudonyms(value: string | null | undefined): PseudonymMap {
  const parsed = parseJson<Partial<PseudonymMap> | null>(value, null);
  return { students: parsed?.students ?? {}, schools: parsed?.schools ?? {} };
}

export async function loadPseudonymizer(user: SessionUser, map: PseudonymMap): Promise<Pseudonymizer & { studentIds: string[] }> {
  const names = await namesInScope({ conversation: user });
  const pseudonymizer = createPseudonymizer({ map, students: names.students, schools: names.schools, family: names.family, professionals: names.professionals });
  const consented = await aiConsentAmong(names.students.map((student) => student.id));
  return { ...pseudonymizer, studentIds: !can(user.role, "seeNames") ? [] : names.students.filter((student) => consented.has(student.id)).map((student) => student.id) };
}
