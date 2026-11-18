import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "./prompt.ts";
import { toolNames } from "./catalog.ts";
import { MATERIAL_ACTIVITIES } from "../pedagogy-rules.ts";

const ROLE_OF_GROUP = { professor: "professor_aee", escola: "coordenacao", rede: "secretaria", familia: "familia", terapeuta: "terapeuta" };
const ALL_TOOLS = [...new Set(Object.keys(ROLE_OF_GROUP).flatMap(toolNames))];
const mentions = (text, name) => new RegExp(`(^|[^a-z_])${name}([^a-z_]|$)`).test(text);

test("o prompt de cada grupo é o comum com as suas ferramentas, e só elas, antes do formato", () => {
  const common = buildSystemPrompt("plataforma");
  const cut = common.indexOf("\n\nFormato das respostas:");
  assert.ok(cut > 0);
  const [head, tail] = [common.slice(0, cut), common.slice(cut)];
  for (const [group, role] of Object.entries(ROLE_OF_GROUP)) {
    const prompt = buildSystemPrompt(role);
    assert.ok(prompt.startsWith(head) && prompt.endsWith(tail), group);
    const section = prompt.slice(head.length, prompt.length - tail.length);
    for (const name of ALL_TOOLS) assert.equal(mentions(section, name), toolNames(group).includes(name), `${group}: ${name}`);
  }
  assert.match(buildSystemPrompt("professor_aee"), new RegExp(`${MATERIAL_ACTIVITIES.min} a ${MATERIAL_ACTIVITIES.max} atividades`));
});

test("papéis do mesmo grupo recebem o mesmo prompt", () => {
  assert.equal(buildSystemPrompt("professor_sala"), buildSystemPrompt("apoio"));
  assert.equal(buildSystemPrompt("professor_sala"), buildSystemPrompt("professor_aee"));
  assert.equal(buildSystemPrompt("gestao"), buildSystemPrompt("coordenacao"));
});
