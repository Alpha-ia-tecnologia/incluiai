"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { saveDiaryEntry } from "@/lib/records";

// Registro da aula ao fim de qualquer jogo da página Jogos educativos: vira um
// registro de aula como os outros (Registrar aula e Evolução), com o professor
// como autor. As permissões e o histórico de acessos ficam em saveDiaryEntry.

export type GameRecordState = { error?: string; saved?: boolean };

const PARTICIPATION = new Set(["total", "parcial", "recusou"]);
const CRITERION = new Set(["sim", "parcial", "nao"]);

export async function recordGameSession(studentId: string, _state: GameRecordState, formData: FormData): Promise<GameRecordState> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Faça login para registrar a aula.");
  const participation = String(formData.get("participation") ?? "");
  const criterionMet = String(formData.get("criterionMet") ?? "");
  const supportLevel = Number(formData.get("supportLevel"));
  if (!PARTICIPATION.has(participation) || !CRITERION.has(criterionMet) || !Number.isInteger(supportLevel) || supportLevel < 0 || supportLevel > 5) {
    return { error: "Marque a participação, o apoio e o resultado." };
  }
  const note = String(formData.get("nota") ?? "").trim().slice(0, 500) || "Jogo educativo.";
  await saveDiaryEntry(user, studentId, {
    objectiveId: null,
    activityId: null,
    participation: participation as "total" | "parcial" | "recusou",
    supportLevel,
    criterionMet: criterionMet as "sim" | "parcial" | "nao",
    note,
    whatWorked: "",
    recommendation: "",
    authorRole: user.role,
  });
  revalidatePath("/estudantes/[id]", "layout");
  revalidatePath("/estudantes");
  revalidatePath("/");
  return { saved: true };
}
