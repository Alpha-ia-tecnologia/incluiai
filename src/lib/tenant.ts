import "server-only";
import { headers } from "next/headers";
import { MunicipalityUnavailableError, currentTenant, isPlatformArea, type MunicipalityRecord, type Tenant } from "./prisma";
import { platformDomain } from "./env-config";
import { DEFAULT_BRAND, normalizeHex, type BrandColors } from "./branding/palette";
import { municipalityAddress, requestHost } from "./tenancy-core";

export type MunicipalityBrand = { name: string; logoUrl: string | null; colors: BrandColors };

export const versioned = (path: string, updatedAt: Date) => `${path}?v=${updatedAt.getTime()}`;

export function brandOf(municipality: MunicipalityRecord): MunicipalityBrand {
  return {
    name: municipality.name,
    logoUrl: municipality.logoType ? versioned("/marca/logo", municipality.updatedAt) : null,
    colors: {
      primary: normalizeHex(municipality.primaryColor) ?? DEFAULT_BRAND.primary,
      menu: normalizeHex(municipality.menuColor) ?? DEFAULT_BRAND.menu,
    },
  };
}

export const isAvailable = (tenant: Tenant) =>
  tenant.kind === "unico" || tenant.kind === "plataforma" || (tenant.kind === "municipio" && tenant.municipality?.status === "ativo");

export async function currentBrand(): Promise<MunicipalityBrand | null> {
  const tenant = await currentTenant();
  return tenant.kind === "municipio" && tenant.municipality?.status === "ativo" ? brandOf(tenant.municipality) : null;
}

export async function unavailableResponse(): Promise<Response | null> {
  const tenant = await currentTenant();
  if (tenant.kind === "unico" || (tenant.kind === "municipio" && tenant.municipality?.status === "ativo")) return null;
  if (tenant.kind === "plataforma") return new Response("Não encontrado.", { status: 404 });
  const { message, status } = new MunicipalityUnavailableError(tenant);
  return new Response(message, { status, headers: status === 503 ? { "Retry-After": "300" } : {} });
}

export async function homeAfterLogin(): Promise<string> {
  return (await isPlatformArea()) ? "/plataforma" : "/";
}

export async function addressOf(slug: string): Promise<string> {
  const list = await headers();
  const host = requestHost((name) => list.get(name));
  const local = /^(localhost|127\.|\[::1\])|\.localhost(:\d+)?$/.test(host ?? "");
  const protocol = list.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  return municipalityAddress(slug, platformDomain() ?? "", host, protocol);
}
