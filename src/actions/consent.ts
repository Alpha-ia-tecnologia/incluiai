"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { setStudentConsent, type ConsentField } from "@/lib/consent";

// A família autoriza ou retira, a qualquer momento, o uso de IA e a conexão com o terapeuta.
export async function setFamilyConsent(studentId: string, field: ConsentField, value: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Faça login para decidir as autorizações.");
  if (field !== "aiUse" && field !== "therapistLink") throw new Error("Autorização desconhecida.");
  await setStudentConsent(user, studentId, field, value);
  revalidatePath(`/familia/${studentId}`);
  revalidatePath("/terapeuta");
  revalidatePath("/estudantes/[id]", "layout");
}
