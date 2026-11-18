// Demonstração de vários municípios (desenvolvimento e testes): no banco da
// plataforma (DATABASE_URL), a conta de demonstração da plataforma e o município "demo",
// apontado para o banco de demonstração que já existe (DEMO_BANCO, padrão "dev",
// ou seja, prisma/dev.db com MUNICIPIO_DATABASE_URL="file:./{banco}.db").
// Uso: npm run db:plataforma
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/passwords.ts";
import { isPostgresUrl } from "./database-url.mjs";
import { DEMO_PASSWORD, PLATFORM_DEMO_ACCOUNT } from "./demo-data.mjs";

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

if (isPostgresUrl(process.env.DATABASE_URL) && process.env.SEED_DEMO_OK !== "1") {
  fail("Esta demonstração refaz a conta e o município de exemplo. Num banco PostgreSQL, rode só num banco de testes, com SEED_DEMO_OK=1.");
}
if (!(process.env.PLATFORM_DOMAIN ?? "").trim() || !(process.env.MUNICIPIO_DATABASE_URL ?? "").includes("{banco}")) {
  fail('Defina PLATFORM_DOMAIN (ex.: localhost), DATABASE_URL com o banco da plataforma (ex.: "file:./plataforma.db") e MUNICIPIO_DATABASE_URL (ex.: "file:./{banco}.db").');
}

const prisma = new PrismaClient();
const DEMO_BANCO = (process.env.DEMO_BANCO ?? "dev").trim();

async function main() {
  const { name, email } = PLATFORM_DEMO_ACCOUNT;
  const fresh = { passwordHash: hashPassword(DEMO_PASSWORD), mustChangePassword: false, deactivatedAt: null, totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: null };
  await prisma.user.upsert({
    where: { email },
    create: { name, email, role: "plataforma", demo: true, ...fresh },
    update: { role: "plataforma", demo: true, ...fresh },
  });
  await prisma.session.deleteMany({ where: { user: { email } } });
  await prisma.loginAttempt.deleteMany();

  const data = {
    name: "Município Demonstração", uf: "MG", networkName: "Secretaria Municipal de Educação de Município Demonstração",
    dbName: DEMO_BANCO, status: "ativo", provisionError: null, primaryColor: "#0a6a9a", menuColor: "#0b3550", colorSource: "regras",
  };
  const existing = await prisma.municipality.findUnique({ where: { slug: "demo" }, select: { id: true } });
  const demo = existing
    ? await prisma.municipality.update({ where: { id: existing.id }, data })
    : await prisma.municipality.create({ data: { slug: "demo", ...data } });
  if (!existing) {
    await prisma.municipalityEvent.create({ data: { municipalityId: demo.id, actorName: "Dados de demonstração", action: "cadastrou o município", detail: `Banco já existente: ${DEMO_BANCO}` } });
  }
  const domain = process.env.PLATFORM_DOMAIN.trim();
  console.log("Plataforma de demonstração pronta:");
  console.log(`- admin.${domain}: ${email} (senha ${DEMO_PASSWORD})`);
  console.log(`- demo.${domain}: o banco "${DEMO_BANCO}", com as contas de demonstração de sempre`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
