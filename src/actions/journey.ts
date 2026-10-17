"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { recordJourneyMark } from "@/lib/user-journey";

// Boas-vindas da jornada: começar pelo capítulo sugerido ou deixar para depois.
// Nos dois casos as boas-vindas não aparecem de novo; a jornada continua em /jornada.

export async function startJourney(href: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await recordJourneyMark(user.id, "boas_vindas");
  // Só destinos internos da plataforma.
  redirect(href.startsWith("/") && !href.startsWith("//") ? href : "/jornada");
}

export async function dismissWelcome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await recordJourneyMark(user.id, "boas_vindas");
  revalidatePath("/", "layout");
}
