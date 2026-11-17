import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseTutorials, tutorialsForRole, type Tutorial } from "@/lib/tutorials-core";

export async function listTutorials(): Promise<Tutorial[]> {
  try {
    return parseTutorials(JSON.parse(await readFile(join(process.cwd(), "public", "tutoriais", "tutoriais.json"), "utf8")));
  } catch {
    return [];
  }
}

export async function tutorialsFor(role: string): Promise<Tutorial[]> {
  return tutorialsForRole(await listTutorials(), role);
}
