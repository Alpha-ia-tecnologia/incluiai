"use server";

import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { deleteCardPhoto, rotateCard, saveCardPhoto, setCardPreferences } from "@/lib/student-card";

export async function uploadCardPhoto(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runAction((user) => saveCardPhoto(user, studentId, formData.get("foto")));
}

export async function removeCardPhoto(studentId: string): Promise<ActionResult> {
  return runAction((user) => deleteCardPhoto(user, studentId));
}

export async function rotateStudentCard(studentId: string): Promise<ActionResult> {
  return runAction((user) => rotateCard(user, studentId));
}

const preferencesForm = z.object({
  mostrarComoAjudar: formField.checkbox(),
  mostrarContato: formField.checkbox(),
  contatoNome: formField.text(),
  contatoParentesco: formField.text(),
  contatoTelefone: formField.text(),
});

export async function saveCardPreferences(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, preferencesForm, (user, form) => setCardPreferences(user, studentId, {
    showHelp: form.mostrarComoAjudar,
    showEmergency: form.mostrarContato,
    name: form.contatoNome,
    relation: form.contatoParentesco,
    phone: form.contatoTelefone,
  }));
}
