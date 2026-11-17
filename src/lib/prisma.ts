import { AsyncLocalStorage } from "node:async_hooks";
import { isAbsolute, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import { PLATFORM_HEADER, TENANT_HEADER, municipalityDatabaseUrl, normalizeDomain, parseHost, requestHost, sqliteFile, type MunicipalityStatus } from "./tenancy-core";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  municipalityClients?: Map<string, PrismaClient>;
  municipalityRegistry?: Map<string, { value: MunicipalityRecord | null; expires: number }>;
};

const client = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = client;
}

const MUNICIPALITY_CONNECTIONS = 5;
const REGISTRY_TTL_MS = 30_000;
const REGISTRY_MAX = 500;
const clients = (globalForPrisma.municipalityClients ??= new Map());
const registry = (globalForPrisma.municipalityRegistry ??= new Map());
const scope = new AsyncLocalStorage<{ slug: string }>();

const registrySelect = {
  id: true, slug: true, name: true, uf: true, networkName: true, dbName: true, status: true,
  primaryColor: true, menuColor: true, logoType: true, updatedAt: true,
} as const;

export type MunicipalityRecord = {
  id: string; slug: string; name: string; uf: string; networkName: string; dbName: string; status: string;
  primaryColor: string; menuColor: string; logoType: string | null; updatedAt: Date;
};

export type Tenant =
  | { kind: "unico" }
  | { kind: "plataforma" }
  | { kind: "neutro" }
  | { kind: "municipio"; slug: string; municipality: MunicipalityRecord | null };

export const platformDomain = () => normalizeDomain(process.env.PLATFORM_DOMAIN);

export function platformDb(): PrismaClient {
  return client;
}

// O SQLite relativo vira absoluto (a partir da pasta prisma/, como faz o Prisma CLI):
// o cliente e o CLI, rodando de lugares diferentes, abrem o mesmo arquivo.
export function municipalityUrl(dbName: string, connectionLimit?: number): string {
  const url = municipalityDatabaseUrl(process.env.MUNICIPIO_DATABASE_URL ?? "", dbName, connectionLimit);
  const file = sqliteFile(url);
  return file && !isAbsolute(file) ? `file:${resolve(process.cwd(), "prisma", file)}${url.slice(`file:${file}`.length)}` : url;
}

export function municipalityDb(dbName: string): PrismaClient {
  const known = clients.get(dbName);
  if (known) return known;
  const created = new PrismaClient({ datasourceUrl: municipalityUrl(dbName, MUNICIPALITY_CONNECTIONS) });
  clients.set(dbName, created);
  return created;
}

export async function findMunicipality(slug: string): Promise<MunicipalityRecord | null> {
  const cached = registry.get(slug);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await client.municipality.findUnique({ where: { slug }, select: registrySelect });
  registry.delete(slug);
  if (registry.size >= REGISTRY_MAX) registry.delete(registry.keys().next().value!);
  registry.set(slug, { value, expires: Date.now() + REGISTRY_TTL_MS });
  return value;
}

export function forgetMunicipality(slug: string): void {
  registry.delete(slug);
}

export function withMunicipality<T>(slug: string, task: () => Promise<T>): Promise<T> {
  return scope.run({ slug }, task);
}

export async function forEachMunicipality(task: () => Promise<unknown>): Promise<void> {
  if (!platformDomain()) {
    await task();
    return;
  }
  const active = await client.municipality.findMany({ where: { status: "ativo" satisfies MunicipalityStatus }, select: { slug: true }, orderBy: { slug: "asc" } });
  for (const { slug } of active) {
    await withMunicipality(slug, task).catch((error) => console.error(`[município ${slug}]`, error));
  }
}

// O cabeçalho do proxy só vale se o endereço disser o mesmo: um pedido que não passou
// pelo proxy (caminho fora do matcher) não escolhe o banco pelo cabeçalho.
async function requestArea(domain: string): Promise<Exclude<Tenant, { kind: "unico" }>> {
  const list = await headers();
  const area = parseHost(requestHost((name) => list.get(name)), domain);
  if (area.kind === "plataforma" && list.get(PLATFORM_HEADER) === "1") return area;
  if (area.kind === "municipio" && list.get(TENANT_HEADER) === area.slug) return { kind: "municipio", slug: area.slug, municipality: null };
  return { kind: "neutro" };
}

export async function currentTenant(): Promise<Tenant> {
  const domain = platformDomain();
  if (!domain) return { kind: "unico" };
  const slug = scope.getStore()?.slug;
  const area = slug ? { kind: "municipio" as const, slug, municipality: null } : await requestArea(domain);
  if (area.kind !== "municipio") return area;
  return { ...area, municipality: await findMunicipality(area.slug) };
}

export async function isPlatformArea(): Promise<boolean> {
  return (await currentTenant()).kind === "plataforma";
}

export class MunicipalityUnavailableError extends Error {
  readonly status: 404 | 503;
  constructor(tenant: Tenant) {
    const municipality = tenant.kind === "municipio" ? tenant.municipality : null;
    const status = municipality?.status;
    super(
      !municipality ? "Este endereço não é de um município da plataforma. Use o endereço do seu município."
        : status === "suspenso" ? `O acesso de ${municipality.name} está suspenso. Fale com a Secretaria de Educação.`
        : `O ambiente de ${municipality.name} ainda está sendo preparado. Tente de novo em alguns minutos.`,
    );
    this.name = "MunicipalityUnavailableError";
    this.status = municipality ? 503 : 404;
  }
}

export async function db(): Promise<PrismaClient> {
  const tenant = await currentTenant();
  if (tenant.kind === "unico" || tenant.kind === "plataforma") return client;
  if (tenant.kind === "municipio" && tenant.municipality?.status === "ativo") return municipalityDb(tenant.municipality.dbName);
  throw new MunicipalityUnavailableError(tenant);
}
