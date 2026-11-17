"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/server-action";
import { recordJourneyMark } from "@/lib/user-journey";

export async function startJourney(href: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await recordJourneyMark(user.id, "boas_vindas");
    redirect(href.startsWith("/") && !href.startsWith("//") ? href : "/jornada");
  });
}

export async function dismissWelcome(): Promise<ActionResult> {
  return runAction(async (user) => {
    await recordJourneyMark(user.id, "boas_vindas");
    revalidatePath("/", "layout");
  });
}
