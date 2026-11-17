// Testes das regras de vários municípios: node --test src/lib/tenancy-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RESERVED_SLUGS, databaseNameFor, defaultNetworkName, existingDatabaseProblem, isPlatformPath, municipalityAddress,
  municipalityDatabaseUrl, normalizeDomain, parseHost, requestHost, routeRequest, slugProblem, sqliteFile, suggestSlug, templateProblem,
  NEW_DATABASE_PATTERN,
} from "./tenancy-core.ts";

test("domínio da plataforma: sem espaços, pontos nas pontas nem maiúsculas", () => {
  assert.equal(normalizeDomain(" IncluiEdu.com.br. "), "incluiedu.com.br");
  assert.equal(normalizeDomain(""), null);
  assert.equal(normalizeDomain(undefined), null);
});

test("host → área: admin, município ou página neutra", () => {
  const domain = "incluiedu.com.br";
  assert.deepEqual(parseHost("admin.incluiedu.com.br", domain), { kind: "plataforma" });
  assert.deepEqual(parseHost("ADMIN.IncluiEdu.com.br:443", domain), { kind: "plataforma" });
  assert.deepEqual(parseHost("sao-jose.incluiedu.com.br", domain), { kind: "municipio", slug: "sao-jose" });
  assert.deepEqual(parseHost("Sao-Jose.incluiedu.com.br.", domain), { kind: "municipio", slug: "sao-jose" });
  assert.deepEqual(parseHost("demo.localhost:3214", "localhost"), { kind: "municipio", slug: "demo" });
  for (const host of ["incluiedu.com.br", "www.incluiedu.com.br", "api.incluiedu.com.br", "a.b.incluiedu.com.br", "demo.outrosite.com.br", "localhost:3214", "127.0.0.1:3214", "[::1]:3214", "", null, "xx.incluiedu.com.br", "-demo.incluiedu.com.br", "demo.incluiedu.com.br.evil.com"]) {
    assert.deepEqual(parseHost(host, domain), { kind: "neutro" }, String(host));
  }
});

test("endereço do pedido: o x-forwarded-host vence o Host (redirect de ação e proxy reverso)", () => {
  const from = (values) => (name) => values[name] ?? null;
  assert.equal(requestHost(from({ host: "localhost:3214", "x-forwarded-host": "saojose.localhost:3214" })), "saojose.localhost:3214");
  assert.equal(requestHost(from({ host: "10.0.0.5:3000", "x-forwarded-host": "saojose.incluiedu.com.br, proxy.interno" })), "saojose.incluiedu.com.br");
  assert.equal(requestHost(from({ host: "saojose.localhost:3214" })), "saojose.localhost:3214");
  assert.equal(requestHost(from({ host: "saojose.localhost:3214", "x-forwarded-host": " " })), "saojose.localhost:3214");
  assert.equal(requestHost(from({})), null);
});

test("caminhos: o admin só abre o painel e o login; o município não abre o painel", () => {
  const admin = { kind: "plataforma" };
  const city = { kind: "municipio", slug: "demo" };
  assert.deepEqual(routeRequest(admin, "/plataforma"), { action: "seguir", area: admin });
  assert.deepEqual(routeRequest(admin, "/plataforma/municipios/demo"), { action: "seguir", area: admin });
  assert.deepEqual(routeRequest(admin, "/login/duas-etapas"), { action: "seguir", area: admin });
  for (const path of ["/", "/estudantes", "/api/bncc", "/plataformas", "/loginx", "/marca/logo"]) {
    assert.deepEqual(routeRequest(admin, path), { action: "redirecionar", path: "/plataforma" }, path);
  }
  assert.deepEqual(routeRequest(city, "/plataforma"), { action: "redirecionar", path: "/" });
  assert.deepEqual(routeRequest(city, "/plataforma/novo"), { action: "redirecionar", path: "/" });
  assert.deepEqual(routeRequest(city, "/estudantes"), { action: "seguir", area: city });
  assert.deepEqual(routeRequest(city, "/plataformas"), { action: "seguir", area: city });
  assert.deepEqual(routeRequest({ kind: "neutro" }, "/plataforma"), { action: "seguir", area: { kind: "neutro" } });
  assert.equal(isPlatformPath("/login"), true);
  assert.equal(isPlatformPath("/conta/seguranca"), false);
});

test("subdomínio: letras minúsculas, números e hífen, de 3 a 40, sem nomes reservados", () => {
  assert.equal(slugProblem("sao-jose"), null);
  assert.equal(slugProblem("abc"), null);
  assert.equal(slugProblem("a".repeat(40)), null);
  assert.match(slugProblem("ab"), /3 a 40/);
  assert.match(slugProblem("a".repeat(41)), /3 a 40/);
  assert.match(slugProblem("São-josé"), /minúsculas/);
  assert.match(slugProblem("sao_jose"), /minúsculas/);
  assert.match(slugProblem("sao.jose"), /minúsculas/);
  assert.match(slugProblem("-saojose"), /hífen/);
  assert.match(slugProblem("saojose-"), /hífen/);
  for (const reserved of ["admin", "www", "api", "app", "plataforma"]) assert.match(slugProblem(reserved), /reservado/);
  assert.deepEqual([...RESERVED_SLUGS].sort(), ["admin", "api", "app", "plataforma", "www"]);
});

test("subdomínio sugerido a partir do nome", () => {
  assert.equal(suggestSlug("São José dos Campos"), "sao-jose-dos-campos");
  assert.equal(suggestSlug("  Pau D'Alho  "), "pau-d-alho");
  assert.equal(suggestSlug("Itaú de Minas!"), "itau-de-minas");
  assert.equal(suggestSlug("Vila Bela da Santíssima Trindade do Norte Grande"), "vila-bela-da-santissima-trindade-do-nort");
  assert.equal(suggestSlug(`${"a".repeat(39)} bairro`), "a".repeat(39));
  assert.equal(slugProblem(suggestSlug("Vila Bela da Santíssima Trindade do Norte Grande")), null);
  assert.equal(suggestSlug("Lagoa Grande do Maranhãozinho - Distrito"), "lagoa-grande-do-maranhaozinho-distrito");
});

test("nome do banco novo: incluiedu_ + subdomínio, no formato aceito pelo SQL", () => {
  assert.equal(databaseNameFor("sao-jose"), "incluiedu_sao_jose");
  assert.match(databaseNameFor("a".repeat(40)), NEW_DATABASE_PATTERN);
  assert.ok(databaseNameFor("a".repeat(40)).length <= 63);
  for (const bad of ["incluiedu_", "incluiedu_ab", "incluiedu_x;drop", 'incluiedu_a"b', "outro_banco", "incluiedu_Maiuscula"]) {
    assert.equal(NEW_DATABASE_PATTERN.test(bad), false, bad);
  }
});

test("banco já existente: só nomes seguros para o endereço", () => {
  assert.equal(existingDatabaseProblem("dev"), null);
  assert.equal(existingDatabaseProblem("incluiedu"), null);
  assert.equal(existingDatabaseProblem("incluiedu-prod_2"), null);
  for (const bad of ["", "../dev", "dev.db", "a/b", "a b", "1banco", "x?sslmode=disable", "a".repeat(64)]) {
    assert.ok(existingDatabaseProblem(bad), bad);
  }
});

test("endereço do banco do município a partir do modelo com {banco}", () => {
  assert.match(templateProblem(""), /MUNICIPIO_DATABASE_URL/);
  assert.match(templateProblem("postgresql://u:s@h:5432/fixo"), /\{banco\}/);
  assert.equal(templateProblem("file:./municipios/{banco}.db"), null);
  assert.equal(municipalityDatabaseUrl("file:./municipios/{banco}.db", "incluiedu_demo"), "file:./municipios/incluiedu_demo.db");
  assert.equal(municipalityDatabaseUrl("file:./municipios/{banco}.db", "incluiedu_demo", 5), "file:./municipios/incluiedu_demo.db");
  assert.equal(
    municipalityDatabaseUrl("postgresql://u:p%40ss@db:5432/{banco}?sslmode=require", "incluiedu_demo", 5),
    "postgresql://u:p%40ss@db:5432/incluiedu_demo?sslmode=require&connection_limit=5",
  );
  assert.equal(municipalityDatabaseUrl("postgres://u:s@db/{banco}", "incluiedu_demo", 3), "postgres://u:s@db/incluiedu_demo?connection_limit=3");
  assert.equal(municipalityDatabaseUrl("postgresql://u:s@db/{banco}?connection_limit=9", "incluiedu_demo", 3), "postgresql://u:s@db/incluiedu_demo?connection_limit=9");
  assert.throws(() => municipalityDatabaseUrl("file:./municipios/{banco}.db", "../plataforma"), /inválido/);
  assert.throws(() => municipalityDatabaseUrl("file:./fixo.db", "incluiedu_demo"), /\{banco\}/);
});

test("arquivo do SQLite", () => {
  assert.equal(sqliteFile("file:./municipios/incluiedu_demo.db"), "./municipios/incluiedu_demo.db");
  assert.equal(sqliteFile("file:./dev.db?connection_limit=1"), "./dev.db");
  assert.equal(sqliteFile("postgresql://u:s@h/db"), null);
});

test("endereço público do município, com a porta do pedido", () => {
  assert.equal(municipalityAddress("demo", "localhost", "admin.localhost:3214", "http"), "http://demo.localhost:3214");
  assert.equal(municipalityAddress("sao-jose", "incluiedu.com.br", "admin.incluiedu.com.br", "https"), "https://sao-jose.incluiedu.com.br");
  assert.equal(municipalityAddress("sao-jose", "incluiedu.com.br", null, "https"), "https://sao-jose.incluiedu.com.br");
});

test("nome da rede sugerido", () => {
  assert.equal(defaultNetworkName(" Itaú de Minas "), "Secretaria Municipal de Educação de Itaú de Minas");
});

test("cadastro do município: o que precisa estar certo para criar e para editar", async () => {
  const { municipalityProblem } = await import("./tenancy-core.ts");
  const ok = { name: "Itaú de Minas", uf: "MG", networkName: "Secretaria Municipal de Educação de Itaú de Minas", slug: "itau-de-minas", adminName: "Ana Souza", adminEmail: "ana@itau.mg.gov.br", existingDatabase: false, dbName: "" };
  assert.equal(municipalityProblem(ok, true), null);
  assert.match(municipalityProblem({ ...ok, name: "" }, true), /nome do município/);
  assert.match(municipalityProblem({ ...ok, uf: "XX" }, true), /UF/);
  assert.match(municipalityProblem({ ...ok, networkName: "SME" }, true), /rede de ensino/);
  assert.match(municipalityProblem({ ...ok, slug: "www" }, true), /reservado/);
  assert.match(municipalityProblem({ ...ok, adminName: "" }, true), /primeira conta/);
  assert.match(municipalityProblem({ ...ok, adminEmail: "ana" }, true), /e-mail válido/);
  // Banco já existente: a conta da Secretaria é opcional (o banco pode já ter contas).
  assert.equal(municipalityProblem({ ...ok, existingDatabase: true, dbName: "incluiedu", adminName: "", adminEmail: "" }, true), null);
  assert.match(municipalityProblem({ ...ok, existingDatabase: true, dbName: "../x" }, true), /banco inválido/);
  assert.match(municipalityProblem({ ...ok, existingDatabase: true, dbName: "incluiedu", adminName: "", adminEmail: "ana@x.br" }, true), /primeira conta/);
  // Editar não confere endereço nem conta.
  assert.equal(municipalityProblem({ ...ok, slug: "", adminName: "", adminEmail: "" }, false), null);
});
