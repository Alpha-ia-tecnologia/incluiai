import { test } from "node:test";
import assert from "node:assert/strict";

const KEYS = ["NODE_ENV", "DATABASE_URL", "PLATFORM_DOMAIN", "APP_URL", "SESSION_COOKIE_SECURE", "CENSUS_MONITOR", "SMTP_URL", "EMAIL_FROM", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "ASSISTANT_MODEL", "DEEPSEEK_BASE_URL"];
let instance = 0;

async function configWith(env) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
  try {
    const config = await import(`./env-config.ts?caso=${instance++}`);
    return {
      production: config.isProduction(), postgres: config.usesPostgres(), domain: config.platformDomain(), appUrl: config.configuredAppUrl(),
      secure: config.secureCookies(), census: config.censusMonitorOn(), email: config.emailSettings(), claude: config.claudeSettings(), deepseek: config.deepseekSettings(),
    };
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("chave de exemplo do .env ou em branco conta como ausente", async () => {
  assert.equal((await configWith({ ANTHROPIC_API_KEY: "sk-ant-..." })).claude.apiKey, null);
  assert.equal((await configWith({ ANTHROPIC_API_KEY: "   " })).claude.apiKey, null);
  assert.equal((await configWith({ ANTHROPIC_API_KEY: " sk-ant-chave " })).claude.apiKey, "sk-ant-chave");
});

test("e-mail só com servidor e remetente", async () => {
  assert.equal((await configWith({ SMTP_URL: "smtp://localhost" })).email, null);
  assert.deepEqual((await configWith({ SMTP_URL: "smtp://localhost", EMAIL_FROM: "IncluiEdu <nao-responda@municipio.gov.br>" })).email, { smtpUrl: "smtp://localhost", from: "IncluiEdu <nao-responda@municipio.gov.br>" });
});

test("cookie seguro em produção, salvo pedido explícito; verificação do Censo ligada, salvo CENSUS_MONITOR=0", async () => {
  assert.equal((await configWith({ NODE_ENV: "production" })).secure, true);
  assert.equal((await configWith({ NODE_ENV: "production", SESSION_COOKIE_SECURE: "0" })).secure, false);
  assert.equal((await configWith({ NODE_ENV: "development" })).secure, false);
  assert.equal((await configWith({ SESSION_COOKIE_SECURE: "1" })).secure, true);
  assert.equal((await configWith({})).census, true);
  assert.equal((await configWith({ CENSUS_MONITOR: "0" })).census, false);
});

test("endereços sem barra no fim, domínio normalizado, Postgres pelo endereço do banco e modelo do assistente pelo da IA", async () => {
  const config = await configWith({
    APP_URL: "https://incluiedu.municipio.gov.br/", PLATFORM_DOMAIN: " IncluiEdu.com.br. ", DATABASE_URL: "postgresql://u:s@db:5432/incluiedu",
    DEEPSEEK_BASE_URL: "https://proxy.interno/v1/", ANTHROPIC_MODEL: "modelo-da-rede",
  });
  assert.equal(config.appUrl, "https://incluiedu.municipio.gov.br");
  assert.equal(config.domain, "incluiedu.com.br");
  assert.equal(config.postgres, true);
  assert.equal(config.deepseek.baseUrl, "https://proxy.interno/v1");
  assert.equal(config.claude.assistantModel, "modelo-da-rede");
  assert.equal((await configWith({ DATABASE_URL: "file:./dev.db" })).postgres, false);
});
