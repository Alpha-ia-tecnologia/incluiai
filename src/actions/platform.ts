"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requirePlatformUser, type SessionUser } from "@/lib/auth";
import { forgetMunicipality, platformDb } from "@/lib/prisma";
import { provisionMunicipality, recordMunicipalityEvent, type Actor } from "@/lib/provisioning";
import { addressOf } from "@/lib/tenant";
import { databaseNameFor, defaultNetworkName, municipalityProblem, templateProblem, type MunicipalityInput } from "@/lib/tenancy-core";
import { readLogo, type Logo } from "@/lib/branding/logo";
import { suggestBrandColors } from "@/lib/branding/colors";
import { DEFAULT_BRAND, derivePalette, normalizeHex } from "@/lib/branding/palette";
import type { SuggestResult } from "@/components/plataforma/brand-editor";

export type CreateState = {
  error?: string;
  values?: MunicipalityInput;
  created?: { slug: string; name: string; address: string; adminEmail: string | null; password: string | null };
  failed?: { slug: string; name: string; error: string };
};
export type EditState = { error?: string; saved?: boolean };
export type RetryState = { error?: string; done?: boolean; adminEmail?: string | null; password?: string | null };

const text = (formData: FormData, key: string, max = 200) => String(formData.get(key) ?? "").trim().slice(0, max);
const actorOf = (user: SessionUser): Actor => ({ id: user.id, name: user.name });

function readInput(formData: FormData): MunicipalityInput {
  const name = text(formData, "name", 120);
  return {
    name,
    uf: text(formData, "uf", 2).toUpperCase(),
    networkName: text(formData, "networkName", 200) || (name ? defaultNetworkName(name) : ""),
    slug: text(formData, "slug", 60).toLowerCase(),
    adminName: text(formData, "adminName", 120),
    adminEmail: text(formData, "adminEmail", 200).toLowerCase(),
    existingDatabase: formData.get("existingDatabase") === "on",
    dbName: text(formData, "dbName", 80),
  };
}

function readBrand(formData: FormData) {
  const colors = derivePalette({
    primary: normalizeHex(text(formData, "primaryColor", 20)) ?? DEFAULT_BRAND.primary,
    menu: normalizeHex(text(formData, "menuColor", 20)) ?? DEFAULT_BRAND.menu,
  }).colors;
  const source = text(formData, "colorSource", 10);
  return { primaryColor: colors.primary, menuColor: colors.menu, colorSource: ["ia", "regras", "manual"].includes(source) ? source : "manual" };
}

async function logoFrom(formData: FormData): Promise<Logo | { problem: string } | null> {
  const file = formData.get("logo");
  return file instanceof File && file.size > 0 ? readLogo(file) : null;
}

export async function suggestColors(formData: FormData): Promise<SuggestResult> {
  await requirePlatformUser();
  const logo = await logoFrom(formData);
  if (!logo) return { ok: false, message: "Escolha o arquivo do logo primeiro." };
  if ("problem" in logo) return { ok: false, message: logo.problem };
  return { ok: true, value: await suggestBrandColors(logo, text(formData, "municipalityName", 120) || "o município") };
}

export async function createMunicipality(_previous: CreateState, formData: FormData): Promise<CreateState> {
  const user = await requirePlatformUser();
  const values = readInput(formData);
  const problem = municipalityProblem(values, true) ?? templateProblem(process.env.MUNICIPIO_DATABASE_URL);
  if (problem) return { error: problem, values };
  const logo = await logoFrom(formData);
  if (logo && "problem" in logo) return { error: logo.problem, values };
  const dbName = values.existingDatabase ? values.dbName : databaseNameFor(values.slug);
  const platform = platformDb();
  if (await platform.municipality.findUnique({ where: { slug: values.slug }, select: { id: true } })) return { error: "Este endereço já é de outro município.", values };
  if (await platform.municipality.findUnique({ where: { dbName }, select: { id: true } })) return { error: "Este banco já é de outro município.", values };
  let id: string;
  try {
    ({ id } = await platform.municipality.create({
      data: {
        slug: values.slug, name: values.name, uf: values.uf, networkName: values.networkName, dbName, status: "provisionando",
        ...readBrand(formData), logo: logo ? new Uint8Array(logo.data) : null, logoType: logo?.type ?? null,
        firstAdminName: values.adminName || null, firstAdminEmail: values.adminEmail || null,
      },
      select: { id: true },
    }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Este endereço ou este banco já é de outro município.", values };
    throw error;
  }
  await recordMunicipalityEvent(id, actorOf(user), "cadastrou o município", `Endereço ${values.slug}, banco ${dbName}${values.existingDatabase ? " (já existente)" : ""}`);
  const result = await provisionMunicipality(id, actorOf(user));
  revalidatePath("/plataforma");
  if (!result.ok) return { failed: { slug: values.slug, name: values.name, error: result.error } };
  return { created: { slug: values.slug, name: values.name, address: await addressOf(values.slug), adminEmail: result.adminEmail, password: result.temporaryPassword } };
}

export async function updateMunicipality(_previous: EditState, formData: FormData): Promise<EditState> {
  const user = await requirePlatformUser();
  const slug = text(formData, "slug", 60);
  const platform = platformDb();
  const current = await platform.municipality.findUnique({ where: { slug }, select: { id: true, name: true, uf: true, networkName: true, primaryColor: true, menuColor: true } });
  if (!current) return { error: "Município não encontrado." };
  const values = { ...readInput(formData), slug };
  const problem = municipalityProblem(values, false);
  if (problem) return { error: problem };
  const logo = await logoFrom(formData);
  if (logo && "problem" in logo) return { error: logo.problem };
  const brand = readBrand(formData);
  await platform.municipality.update({
    where: { id: current.id },
    data: { name: values.name, uf: values.uf, networkName: values.networkName, ...brand, ...(logo ? { logo: new Uint8Array(logo.data), logoType: logo.type } : {}) },
  });
  const changes = [
    current.name !== values.name || current.uf !== values.uf ? "nome ou UF" : null,
    current.networkName !== values.networkName ? "nome da rede" : null,
    current.primaryColor !== brand.primaryColor || current.menuColor !== brand.menuColor ? "cores" : null,
    logo ? "logo" : null,
  ].filter(Boolean);
  if (changes.length) await recordMunicipalityEvent(current.id, actorOf(user), "alterou o cadastro", changes.join(", "));
  forgetMunicipality(slug);
  revalidatePath("/plataforma");
  revalidatePath(`/plataforma/municipios/${slug}`);
  return { saved: true };
}

export async function changeMunicipalityStatus(formData: FormData): Promise<void> {
  const user = await requirePlatformUser();
  const slug = text(formData, "slug", 60);
  const to = text(formData, "status", 20);
  const from = to === "suspenso" ? "ativo" : to === "ativo" ? "suspenso" : null;
  if (!from) return;
  const platform = platformDb();
  const municipality = await platform.municipality.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (municipality?.status !== from) return;
  await platform.municipality.update({ where: { id: municipality.id }, data: { status: to } });
  await recordMunicipalityEvent(municipality.id, actorOf(user), to === "suspenso" ? "suspendeu o acesso" : "reativou o acesso", text(formData, "reason", 300) || undefined);
  forgetMunicipality(slug);
  revalidatePath("/plataforma");
  revalidatePath(`/plataforma/municipios/${slug}`);
}

export async function retryProvisioning(_previous: RetryState, formData: FormData): Promise<RetryState> {
  const user = await requirePlatformUser();
  const slug = text(formData, "slug", 60);
  const municipality = await platformDb().municipality.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!municipality || !["falhou", "provisionando"].includes(municipality.status)) return { error: "Este município não está esperando preparação." };
  const result = await provisionMunicipality(municipality.id, actorOf(user));
  return result.ok ? { done: true, adminEmail: result.adminEmail, password: result.temporaryPassword } : { error: result.error };
}
