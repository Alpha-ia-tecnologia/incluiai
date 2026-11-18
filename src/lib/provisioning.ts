import "server-only";
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { hashPassword } from "./passwords";
import { forgetMunicipality, municipalityDb, municipalityUrl, platformDb } from "./prisma";
import { isPostgresUrl } from "../../prisma/database-url.mjs";
import { NEW_DATABASE_PATTERN, PLATFORM_ROLE, databaseNameFor, sqliteFile } from "./tenancy-core";
import { temporaryPassword } from "./accounts-core";
import { usesPostgres } from "./env-config";

const run = promisify(execFile);
const STEP_TIMEOUT_MS = 5 * 60_000;

export type Actor = { id: string | null; name: string };
export type ProvisionResult = { ok: true; temporaryPassword: string | null; adminEmail: string | null } | { ok: false; error: string };

export async function recordMunicipalityEvent(municipalityId: string, actor: Actor, action: string, detail?: string): Promise<void> {
  await platformDb().municipalityEvent.create({ data: { municipalityId, actorId: actor.id, actorName: actor.name, action, detail: detail?.slice(0, 1000) ?? null } });
}

// Mensagens do Prisma CLI podem trazer o endereço do banco: a senha não vai para a tela nem para o histórico.
const describe = (error: unknown) =>
  (error instanceof Error ? [error.message, (error as { stderr?: string }).stderr].filter(Boolean).join("\n") : String(error))
    .replace(/postgres(ql)?:\/\/[^\s"'`]+/g, "postgresql://…")
    .trim()
    .slice(0, 1000);

async function prismaCli(url: string, args: string[]): Promise<void> {
  const cli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  await run(process.execPath, [cli, ...args], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, timeout: STEP_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
}

async function createDatabase(slug: string, dbName: string): Promise<void> {
  if (dbName !== databaseNameFor(slug)) return;
  if (!NEW_DATABASE_PATTERN.test(dbName)) throw new Error(`Nome de banco fora do padrão: ${dbName}`);
  if (!usesPostgres()) throw new Error("O banco da plataforma (DATABASE_URL) e o dos municípios (MUNICIPIO_DATABASE_URL) precisam ser do mesmo tipo.");
  const platform = platformDb();
  const found = await platform.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (!found.length) await platform.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
}

// Conta já criada e nunca usada: a preparação anterior parou antes de mostrar a senha.
async function firstSecretaria(dbName: string, name: string | null, email: string | null): Promise<string | null> {
  if (!name || !email) return null;
  const client = municipalityDb(dbName);
  const password = temporaryPassword();
  const existing = await client.user.findUnique({ where: { email }, select: { id: true, role: true, mustChangePassword: true, lastLoginAt: true } });
  if (existing) {
    if (existing.role !== "secretaria" || !existing.mustChangePassword || existing.lastLoginAt) return null;
    await client.user.update({ where: { id: existing.id }, data: { passwordHash: hashPassword(password) } });
    return password;
  }
  if (await client.user.count()) return null;
  const user = await client.user.create({ data: { name, email, role: "secretaria", passwordHash: hashPassword(password), mustChangePassword: true } });
  await client.accountEvent.create({ data: { userId: user.id, actorName: "Administração da plataforma", actorRole: PLATFORM_ROLE, action: "criou", detail: "Primeira conta da Secretaria" } });
  return password;
}

export async function provisionMunicipality(id: string, actor: Actor): Promise<ProvisionResult> {
  const platform = platformDb();
  const municipality = await platform.municipality.update({ where: { id }, data: { status: "provisionando", provisionError: null } });
  forgetMunicipality(municipality.slug);
  try {
    const url = municipalityUrl(municipality.dbName);
    if (isPostgresUrl(url)) {
      await createDatabase(municipality.slug, municipality.dbName);
      await prismaCli(url, ["migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"]);
    } else {
      const file = sqliteFile(url);
      if (file) await mkdir(dirname(file), { recursive: true });
      await prismaCli(url, ["db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"]);
    }
    await run(process.execPath, ["prisma/seed-resources.mjs"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, timeout: STEP_TIMEOUT_MS });
    const password = await firstSecretaria(municipality.dbName, municipality.firstAdminName, municipality.firstAdminEmail);
    await platform.municipality.update({ where: { id }, data: { status: "ativo", provisionError: null } });
    await recordMunicipalityEvent(id, actor, "preparou o ambiente", password ? `Conta da Secretaria: ${municipality.firstAdminEmail}` : "Banco com contas: nenhuma conta nova");
    return { ok: true, temporaryPassword: password, adminEmail: password ? municipality.firstAdminEmail : null };
  } catch (error) {
    const message = describe(error);
    console.error(`[município ${municipality.slug}] preparação falhou: ${message}`);
    await platform.municipality.update({ where: { id }, data: { status: "falhou", provisionError: message } });
    await recordMunicipalityEvent(id, actor, "a preparação falhou", message);
    return { ok: false, error: message };
  } finally {
    forgetMunicipality(municipality.slug);
  }
}
