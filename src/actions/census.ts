"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { UPLOAD_LIMIT_BYTES, megabytes, readUploadedText, requiredUpload } from "@/lib/uploads";
import { UserError } from "@/lib/user-error";
import * as census from "@/lib/census";
import type { ReviewDecision } from "@/lib/census-core";

export async function uploadCensusFile(schoolId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const file = requiredUpload(formData.get("file"), {
      maxBytes: UPLOAD_LIMIT_BYTES.censusFile,
      missing: "Escolha o arquivo de migração exportado do Educacenso ou do sistema de gestão.",
      tooLarge: `O arquivo tem mais de ${megabytes(UPLOAD_LIMIT_BYTES.censusFile)} MB. Exporte só a escola.`,
    });
    const importId = await census.analyzeCensusFile(user, schoolId, await readUploadedText(file));
    redirect(`/censo/importacoes/${importId}`);
  });
}

const decisionForm = z.object({ decision: formField.text(), reason: formField.text() });

export async function decideCensusPerson(importId: string, personKey: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, decisionForm, async (user, data) => {
    const decision: ReviewDecision | null = data.decision.startsWith("link:")
      ? { personKey, decision: "link", studentId: data.decision.slice(5) }
      : data.decision === "create" || data.decision === "ignore" ? { personKey, decision: data.decision, reason: data.reason } : null;
    if (!decision) throw new UserError("Escolha o que fazer com esta pessoa.");
    await census.saveDecision(user, importId, decision);
    revalidatePath(`/censo/importacoes/${importId}`);
  });
}

export async function undoCensusDecision(importId: string, personKey: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await census.undoDecision(user, importId, personKey);
    revalidatePath(`/censo/importacoes/${importId}`);
  });
}

export async function applyCensusImport(importId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    const { schoolId, created, updated } = await census.applyImport(user, importId);
    revalidatePath("/censo");
    revalidatePath("/estudantes");
    redirect(`/censo/escolas/${schoolId}?aplicado=${created}-${updated}`);
  });
}

export async function discardCensusImport(importId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    const schoolId = await census.discardImport(user, importId);
    redirect(schoolId ? `/censo/escolas/${schoolId}` : "/censo");
  });
}

export async function verifyCensusNow(): Promise<ActionResult> {
  return runAction(async (user) => {
    await census.verifyCensusNow(user);
    revalidatePath("/censo");
  });
}

const windowForm = z.object({ enabled: formField.checkbox(), periodStart: formField.text(), periodEnd: formField.text(), times: formField.list() });

export async function saveCensusWindow(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, windowForm, async (user, data) => {
    await census.saveCensusWindow(user, data);
    revalidatePath("/censo");
  });
}

const fndeForm = z.object({ fndeAee: formField.text(), fndeYear: formField.text() });

export async function saveFndeCount(_previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, fndeForm, async (user, data) => {
    await census.saveFnde(user, { count: data.fndeAee, year: Number(data.fndeYear) });
    revalidatePath("/censo");
  });
}

export async function saveSchoolInep(schoolId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, z.object({ inepCode: formField.text() }), async (user, data) => {
    await census.setSchoolInep(user, schoolId, data.inepCode);
    revalidatePath(`/censo/escolas/${schoolId}`);
  });
}

export async function saveStudentInep(studentId: string, schoolId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, z.object({ inepId: formField.text() }), async (user, data) => {
    await census.setStudentInep(user, studentId, data.inepId);
    revalidatePath(`/censo/escolas/${schoolId}`);
  });
}
