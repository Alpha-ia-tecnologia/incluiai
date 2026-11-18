import { isPostgresUrl } from "../../prisma/database-url.mjs";

export const PLATFORM_ROLE = "plataforma";
export const PLATFORM_LABEL = "admin";
export const TENANT_HEADER = "x-municipio";
export const PLATFORM_HEADER = "x-plataforma";
export const RESERVED_SLUGS: readonly string[] = ["admin", "www", "api", "app", "plataforma"];
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
export const BANCO_PLACEHOLDER = "{banco}";

export const MUNICIPALITY_STATUSES = ["provisionando", "ativo", "suspenso", "falhou"] as const;
export type MunicipalityStatus = (typeof MUNICIPALITY_STATUSES)[number];
export const STATUS_LABELS: Record<MunicipalityStatus, string> = {
  provisionando: "Em preparação",
  ativo: "Ativo",
  suspenso: "Suspenso",
  falhou: "Falhou",
};

export const STATUS_TONES = { provisionando: "info", ativo: "good", suspenso: "mid", falhou: "alert" } as const satisfies Record<MunicipalityStatus, string>;

export const UFS: readonly string[] = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

export type HostArea = { kind: "plataforma" } | { kind: "municipio"; slug: string } | { kind: "neutro" };
export type RouteDecision = { action: "seguir"; area: HostArea } | { action: "redirecionar"; path: string };

export function normalizeDomain(value: string | null | undefined): string | null {
  const domain = (value ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return domain || null;
}

export function slugProblem(slug: string): string | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return `O endereço precisa ter de ${SLUG_MIN} a ${SLUG_MAX} caracteres.`;
  if (!/^[a-z0-9-]+$/.test(slug)) return "Use só letras minúsculas sem acento, números e hífen.";
  // Rótulo de DNS (RFC 1123): não começa nem termina com hífen.
  if (slug.startsWith("-") || slug.endsWith("-")) return "O endereço não pode começar nem terminar com hífen.";
  if (RESERVED_SLUGS.includes(slug)) return "Este endereço é reservado para a plataforma.";
  return null;
}

export function suggestSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

// Nomes de host não diferenciam maiúsculas (RFC 4343) e podem vir com porta ou ponto final.
export function parseHost(host: string | null | undefined, domain: string): HostArea {
  const name = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const suffix = `.${domain}`;
  if (!name.endsWith(suffix)) return { kind: "neutro" };
  const label = name.slice(0, -suffix.length);
  if (label === PLATFORM_LABEL) return { kind: "plataforma" };
  return slugProblem(label) === null ? { kind: "municipio", slug: label } : { kind: "neutro" };
}

// Ao seguir o redirect de uma ação de servidor, o Next refaz o pedido para o
// endereço interno do servidor (localhost) e leva o endereço original em
// x-forwarded-host, como o proxy reverso na frente da plataforma.
export function requestHost(get: (name: string) => string | null): string | null {
  return get("x-forwarded-host")?.split(",")[0]?.trim() || get("host");
}

export const STATUS_PATH = "/indisponivel";

const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);
export const isPanelPath = (pathname: string) => isUnder(pathname, "/plataforma");
export const isPlatformPath = (pathname: string) => isPanelPath(pathname) || isUnder(pathname, "/login");

export function routeRequest(area: HostArea, pathname: string): RouteDecision {
  if (area.kind === "plataforma" && !isPlatformPath(pathname)) return { action: "redirecionar", path: "/plataforma" };
  if (area.kind === "municipio" && isPanelPath(pathname)) return { action: "redirecionar", path: "/" };
  return { action: "seguir", area };
}

// O PostgreSQL não aceita parâmetro no nome do banco do CREATE DATABASE: só
// nomes neste formato (derivados do subdomínio) vão para o SQL.
export const NEW_DATABASE_PATTERN = /^incluiedu_[a-z0-9_]{3,40}$/;
export const EXISTING_DATABASE_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/;

export function databaseNameFor(slug: string): string {
  return `incluiedu_${slug.replaceAll("-", "_")}`;
}

export function existingDatabaseProblem(name: string): string | null {
  return EXISTING_DATABASE_PATTERN.test(name) ? null : "Nome de banco inválido: use letras, números, _ e -, começando por letra.";
}

export function templateProblem(template: string | null | undefined): string | null {
  if (!template?.trim()) return "Defina MUNICIPIO_DATABASE_URL (o endereço dos bancos dos municípios, com {banco} no lugar do nome).";
  if (!template.includes(BANCO_PLACEHOLDER)) return "MUNICIPIO_DATABASE_URL precisa ter {banco} no lugar do nome do banco.";
  return null;
}

export function municipalityDatabaseUrl(template: string, dbName: string, connectionLimit?: number): string {
  const problem = templateProblem(template) ?? existingDatabaseProblem(dbName);
  if (problem) throw new Error(problem);
  const url = template.trim().replaceAll(BANCO_PLACEHOLDER, dbName);
  if (!connectionLimit || !isPostgresUrl(url) || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${connectionLimit}`;
}

// No Prisma, o caminho relativo de "file:" é contado a partir da pasta do schema.
export function sqliteFile(url: string): string | null {
  return url.startsWith("file:") ? url.slice("file:".length).split("?")[0] : null;
}

export function municipalityAddress(slug: string, domain: string, requestHost: string | null, protocol: string): string {
  const port = (requestHost ?? "").match(/:(\d+)$/)?.[1];
  return `${protocol}://${slug}.${domain}${port ? `:${port}` : ""}`;
}

export function defaultNetworkName(name: string): string {
  return `Secretaria Municipal de Educação de ${name.trim()}`;
}

export type MunicipalityInput = {
  name: string; uf: string; networkName: string; slug: string;
  adminName: string; adminEmail: string; existingDatabase: boolean; dbName: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function municipalityProblem(input: MunicipalityInput, creating: boolean): string | null {
  if (input.name.length < 2 || input.name.length > 80) return "Informe o nome do município (até 80 caracteres).";
  if (!UFS.includes(input.uf)) return "Escolha a UF.";
  if (input.networkName.length < 5 || input.networkName.length > 160) return "Informe o nome da rede de ensino, como sai no cabeçalho dos documentos.";
  if (!creating) return null;
  const slug = slugProblem(input.slug);
  if (slug) return slug;
  if (input.existingDatabase) {
    const database = existingDatabaseProblem(input.dbName);
    if (database) return database;
  }
  const admin = input.adminName || input.adminEmail || !input.existingDatabase;
  if (admin && input.adminName.length < 3) return "Informe o nome de quem vai usar a primeira conta da Secretaria.";
  if (admin && (!EMAIL.test(input.adminEmail) || input.adminEmail.length > 160)) return "Informe um e-mail válido para a primeira conta da Secretaria.";
  return null;
}
