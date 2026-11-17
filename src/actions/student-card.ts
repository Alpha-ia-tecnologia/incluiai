"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { AUDIT_ACTION, recordChange } from "@/lib/audit";
import { canViewCard, rotateCardToken } from "@/lib/student-card";
import { canWorkWithStudent, isFamilyOf } from "@/lib/policy";
import { MAX_CARD_PHOTO_BYTES, MAX_CARD_PHOTO_MB, normalizePhone, sniffCardPhoto, stripPhotoMetadata } from "@/lib/student-card-core";
import { FAMILY_MEMBER_OPTIONS } from "@/lib/form-options";

export type CardFormState = { error?: string; saved?: boolean };

async function loadCardStudent(studentId: string) {
  const prisma = await db();
  const user = await getCurrentUser();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, consent: { select: { card: true } }, card: { select: { id: true } } } });
  if (!user || !student) throw new Error("Estudante não encontrado.");
  if (!student.consent?.card || !student.card) throw new Error("A família ainda não autorizou a carteirinha.");
  return { user, student };
}

async function requireCardManager(studentId: string): Promise<SessionUser> {
  const { user, student } = await loadCardStudent(studentId);
  if (!canWorkWithStudent(user, student)) throw new Error("Você não tem permissão para fazer a carteirinha deste estudante.");
  return user;
}

function refresh(studentId: string) {
  revalidatePath(`/estudantes/${studentId}/carteirinha`);
  revalidatePath(`/familia/${studentId}`);
}

export async function uploadCardPhoto(studentId: string, _state: CardFormState, formData: FormData): Promise<CardFormState> {
  const prisma = await db();
  const user = await requireCardManager(studentId);
  const file = formData.get("foto");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha a foto." };
  if (file.size > MAX_CARD_PHOTO_BYTES) return { error: `A foto tem mais de ${MAX_CARD_PHOTO_MB} MB. Envie uma menor.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffCardPhoto(bytes);
  if (!type) return { error: "Envie a foto em JPG ou PNG." };
  // Sem metadados: a foto de um celular pode trazer a localização de onde foi tirada.
  const clean = stripPhotoMetadata(bytes, type);
  if (!clean) return { error: "Não foi possível ler esta foto. Tente outra." };
  await prisma.studentCard.update({ where: { studentId }, data: { photo: new Uint8Array(clean), photoMime: type, photoUpdatedAt: new Date() } });
  await recordChange(user, studentId, AUDIT_ACTION.sent, "Foto da carteirinha");
  refresh(studentId);
  return { saved: true };
}

export async function removeCardPhoto(studentId: string) {
  const prisma = await db();
  const user = await requireCardManager(studentId);
  await prisma.studentCard.update({ where: { studentId }, data: { photo: null, photoMime: null, photoUpdatedAt: null } });
  await recordChange(user, studentId, AUDIT_ACTION.deleted, "Foto da carteirinha");
  refresh(studentId);
}

export async function rotateStudentCard(studentId: string) {
  const { user, student } = await loadCardStudent(studentId);
  if (!canViewCard(user, student)) throw new Error("Você não tem permissão para trocar o código desta carteirinha.");
  await rotateCardToken(studentId);
  await recordChange(user, studentId, AUDIT_ACTION.replaced, "Código da carteirinha (o anterior deixou de valer)");
  refresh(studentId);
}

export async function saveCardPreferences(studentId: string, _state: CardFormState, formData: FormData): Promise<CardFormState> {
  const prisma = await db();
  const { user } = await loadCardStudent(studentId);
  if (!isFamilyOf(user, studentId)) throw new Error("Só a família escolhe o que aparece na carteirinha.");
  const showHelp = formData.get("mostrarComoAjudar") === "on";
  const showEmergency = formData.get("mostrarContato") === "on";
  const name = String(formData.get("contatoNome") ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const relationInput = String(formData.get("contatoParentesco") ?? "").trim();
  const relation = FAMILY_MEMBER_OPTIONS.includes(relationInput) ? relationInput : "";
  const phoneInput = String(formData.get("contatoTelefone") ?? "").trim();
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  if (phoneInput && !phone) return { error: "Confira o telefone: use o DDD e o número, como (11) 98765-4321." };
  if (showEmergency && (!name || !phone)) return { error: "Para mostrar o contato na carteirinha, preencha o nome e o telefone." };
  await prisma.studentCard.update({
    where: { studentId },
    data: { showHelp, showEmergency, emergencyName: name || null, emergencyRelation: relation || null, emergencyPhone: phone },
  });
  await recordChange(user, studentId, AUDIT_ACTION.changed, "Carteirinha: verso e contato de emergência");
  refresh(studentId);
  return { saved: true };
}
