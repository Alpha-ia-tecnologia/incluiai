import { isPostgresUrl, normalizeDomain } from "./tenancy-core.ts";

const text = (value: string | undefined) => value?.trim() || null;
// As chaves de exemplo do .env ("sk-ant-...") contam como ausentes.
const apiKey = (value: string | undefined) => {
  const key = text(value);
  return key && !key.includes("...") ? key : null;
};
const baseUrl = (value: string | undefined, fallback: string) => (text(value) ?? fallback).replace(/\/+$/, "");

function read() {
  const env = process.env;
  const production = env.NODE_ENV === "production";
  const smtpUrl = text(env.SMTP_URL);
  const emailFrom = text(env.EMAIL_FROM);
  const anthropicKey = apiKey(env.ANTHROPIC_API_KEY);
  const claudeModel = text(env.ANTHROPIC_MODEL) ?? "claude-opus-5-5";
  return {
    production,
    postgres: isPostgresUrl(env.DATABASE_URL ?? ""),
    platformDomain: normalizeDomain(env.PLATFORM_DOMAIN),
    municipalityDatabaseTemplate: env.MUNICIPIO_DATABASE_URL ?? "",
    appUrl: text(env.APP_URL)?.replace(/\/+$/, "") ?? null,
    networkName: text(env.NETWORK_NAME),
    requireTwoFactor: env.REQUIRE_2FA === "1",
    secureCookies: env.SESSION_COOKIE_SECURE ? env.SESSION_COOKIE_SECURE === "1" : production,
    censusMonitor: env.CENSUS_MONITOR !== "0",
    email: smtpUrl && emailFrom ? { smtpUrl, from: emailFrom } : null,
    claude: { apiKey: anthropicKey, model: claudeModel, assistantModel: text(env.ASSISTANT_MODEL) ?? claudeModel },
    deepseek: {
      apiKey: apiKey(env.DEEPSEEK_API_KEY),
      enabled: env.DEEPSEEK_ENABLED === "1",
      model: text(env.DEEPSEEK_MODEL) ?? "deepseek-flash",
      baseUrl: baseUrl(env.DEEPSEEK_BASE_URL, "https://api.deepseek.com"),
    },
    openai: {
      apiKey: apiKey(env.OPENAI_API_KEY),
      imageModel: text(env.OPENAI_IMAGE_MODEL) ?? "gpt-image-2.5-flare",
      baseUrl: baseUrl(env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
    },
  };
}

type EnvConfig = ReturnType<typeof read>;
let loaded: EnvConfig | null = null;
const config = () => (loaded ??= read());

export const isProduction = () => config().production;
export const usesPostgres = () => config().postgres;
export const platformDomain = () => config().platformDomain;
export const municipalityDatabaseTemplate = () => config().municipalityDatabaseTemplate;
export const configuredAppUrl = () => config().appUrl;
export const configuredNetworkName = () => config().networkName;
export const requireTwoFactor = () => config().requireTwoFactor;
export const secureCookies = () => config().secureCookies;
export const censusMonitorOn = () => config().censusMonitor;
export const emailSettings = () => config().email;
export const claudeSettings = () => config().claude;
export const deepseekSettings = () => config().deepseek;
export const openaiSettings = () => config().openai;
