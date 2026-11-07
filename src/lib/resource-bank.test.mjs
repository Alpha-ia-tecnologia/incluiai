import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DEMO_RESOURCE_USAGE, RESOURCE_CATALOG } from "../../prisma/resource-catalog.mjs";
import {
  COMPLEXITY_LABELS,
  RESOURCE_PRESENTATIONS,
  RESOURCE_TYPES,
  normalizeSearch,
  resourcePresentation,
  resourceTypeLabel,
} from "./resource-bank.ts";

const originalResources = new Map([
  ["Rotina visual de chegada", { counters: [34, 29], activities: ["Cheguei e organizei", "Monitor da rotina da turma"] }],
  ["Prancha de comunicação: rotina escolar", { counters: [27, 24], activities: ["Pedidos funcionais durante a aula", "Repórter das escolhas"] }],
  ["Ditado com corpus de interesse", { counters: [18, 16], activities: ["Ditado temático graduado", "Legenda colaborativa"] }],
  ["Configuração de varredura por acionador", { counters: [6, 6], activities: ["Calibrar tempo de varredura", "Quiz acessível da turma"] }],
  ["História social: troca de professor", { counters: [12, 9], activities: ["Conhecer a mudança com antecedência", "Mapa de apoio para o primeiro dia"] }],
  ["Transições sem sino: avisos visuais", { counters: [8, 8], activities: ["Transição com contagem visual", "Auditoria sensorial da rotina"] }],
]);

const stages = ["educacao_infantil", "anos_iniciais", "anos_finais", "ensino_medio", "eja"];
const contexts = ["sala_comum", "aee", "casa"];
const activities = RESOURCE_CATALOG.flatMap((resource) => resource.activities);

function stringList(serialized, { minimum, maximum, label }) {
  const list = JSON.parse(serialized);
  assert.ok(Array.isArray(list), `${label}: lista JSON`);
  assert.ok(list.length >= minimum && list.length <= maximum, `${label}: quantidade de itens`);
  assert.ok(list.every((item) => typeof item === "string" && item.trim() === item && item.length >= 8), `${label}: instruções preenchidas`);
  assert.equal(new Set(list).size, list.length, `${label}: sem instruções duplicadas`);
  return list;
}

test("banco tem 24 recursos e 72 atividades, sem títulos que colidam no upsert", () => {
  assert.equal(RESOURCE_CATALOG.length, 24);
  assert.equal(activities.length, 72);
  assert.equal(new Set(RESOURCE_CATALOG.map((resource) => resource.title)).size, 24);
  for (const resource of RESOURCE_CATALOG) {
    assert.ok(resource.title.trim() && resource.description.length >= 80, resource.title);
    assert.equal(resource.activities.length, 3, resource.title);
    assert.equal(new Set(resource.activities.map((activity) => activity.title)).size, 3, resource.title);
    assert.ok(resource.activities.every((activity) => activity.title.trim() === activity.title && activity.title.length > 5));
  }
});

test("metadados do banco abrangem as cinco etapas e os três contextos com opções válidas", () => {
  assert.deepEqual(new Set(RESOURCE_CATALOG.map((resource) => resource.stage)), new Set(stages));
  assert.deepEqual(new Set(activities.map((activity) => activity.context)), new Set(contexts));
  for (const resource of RESOURCE_CATALOG) {
    assert.ok(stages.includes(resource.stage), resource.title);
    assert.ok(Object.hasOwn(RESOURCE_TYPES, resource.resourceType), resource.title);
    assert.ok(Object.hasOwn(COMPLEXITY_LABELS, resource.complexity), resource.title);
    assert.ok(resource.skillArea.trim() && resource.accessibilityNeed.trim(), resource.title);
    for (const activity of resource.activities) {
      assert.ok(contexts.includes(activity.context), activity.title);
      assert.ok(Number.isInteger(activity.durationMinutes) && activity.durationMinutes >= 5 && activity.durationMinutes <= 60, activity.title);
      assert.ok(activity.objective.length >= 40 && activity.evidenceCriterion.length >= 40, activity.title);
    }
  }
});

test("cada proposta contém materiais, cinco a sete passos e três a quatro adaptações legíveis", () => {
  for (const activity of activities) {
    stringList(activity.materials, { minimum: 2, maximum: 8, label: `${activity.title}: materiais` });
    stringList(activity.steps, { minimum: 5, maximum: 7, label: `${activity.title}: passos` });
    stringList(activity.adaptations, { minimum: 3, maximum: 4, label: `${activity.title}: adaptações` });
  }
});

// O catálogo começa sem uso; os números da demonstração ficam em DEMO_RESOURCE_USAGE (seed.mjs).
test("identidade dos seis recursos e doze propostas originais permanece estável e todos começam sem uso", () => {
  for (const [title, expected] of originalResources) {
    const resource = RESOURCE_CATALOG.find((entry) => entry.title === title);
    assert.ok(resource, title);
    assert.deepEqual([resource.timesUsed ?? 0, resource.positiveOutcomes ?? 0], [0, 0], title);
    assert.deepEqual(DEMO_RESOURCE_USAGE[title], expected.counters, title);
    for (const activityTitle of expected.activities) {
      assert.ok(resource.activities.some((activity) => activity.title === activityTitle), activityTitle);
    }
  }
  const newResources = RESOURCE_CATALOG.filter((resource) => !originalResources.has(resource.title));
  assert.equal(newResources.length, 18);
  for (const resource of newResources) {
    assert.equal(resource.timesUsed, 0, resource.title);
    assert.equal(resource.positiveOutcomes, 0, resource.title);
  }
  // O seed usa este objeto no update do upsert: omitir os campos impede zerar o histórico existente.
  for (const activity of activities) {
    assert.ok(!Object.hasOwn(activity, "timesUsed"), activity.title);
    assert.ok(!Object.hasOwn(activity, "positiveOutcomes"), activity.title);
    assert.ok(!Object.hasOwn(activity, "id") && !Object.hasOwn(activity, "resourceId"), activity.title);
  }
});

test("todo recurso tem capa local, preparação e material-modelo completos", async () => {
  assert.deepEqual(new Set(Object.keys(RESOURCE_PRESENTATIONS)), new Set(RESOURCE_CATALOG.map((resource) => resource.title)));
  const altsByImage = new Map();
  for (const resource of RESOURCE_CATALOG) {
    const presentation = resourcePresentation(resource);
    assert.match(presentation.image, /^\/images\/activities\/[a-z-]+\.webp$/, resource.title);
    assert.ok(presentation.imageAlt.length >= 40, resource.title);
    assert.ok(presentation.preparation.length >= 2 && presentation.preparation.length <= 3, resource.title);
    assert.ok(presentation.preparation.every((item) => typeof item === "string" && item.length > 20), resource.title);
    assert.ok(presentation.extension.length >= 40, resource.title);
    assert.ok(presentation.model.title && presentation.model.instruction.length >= 40, resource.title);
    assert.ok(presentation.model.items.length >= 3 && presentation.model.items.length <= 8, resource.title);
    assert.ok(presentation.model.items.every((item) => typeof item === "string" && item.trim()), resource.title);
    assert.equal(presentation.supportLevels.length, 3, resource.title);
    assert.ok(presentation.supportLevels.every((support) => support.label && support.description.length >= 40));
    if (altsByImage.has(presentation.image)) {
      assert.equal(presentation.imageAlt, altsByImage.get(presentation.image), "a mesma fotografia conserva a descrição factual");
    }
    altsByImage.set(presentation.image, presentation.imageAlt);
  }
  assert.equal(altsByImage.size, 12);
  for (const image of altsByImage.keys()) {
    const file = await readFile(new URL(`../../public${image}`, import.meta.url));
    assert.equal(file.subarray(0, 4).toString("ascii"), "RIFF", image);
    assert.equal(file.subarray(8, 12).toString("ascii"), "WEBP", image);
  }
});

test("busca ignora acentos, maiúsculas e variações de espaço sem perder o conteúdo", () => {
  assert.equal(normalizeSearch("  Comunicação   e\tAUTONOMIA \n"), "comunicacao e autonomia");
  assert.equal(normalizeSearch("subtração"), normalizeSearch("SUBTRAÇÃO"));
  assert.ok(normalizeSearch("Minha escolha: não quero").includes(normalizeSearch("NÃO QUERO")));
  assert.equal(normalizeSearch(""), "");
});

test("recursos cadastrados depois do catálogo recebem apresentação e rótulos de reserva seguros", () => {
  for (const title of ["Proposta criada pela escola", "constructor", "__proto__"]) {
    const presentation = resourcePresentation({ title, skillArea: "Leitura", resourceType: "novo_tipo" });
    assert.equal(presentation.image, "/images/activities/collaboration.webp");
    assert.ok(presentation.model.items.includes("Área de trabalho: Leitura"));
    assert.equal(presentation.preparation.length, 2);
  }
  assert.equal(resourceTypeLabel("caa"), "Comunicação alternativa");
  assert.equal(resourceTypeLabel("novo_tipo"), "novo tipo");
  assert.equal(resourceTypeLabel("constructor"), "constructor");
});
