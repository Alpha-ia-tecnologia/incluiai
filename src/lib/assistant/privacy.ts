import { aiConsentAmong } from "../consent";
import type { SessionUser } from "../auth";
import { can } from "../roles";
import { namesInScope } from "../agents/names-in-scope";
import { createPseudonymizer, type PseudonymMap, type Pseudonymizer } from "../agents/redactor";

export function parsePseudonyms(value: string | null | undefined): PseudonymMap {
  try {
    const parsed = value ? (JSON.parse(value) as Partial<PseudonymMap>) : {};
    return { students: parsed.students ?? {}, schools: parsed.schools ?? {} };
  } catch {
    return { students: {}, schools: {} };
  }
}

export async function loadPseudonymizer(user: SessionUser, map: PseudonymMap): Promise<Pseudonymizer & { studentIds: string[] }> {
  const names = await namesInScope({ conversation: user });
  const pseudonymizer = createPseudonymizer({ map, students: names.students, schools: names.schools, family: names.family, professionals: names.professionals });
  const consented = await aiConsentAmong(names.students.map((student) => student.id));
  return { ...pseudonymizer, studentIds: !can(user.role, "seeNames") ? [] : names.students.filter((student) => consented.has(student.id)).map((student) => student.id) };
}
