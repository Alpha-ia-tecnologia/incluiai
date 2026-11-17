"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import type { ActionResult } from "@/lib/action-result";
import { formField } from "@/lib/form-data";
import { runAction, runFormAction } from "@/lib/server-action";
import { addMaterialImages, approveStudentMaterial, createStudentMaterial, deleteStudentMaterial, saveMaterialActivity } from "@/lib/material-generate";

const galleryPath = (studentId: string) => `/estudantes/${studentId}/materiais`;

const materialRequest = z.object({ kind: formField.text(), topic: formField.text(), context: formField.text(), objectiveId: formField.optionalText(), gerarImagens: formField.checkbox() });

export async function generateMaterial(studentId: string, _previous: unknown, formData: FormData): Promise<ActionResult> {
  return runFormAction(formData, materialRequest, async (user, data) => {
    const { material, source, images } = await createStudentMaterial(user, studentId, { ...data, withImages: data.gerarImagens });
    const query = new URLSearchParams({ criado: source });
    if (images.requested) {
      query.set("imagens", String(images.created));
      if (images.errors.length) query.set("falhas", "1");
    }
    redirect(`${galleryPath(studentId)}/${material.id}?${query}`);
  });
}

export async function approveMaterial(studentId: string, materialId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await approveStudentMaterial(user, studentId, materialId);
  });
}

export async function generateMaterialImagesAction(studentId: string, materialId: string): Promise<ActionResult<{ created: number; errors: string[] }>> {
  return runAction(async (user) => {
    return addMaterialImages(user, studentId, materialId);
  });
}

export async function sendMaterialActivity(studentId: string, materialId: string, index: number): Promise<ActionResult> {
  return runAction(async (user) => {
    await saveMaterialActivity(user, studentId, materialId, index);
  });
}

export async function deleteMaterial(studentId: string, materialId: string): Promise<ActionResult> {
  return runAction(async (user) => {
    await deleteStudentMaterial(user, studentId, materialId);
    redirect(galleryPath(studentId));
  });
}
