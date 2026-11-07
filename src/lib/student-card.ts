import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "./prisma";
import { canAccessStudent, canEditStudentRecord, type SessionUser } from "./auth";
import { CHANNELS, SHIFTS } from "./scale";
import { parseJson } from "./format";
import { cardHelp, formatPhone, hasHelp, newCardToken, type CardHelp } from "./student-card-core";

// Carteirinha digital (regras puras em student-card-core.ts). A carteirinha só
// existe com a autorização da família (Consent.card). O QR leva a /c/<código>,
// que pede login e encaminha cada perfil para o que ele já pode ver.

export const PENDING_CARD_COOKIE = "carteirinha_pendente";
export const cardPath = (token: string) => `/c/${token}`;

// Quem faz a carteirinha (foto, impressão, novo código): a equipe que escreve
// na ficha e tem acesso ao estudante. Quem a vê: essa equipe e a família.
export function canManageCard(user: SessionUser, schoolId: string, studentId: string): boolean {
  return canEditStudentRecord(user.role) && canAccessStudent(user, schoolId, studentId);
}
export function canViewCard(user: SessionUser, schoolId: string, studentId: string): boolean {
  return (user.role === "familia" && user.studentIds.includes(studentId)) || canManageCard(user, schoolId, studentId);
}

// Endereço público da plataforma, para o QR: APP_URL em produção; sem ele, o do pedido.
async function publicBaseUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.|\[::1\])/.test(host);
  return `${list.get("x-forwarded-proto") ?? (local ? "http" : "https")}://${host}`;
}

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
      calming: parseJson<string[]>(profile.calmingStrategies, []),
      triggers: parseJson<string[]>(profile.triggers, []),
    })
    : null;
  const parts = student.name.trim().split(/\s+/);
  const qrSvg = await QRCode.toString(`${await publicBaseUrl()}${cardPath(card.token)}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
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

// Novo código: a carteirinha impressa antes deixa de abrir qualquer coisa.
export async function rotateCardToken(studentId: string): Promise<void> {
  await prisma.studentCard.update({ where: { studentId }, data: { token: newCardToken(), issuedAt: new Date() } });
}
