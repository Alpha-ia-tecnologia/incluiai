import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseTutorials, tutorialsForRole, type Tutorial } from "@/lib/tutorials-core";

// Lista dos vídeos tutoriais, escrita pelo gravador em public/tutoriais/tutoriais.json.
// Sem o arquivo (os vídeos ainda não foram gravados), a lista vem vazia e a Ajuda
// não mostra a seção.
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
