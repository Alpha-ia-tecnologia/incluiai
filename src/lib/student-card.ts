import "server-only";
import QRCode from "qrcode";
import { db } from "./prisma";
import { publicAddress } from "./network";
import type { SessionUser } from "./auth";
import { AUDIT_ACTION, recordChange } from "./audit";
import { invalidateStudent } from "./invalidate";
import { requiredUpload } from "./uploads";
import { UserError } from "./user-error";
import { canWorkWithStudent, isFamilyOf } from "./policy";
import { CHANNELS, SHIFTS } from "./scale";
import { readList } from "./format";
import { FAMILY_MEMBER_OPTIONS } from "./form-options";
import { CARD_PHOTO_UPLOAD, cardHelp, formatPhone, hasHelp, newCardToken, normalizePhone, sniffCardPhoto, stripPhotoMetadata, type CardHelp } from "./student-card-core";

export const PENDING_CARD_COOKIE = "carteirinha_pendente";
export const cardPath = (token: string) => `/c/${token}`;

export const canViewCard = (user: SessionUser, student: { id: string; schoolId: string }): boolean => isFamilyOf(user, student.id) || canWorkWithStudent(user, student);

export type CardView = {
  studentId: string;
  name: string;
  initials: string;
  avatarHue: number;
  school: string;
  classLine: string;
  photoUrl: string | null;
  help: CardHelp | null;
  emergency: { name: string; relation: string | null; phone: string } | null;
  qrSvg: string;
  qrPath: string;
  issuedAt: Date;
  settings: { showHelp: boolean; showEmergency: boolean; emergencyName: string; emergencyRelation: string; emergencyPhone: string; hasPhoto: boolean; hasProfile: boolean };
  guardian: { name: string; phone: string };
};

export async function loadCardView(studentId: string): Promise<CardView | null> {
  const prisma = await db();
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, name: true, gradeYear: true, className: true, shift: true, avatarHue: true, guardianName: true, guardianPhone: true,
      school: { select: { name: true } },
      consent: { select: { card: true } },
      card: { select: { token: true, photoUpdatedAt: true, showHelp: true, showEmergency: true, emergencyName: true, emergencyRelation: true, emergencyPhone: true, issuedAt: true } },
      profile: { select: { expressiveChannel: true, commandSteps: true, calmingStrategies: true, triggers: true } },
    },
  });
  if (!student?.consent?.card || !student.card) return null;
  const { card, profile } = student;
  const help = profile
    ? cardHelp({
      channel: CHANNELS[profile.expressiveChannel] ?? null,
      commandSteps: profile.commandSteps,
      calming: readList(profile.calmingStrategies),
      triggers: readList(profile.triggers),
    })
    : null;
  const parts = student.name.trim().split(/\s+/);
  const qrSvg = await QRCode.toString(`${await publicAddress()}${cardPath(card.token)}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return {
    studentId: student.id,
    name: student.name,
    initials: `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase(),
    avatarHue: student.avatarHue,
    school: student.school.name,
    classLine: [student.gradeYear, student.className, SHIFTS[student.shift] ?? student.shift].filter(Boolean).join(" · "),
    photoUrl: card.photoUpdatedAt ? `/api/carteirinha/${student.id}/foto?v=${card.photoUpdatedAt.getTime()}` : null,
    help: card.showHelp && help && hasHelp(help) ? help : null,
    emergency: card.showEmergency && card.emergencyName && card.emergencyPhone
      ? { name: card.emergencyName, relation: card.emergencyRelation, phone: formatPhone(card.emergencyPhone) }
      : null,
    qrSvg,
    qrPath: cardPath(card.token),
    issuedAt: card.issuedAt,
    settings: {
      showHelp: card.showHelp,
      showEmergency: card.showEmergency,
      emergencyName: card.emergencyName ?? "",
      emergencyRelation: card.emergencyRelation ?? "",
      emergencyPhone: card.emergencyPhone ? formatPhone(card.emergencyPhone) : "",
      hasPhoto: Boolean(card.photoUpdatedAt),
      hasProfile: Boolean(help && hasHelp(help)),
    },
    guardian: { name: student.guardianName, phone: student.guardianPhone ?? "" },
  };
}

export async function syncCardWithConsent(studentId: string, authorized: boolean): Promise<void> {
  const prisma = await db();
  if (authorized) await prisma.studentCard.upsert({ where: { studentId }, create: { studentId, token: newCardToken() }, update: {} });
  else await prisma.studentCard.deleteMany({ where: { studentId } });
}

async function cardStudent(studentId: string) {
  const prisma = await db();
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, consent: { select: { card: true } }, card: { select: { id: true } } } });
  if (!student) throw new UserError("Estudante não encontrado.", "not_found");
  if (!student.consent?.card || !student.card) throw new UserError("A família ainda não autorizou a carteirinha.", "conflict");
  return student;
}

async function assertCardManager(user: SessionUser, studentId: string) {
  const student = await cardStudent(studentId);
  if (!canWorkWithStudent(user, student)) throw new UserError("Você não tem permissão para fazer a carteirinha deste estudante.", "forbidden");
}

export async function saveCardPhoto(user: SessionUser, studentId: string, upload: FormDataEntryValue | null): Promise<void> {
  const prisma = await db();
  await assertCardManager(user, studentId);
  const bytes = new Uint8Array(await requiredUpload(upload, CARD_PHOTO_UPLOAD).arrayBuffer());
  const type = sniffCardPhoto(bytes);
  if (!type) throw new UserError("Envie a foto em JPG ou PNG.");
  // Sem metadados: a foto de um celular pode trazer a localização de onde foi tirada.
  const clean = stripPhotoMetadata(bytes, type);
  if (!clean) throw new UserError("Não foi possível ler esta foto. Tente outra.");
  await prisma.studentCard.update({ where: { studentId }, data: { photo: new Uint8Array(clean), photoMime: type, photoUpdatedAt: new Date() } });
  await recordChange(user, studentId, AUDIT_ACTION.sent, "Foto da carteirinha");
  invalidateStudent(studentId);
}

export async function deleteCardPhoto(user: SessionUser, studentId: string): Promise<void> {
  const prisma = await db();
  await assertCardManager(user, studentId);
  await prisma.studentCard.update({ where: { studentId }, data: { photo: null, photoMime: null, photoUpdatedAt: null } });
  await recordChange(user, studentId, AUDIT_ACTION.deleted, "Foto da carteirinha");
  invalidateStudent(studentId);
}

export async function rotateCard(user: SessionUser, studentId: string): Promise<void> {
  const prisma = await db();
  const student = await cardStudent(studentId);
  if (!canViewCard(user, student)) throw new UserError("Você não tem permissão para trocar o código desta carteirinha.", "forbidden");
  await prisma.studentCard.update({ where: { studentId }, data: { token: newCardToken(), issuedAt: new Date() } });
  await recordChange(user, studentId, AUDIT_ACTION.replaced, "Código da carteirinha (o anterior deixou de valer)");
  invalidateStudent(studentId);
}

type CardPreferences = { showHelp: boolean; showEmergency: boolean; name: string; relation: string; phone: string };

export async function setCardPreferences(user: SessionUser, studentId: string, input: CardPreferences): Promise<void> {
  const prisma = await db();
  await cardStudent(studentId);
  if (!isFamilyOf(user, studentId)) throw new UserError("Só a família escolhe o que aparece na carteirinha.", "forbidden");
  const name = input.name.replace(/\s+/g, " ").slice(0, 60);
  const relation = FAMILY_MEMBER_OPTIONS.includes(input.relation) ? input.relation : "";
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) throw new UserError("Confira o telefone: use o DDD e o número, como (11) 98765-4321.");
  if (input.showEmergency && (!name || !phone)) throw new UserError("Para mostrar o contato na carteirinha, preencha o nome e o telefone.");
  await prisma.studentCard.update({
    where: { studentId },
    data: { showHelp: input.showHelp, showEmergency: input.showEmergency, emergencyName: name || null, emergencyRelation: relation || null, emergencyPhone: phone },
  });
  await recordChange(user, studentId, AUDIT_ACTION.changed, "Carteirinha: verso e contato de emergência");
  invalidateStudent(studentId);
}
