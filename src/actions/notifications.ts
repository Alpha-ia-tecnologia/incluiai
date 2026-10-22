"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { saveCheckIn } from "@/lib/notifications";

export type NoticeState = { error?: string; saved?: boolean };

export async function setNoticePrefs(_previous: NoticeState, formData: FormData): Promise<NoticeState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await prisma.user.update({ where: { id: user.id }, data: { notifyByEmail: formData.get("notifyByEmail") === "on", weeklyCheckIn: formData.get("weeklyCheckIn") === "on" } });
  revalidatePath("/avisos");
  return { saved: true };
}

export async function answerCheckIn(studentId: string, _previous: NoticeState, formData: FormData): Promise<NoticeState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const error = await saveCheckIn(user, studentId, formData.getAll("answers").map(String), String(formData.get("note") ?? ""));
  if (error) return { error };
  revalidatePath(`/familia/${studentId}`);
  return { saved: true };
}
