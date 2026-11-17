import "server-only";
import QRCode from "qrcode";
import { db } from "./prisma";
import { hashRecoveryCode, matchTotpStep, newRecoveryCodes, otpauthUri } from "./totp";

type SecondFactorUser = { id: string; totpSecret: string | null; totpLastStep: number | null; recoveryCodes: string | null };

const parseCodes = (stored: string | null): string[] => {
  try {
    const value: unknown = JSON.parse(stored ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export const recoveryCodesLeft = (stored: string | null) => parseCodes(stored).length;

export async function consumeSecondFactor(user: SecondFactorUser, code: string): Promise<"aplicativo" | "recuperacao" | null> {
  const prisma = await db();
  if (!user.totpSecret) return null;
  const step = matchTotpStep(user.totpSecret, code);
  if (step !== null) {
    if (user.totpLastStep !== null && step <= user.totpLastStep) return null;
    const updated = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return updated.count ? "aplicativo" : null;
  }
  const hashes = parseCodes(user.recoveryCodes);
  const hash = hashRecoveryCode(code);
  if (!hashes.includes(hash)) return null;
  const updated = await prisma.user.updateMany({
    where: { id: user.id, recoveryCodes: user.recoveryCodes },
    data: { recoveryCodes: JSON.stringify(hashes.filter((item) => item !== hash)) },
  });
  return updated.count ? "recuperacao" : null;
}

export async function confirmTwoFactor(userId: string, code: string): Promise<string[] | null> {
  const prisma = await db();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpPendingSecret: true } });
  if (!user?.totpPendingSecret) return null;
  const step = matchTotpStep(user.totpPendingSecret, code);
  if (step === null) return null;
  const codes = newRecoveryCodes();
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: user.totpPendingSecret,
      totpPendingSecret: null,
      totpEnabledAt: new Date(),
      totpLastStep: step,
      recoveryCodes: JSON.stringify(codes.map(hashRecoveryCode)),
    },
  });
  return codes;
}

export async function newRecoveryCodesFor(userId: string): Promise<string[]> {
  const prisma = await db();
  const codes = newRecoveryCodes();
  await prisma.user.update({ where: { id: userId }, data: { recoveryCodes: JSON.stringify(codes.map(hashRecoveryCode)) } });
  return codes;
}

export async function totpQrSvg(secret: string, account: string): Promise<string> {
  return QRCode.toString(otpauthUri(secret, account), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
