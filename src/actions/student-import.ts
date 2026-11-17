"use server";

import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runFormAction } from "@/lib/server-action";
import { readUploadedText, requiredUpload } from "@/lib/uploads";
import { SHEET_UPLOAD } from "@/lib/student-import";
import { checkStudentSheet, importStudentSheet, type SheetCheck } from "@/lib/students";

type Line = { line: number; name: string };
export type SheetView = {
  csv: string;
  schoolId: string;
  schoolName: string;
  ready: (Line & { detail: string; similar: boolean })[];
  existing: Line[];
  invalid: (Line & { errors: string[] })[];
  imported?: number;
};

const sheetForm = z.object({ intent: formField.text(20), schoolId: formField.text(64), csv: z.string().default("") });

const birth = (iso: string) => iso.split("-").reverse().join("/");

const viewOf = (sheet: SheetCheck, csv: string): SheetView => ({
  csv, schoolId: sheet.school.id, schoolName: sheet.school.name,
  ready: sheet.ready.map(({ line, record, similar }) => ({ line, name: record.name, similar, detail: `${birth(record.birthDate)} · ${record.gradeYear} · ${record.className}` })),
  existing: sheet.existing, invalid: sheet.invalid,
});

export async function importStudents(_previous: unknown, formData: FormData): Promise<ActionResult<SheetView>> {
  return runFormAction(formData, sheetForm, async (user, form) => {
    const schoolId = user.schoolId ?? form.schoolId;
    if (form.intent === "importar") {
      const sheet = await importStudentSheet(user, schoolId, form.csv);
      return { ...viewOf(sheet, form.csv), imported: sheet.ready.length };
    }
    const text = await readUploadedText(requiredUpload(formData.get("file"), SHEET_UPLOAD));
    return viewOf(await checkStudentSheet(user, schoolId, text), text);
  });
}
