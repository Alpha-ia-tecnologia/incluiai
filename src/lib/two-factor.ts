import "server-only";
import QRCode from "qrcode";
import { db } from "./prisma";
import { hashRecoveryCode, matchTotpStep, newRecoveryCodes, otpauthUri } from "./totp";
import { readList, writeList } from "./format";

type SecondFactorUser = { id: string; totpSecret: string | null; totpLastStep: number | null; recoveryCodes: string | null };


export const recoveryCodesLeft = (stored: string | null) => readList(stored).length;

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
  const hashes = readList(user.recoveryCodes);
  const hash = hashRecoveryCode(code);
  if (!hashes.includes(hash)) return null;
  const updated = await prisma.user.updateMany({
    where: { id: user.id, recoveryCodes: user.recoveryCodes },
    data: { recoveryCodes: writeList(hashes.filter((item) => item !== hash)) },
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
      recoveryCodes: writeList(codes.map(hashRecoveryCode)),
    },
  });
  return codes;
}

export async function newRecoveryCodesFor(userId: string): Promise<string[]> {
  const prisma = await db();
  const codes = newRecoveryCodes();
  await prisma.user.update({ where: { id: userId }, data: { recoveryCodes: writeList(codes.map(hashRecoveryCode)) } });
  return codes;
}

export async function totpQrSvg(secret: string, account: string): Promise<string> {
  return QRCode.toString(otpauthUri(secret, account), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
