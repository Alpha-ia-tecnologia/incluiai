// Banco de dados do IncluiEdu: SQLite no desenvolvimento e nos testes,
// PostgreSQL em produção. O schema de referência é prisma/schema.prisma
// (SQLite); o do PostgreSQL (prisma/postgresql/schema.prisma) é gerado a partir
// dele, porque o Prisma não troca o tipo de banco por variável de ambiente.
//
//   node scripts/prisma-db.mjs gerar
//       Cliente do Prisma para o banco do DATABASE_URL (só gera se mudou).
//   node scripts/prisma-db.mjs configurar
//       Monta o DATABASE_URL a partir dos campos POSTGRES_* do .env (ou usa o
//       endereço já colado nele), testa a conexão, cria as tabelas e carrega o
//       catálogo de atividades e recursos.
//   node scripts/prisma-db.mjs tabelas
//       Cria ou atualiza as tabelas (PostgreSQL: migrações; SQLite: db push).
//   node scripts/prisma-db.mjs migracao <nome>
//       Nova migração do PostgreSQL com as mudanças do schema desde a última.
//   node scripts/prisma-db.mjs admin --nome "Nome" --email email@municipio.gov.br
//       Primeira conta da Secretaria, com senha temporária (troca no 1º acesso).
//
// O DATABASE_URL da linha de comando vence o do .env (os testes usam o SQLite).
import { execFileSync } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";

const SQLITE_SCHEMA = "prisma/schema.prisma";
const POSTGRES_DIR = "prisma/postgresql";
const POSTGRES_SCHEMA = `${POSTGRES_DIR}/schema.prisma`;
const MIGRATIONS = `${POSTGRES_DIR}/migrations`;
const SNAPSHOT = "schema.snapshot.prisma"; // schema de cada migração, para a próxima comparar sem banco
const ENV_FILE = ".env";
const PRISMA_CLI = createRequire(import.meta.url).resolve("prisma/build/index.js");

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

// .env sem sobrescrever o que veio da linha de comando.
function loadEnv() {
  if (!existsSync(ENV_FILE)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(ENV_FILE, "utf8")))) if (process.env[key] === undefined) process.env[key] = value;
}

const isPostgres = (url = process.env.DATABASE_URL ?? "") => /^postgres(ql)?:\/\//.test(url);

function prisma(args, options = {}) {
  return execFileSync(process.execPath, [PRISMA_CLI, ...args], { stdio: options.capture ? ["pipe", "pipe", "inherit"] : "inherit", input: options.input, env: process.env, encoding: "utf8" });
}

function writePostgresSchema() {
  const source = readFileSync(SQLITE_SCHEMA, "utf8");
  if (!source.includes('provider = "sqlite"')) fail(`${SQLITE_SCHEMA} não tem provider = "sqlite".`);
  const schema = `// GERADO por scripts/prisma-db.mjs a partir de prisma/schema.prisma: não edite aqui.\n${source.replace('provider = "sqlite"', 'provider = "postgresql"')}`;
  mkdirSync(POSTGRES_DIR, { recursive: true });
  if (!existsSync(POSTGRES_SCHEMA) || readFileSync(POSTGRES_SCHEMA, "utf8") !== schema) writeFileSync(POSTGRES_SCHEMA, schema);
}

function generate() {
  const postgres = isPostgres();
  if (postgres) writePostgresSchema();
  const schema = postgres ? POSTGRES_SCHEMA : SQLITE_SCHEMA;
  const generated = "node_modules/.prisma/client/schema.prisma";
  // O Prisma guarda o schema realinhado: compara sem os espaços de alinhamento.
  const plain = (file) => readFileSync(file, "utf8").replace(/[ \t]+/g, " ").replace(/ $/gm, "");
  if (existsSync(generated) && plain(generated) === plain(schema)) return;
  console.log(`Gerando o cliente do Prisma para ${postgres ? "PostgreSQL" : "SQLite"}…`);
  prisma(["generate", "--schema", schema]);
}

function tables() {
  generate();
  if (isPostgres()) prisma(["migrate", "deploy", "--schema", POSTGRES_SCHEMA]);
  else prisma(["db", "push", "--skip-generate", "--schema", SQLITE_SCHEMA]);
}

// Endereço do PostgreSQL a partir dos campos do .env, com usuário, senha e banco codificados.
function postgresUrl() {
  const get = (key) => (process.env[key] ?? "").trim();
  const missing = ["POSTGRES_HOST", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"].filter((key) => !get(key) || get(key).startsWith("preencha"));
  if (missing.length) fail(`Preencha no .env: ${missing.join(", ")}.`);
  const port = get("POSTGRES_PORT") || "5432";
  const schema = get("POSTGRES_SCHEMA") || "public";
  const ssl = ["sim", "true", "1", "require"].includes(get("POSTGRES_SSL").toLowerCase());
  const enc = encodeURIComponent;
  return `postgresql://${enc(get("POSTGRES_USER"))}:${enc(get("POSTGRES_PASSWORD"))}@${get("POSTGRES_HOST")}:${port}/${enc(get("POSTGRES_DB"))}?schema=${enc(schema)}${ssl ? "&sslmode=require" : ""}`;
}

// Troca o DATABASE_URL ativo do .env pelo do PostgreSQL; o do SQLite fica comentado para voltar.
function writeDatabaseUrl(url) {
  const lines = readFileSync(ENV_FILE, "utf8").split("\n");
  const index = lines.findIndex((line) => /^DATABASE_URL=/.test(line));
  const next = `DATABASE_URL="${url}"`;
  if (index === -1) lines.unshift(next);
  else if (isPostgres(lines[index].replace(/^DATABASE_URL=["']?/, ""))) lines[index] = next;
  else lines.splice(index, 1, `# ${lines[index]}   ← SQLite (desenvolvimento): descomente para voltar`, next);
  writeFileSync(ENV_FILE, lines.join("\n"));
}

// Sem criptografia até um servidor de fora, os dados dos estudantes trafegam abertos.
function warnIfPlainText(url) {
  const { hostname, searchParams } = new URL(url);
  if (searchParams.get("sslmode") === "disable" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) {
    console.warn(`\n⚠ A conexão com ${hostname} está sem criptografia (sslmode=disable). Antes de cadastrar estudantes, ligue o SSL no servidor ou deixe o banco na mesma máquina ou numa rede privada.\n`);
  }
}

function configure() {
  // Quem já colou o endereço completo no DATABASE_URL não precisa dos campos POSTGRES_*.
  const pasted = isPostgres() && !(process.env.POSTGRES_HOST ?? "").trim();
  const url = pasted ? process.env.DATABASE_URL : postgresUrl();
  process.env.DATABASE_URL = url;
  console.log("Testando a conexão com o PostgreSQL…");
  try {
    prisma(["db", "execute", "--url", url, "--stdin"], { capture: true, input: "SELECT 1;" });
  } catch {
    fail(pasted ? "Não deu para conectar com o DATABASE_URL do .env. Confira o endereço e se o servidor aceita conexões desta máquina." : "Não deu para conectar. Confira host, porta, banco, usuário, senha (entre aspas, se tiver #) e POSTGRES_SSL no .env, e se o servidor aceita conexões desta máquina.");
  }
  warnIfPlainText(url);
  if (pasted) console.log("Conexão ok, com o DATABASE_URL do .env.");
  else {
    writeDatabaseUrl(url);
    console.log("Conexão ok. DATABASE_URL do .env agora aponta para o PostgreSQL.");
  }
  tables();
  console.log("Carregando o catálogo de atividades e recursos…");
  execFileSync(process.execPath, ["prisma/seed-resources.mjs"], { stdio: "inherit", env: process.env });
  console.log("\n✓ Banco PostgreSQL pronto. Próximos passos:");
  console.log('  1. Primeira conta da Secretaria: npm run db:admin -- --nome "Seu nome" --email voce@municipio.gov.br');
  console.log("  2. Reinicie o servidor (npm run dev ou npm run build && npm start).");
}

function migration(name) {
  if (!name) fail('Dê um nome: npm run db:migracao -- nome-da-mudanca');
  writePostgresSchema();
  // A comparação é só entre schemas (sem conectar), mas o Prisma confere o formato do endereço.
  if (!isPostgres()) process.env.DATABASE_URL = "postgresql://usuario:senha@localhost:5432/incluiedu";
  const done = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : [];
  const last = done.at(-1);
  const from = last && existsSync(`${MIGRATIONS}/${last}/${SNAPSHOT}`) ? ["--from-schema-datamodel", `${MIGRATIONS}/${last}/${SNAPSHOT}`] : ["--from-empty"];
  const sql = prisma(["migrate", "diff", ...from, "--to-schema-datamodel", POSTGRES_SCHEMA, "--script"], { capture: true });
  if (/^-- This is an empty migration\.\s*$/.test(sql.trim())) return console.log("O schema não mudou desde a última migração.");
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const dir = `${MIGRATIONS}/${stamp}_${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/migration.sql`, sql);
  writeFileSync(`${dir}/${SNAPSHOT}`, readFileSync(POSTGRES_SCHEMA, "utf8"));
  if (!existsSync(`${MIGRATIONS}/migration_lock.toml`)) writeFileSync(`${MIGRATIONS}/migration_lock.toml`, 'provider = "postgresql"\n');
  console.log(`✓ Migração criada em ${dir}. Aplique com: npm run db:tabelas`);
}

async function admin(args) {
  const option = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? (args[index + 1] ?? "").trim() : "";
  };
  const name = option("--nome");
  const email = option("--email").toLowerCase();
  if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Informe nome e e-mail: npm run db:admin -- --nome "Seu nome" --email voce@municipio.gov.br');
  generate();
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) fail(`Já existe uma conta com ${email}.`);
    // Senha temporária legível (sem 0/O, 1/l): troca obrigatória no primeiro acesso.
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const password = [...randomBytes(14)].map((byte) => alphabet[byte % alphabet.length]).join("");
    const salt = randomBytes(16).toString("hex");
    const user = await db.user.create({
      data: { name, email, role: "secretaria", passwordHash: `${salt}:${scryptSync(password, salt, 32).toString("hex")}`, mustChangePassword: true },
    });
    await db.accountEvent.create({ data: { userId: user.id, actorName: "Configuração inicial", actorRole: "sistema", action: "criou", detail: "Primeira conta da Secretaria" } });
    console.log(`\n✓ Conta criada: ${name} <${email}>, perfil Secretaria.`);
    console.log(`  Senha temporária: ${password}`);
    console.log("  Ela é pedida para troca no primeiro acesso. Anote agora: não aparece de novo.\n");
  } finally {
    await db.$disconnect();
  }
}

loadEnv();
const [command, ...rest] = process.argv.slice(2);
if (command === "gerar") generate();
else if (command === "configurar") configure();
else if (command === "tabelas") tables();
else if (command === "migracao") migration(rest[0]);
else if (command === "admin") await admin(rest);
else fail("Comandos: gerar, configurar, tabelas, migracao <nome>, admin --nome … --email …");
