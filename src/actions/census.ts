"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { CENSUS_MAX_BYTES, analyzeCensusFile, applyImport, canOpenSchool, censusAccess, decodeCensusFile, discardImport, saveDecision, setStudentInep, undoDecision } from "@/lib/census";
import { runVerification, saveMonitorConfig } from "@/lib/census-core";
import { cleanMonitorConfig, type ReviewDecision } from "@/lib/census-rules";
import { digitsOnly } from "@/lib/educacenso";

export type CensusState = { error?: string; saved?: boolean };

async function requireCensus(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!censusAccess(user)) redirect("/");
  return user;
}

// Envio do arquivo de migração: vira uma prévia (o arquivo não fica guardado).
export async function uploadCensusFile(schoolId: string, _previous: CensusState, formData: FormData): Promise<CensusState> {
  const user = await requireCensus();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Escolha o arquivo de migração exportado do Educacenso ou do sistema de gestão." };
  if (file.size > CENSUS_MAX_BYTES) return { error: "O arquivo tem mais de 5 MB. Exporte só a escola." };
  const result = await analyzeCensusFile(user, schoolId, decodeCensusFile(new Uint8Array(await file.arrayBuffer())));
  if ("error" in result) return { error: result.error };
  redirect(`/censo/importacoes/${result.importId}`);
}

// Revisão manual: vincular a um estudante, cadastrar como novo ou ignorar com motivo.
export async function decideCensusPerson(importId: string, personKey: string, _previous: CensusState, formData: FormData): Promise<CensusState> {
  const user = await requireCensus();
  const choice = String(formData.get("decision") ?? "");
  const decision: ReviewDecision | null = choice.startsWith("link:")
    ? { personKey, decision: "link", studentId: choice.slice(5) }
    : choice === "create" || choice === "ignore" ? { personKey, decision: choice, reason: String(formData.get("reason") ?? "") } : null;
  if (!decision) return { error: "Escolha o que fazer com esta pessoa." };
  const error = await saveDecision(user, importId, decision);
  if (error) return { error };
  revalidatePath(`/censo/importacoes/${importId}`);
  return { saved: true };
}

export async function undoCensusDecision(importId: string, personKey: string) {
  const user = await requireCensus();
  await undoDecision(user, importId, personKey);
  revalidatePath(`/censo/importacoes/${importId}`);
}

export async function applyCensusImport(importId: string, _previous: CensusState): Promise<CensusState> {
  const user = await requireCensus();
  const censusImport = await prisma.censusImport.findUnique({ where: { id: importId }, select: { schoolId: true } });
  const result = await applyImport(user, importId);
  if ("error" in result) return { error: result.error };
  revalidatePath("/censo");
  revalidatePath("/estudantes");
  redirect(`/censo/escolas/${censusImport?.schoolId}?aplicado=${result.created}-${result.updated}`);
}

export async function discardCensusImport(importId: string) {
  const user = await requireCensus();
  const censusImport = await prisma.censusImport.findUnique({ where: { id: importId }, select: { schoolId: true } });
  await discardImport(user, importId);
  redirect(censusImport ? `/censo/escolas/${censusImport.schoolId}` : "/censo");
}

export async function verifyCensusNow(_previous: CensusState): Promise<CensusState> {
  const user = await requireCensus();
  await runVerification("manual", user.name);
  revalidatePath("/censo");
  return { saved: true };
}

// Janela do Censo e horários das verificações (a Secretaria configura para a rede).
export async function saveCensusWindow(_previous: CensusState, formData: FormData): Promise<CensusState> {
  const user = await requireCensus();
  if (!censusAccess(user)?.canConfigure) return { error: "Só a Secretaria configura a janela do Censo." };
  const config = cleanMonitorConfig({
    enabled: formData.get("enabled") === "on",
    periodStart: String(formData.get("periodStart") ?? ""),
    periodEnd: String(formData.get("periodEnd") ?? ""),
    times: formData.getAll("times").map(String),
  });
  if ("error" in config) return { error: config.error };
  await saveMonitorConfig(config, user.name);
  revalidatePath("/censo");
  return { saved: true };
}

// Matrículas de AEE que o FNDE considerou no Fundeb (vazio apaga).
export async function saveFndeCount(_previous: CensusState, formData: FormData): Promise<CensusState> {
  const user = await requireCensus();
  if (!censusAccess(user)?.canConfigure) return { error: "Só a Secretaria informa o número do FNDE." };
  const raw = String(formData.get("fndeAee") ?? "").trim();
  const year = Number(formData.get("fndeYear"));
  const count = raw ? Number(raw) : null;
  if (count !== null && (!Number.isInteger(count) || count < 0 || count > 1_000_000)) return { error: "Informe um número inteiro de matrículas." };
  if (count !== null && (!Number.isInteger(year) || year < 2020 || year > 2100)) return { error: "Informe o ano do Fundeb." };
  await prisma.censusMonitor.update({ where: { id: "rede" }, data: { fndeAee: count, fndeYear: count === null ? null : year, updatedBy: user.name } });
  revalidatePath("/censo");
  return { saved: true };
}

export async function saveSchoolInep(schoolId: string, _previous: CensusState, formData: FormData): Promise<CensusState> {
  const user = await requireCensus();
  if (!canOpenSchool(user, schoolId)) return { error: "Você altera só a sua escola." };
  const code = digitsOnly(String(formData.get("inepCode") ?? ""));
  if (code.length !== 8) return { error: "O código INEP da escola tem 8 números." };
  const other = await prisma.school.findFirst({ where: { inepCode: code, NOT: { id: schoolId } }, select: { name: true } });
  if (other) return { error: `O código ${code} já está ligado a ${other.name}.` };
  await prisma.school.update({ where: { id: schoolId }, data: { inepCode: code } });
  revalidatePath(`/censo/escolas/${schoolId}`);
  return { saved: true };
}

export async function saveStudentInep(studentId: string, schoolId: string, _previous: CensusState, formData: FormData): Promise<CensusState> {
  const user = await requireCensus();
  const error = await setStudentInep(user, studentId, String(formData.get("inepId") ?? ""));
  if (error) return { error };
  revalidatePath(`/censo/escolas/${schoolId}`);
  return { saved: true };
}
