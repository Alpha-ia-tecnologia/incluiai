import { test } from "node:test";
import assert from "node:assert/strict";
import { aiStatusText } from "./ai-status.ts";

const on = { claude: true, deepseek: false, openai: true };
const off = { claude: false, deepseek: false, openai: true };

test("situação da IA: quem configura vê os serviços", () => {
  assert.equal(aiStatusText(on, true), "Claude ativo, DeepSeek não configurado, OpenAI ativo (detalhes em /configuracao-ia)");
});

test("situação da IA: os outros perfis veem só ligada ou desligada, sem nome de serviço", () => {
  assert.equal(aiStatusText(on, false), "ligada");
  assert.equal(aiStatusText({ claude: false, deepseek: true, openai: false }, false), "ligada");
  assert.equal(aiStatusText(off, false), "desligada");
  for (const text of [aiStatusText(on, false), aiStatusText(off, false)]) assert.doesNotMatch(text, /Claude|DeepSeek|OpenAI/);
});
