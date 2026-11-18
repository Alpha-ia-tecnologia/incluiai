import { test } from "node:test";
import assert from "node:assert/strict";
import { AEE_SERVICE_OPTIONS, ASSESSMENT_ACCESSIBILITY_OPTIONS, PLAN_DOCUMENT_KEYS, censusDifferences, missingCount, missingPlanItems, planDefaultsFromCaseStudy, planDocumentsFromForm } from "./plan-documents.ts";
import { AEE_SERVICE_LABELS, ASSESSMENT_RESOURCE_LABELS } from "./educacenso.ts";
import { CENSUS_RULES, FEDERAL_SOURCE_LINE, INEP_CENSUS_GUIDANCE, censusReference, specialEducationAnswer } from "./federal-guidance.ts";

test("formulário: vazio vira null, texto é aparado e limitado", () => {
  const form = new Map([["aeeTeacher", "  Ana Souza "], ["monitoring", ""], ["familyFeedback", "x".repeat(900)]]);
  const docs = planDocumentsFromForm((name) => form.get(name));
  assert.deepEqual(Object.keys(docs), [...PLAN_DOCUMENT_KEYS]);
  assert.equal(docs.aeeTeacher, "Ana Souza");
  assert.equal(docs.monitoring, null);
  assert.equal(docs.regularTeacher, null);
  assert.equal(docs.familyFeedback.length, 600);
});

test("o que falta: conteúdo mínimo e autoria (o estudante não entra na conta)", () => {
  const missing = missingPlanItems({ aeeTeacher: "Ana", participants: "O próprio estudante", accessibilityResources: "Lupa", aeeStrategies: "CAA" });
  assert.deepEqual(missing.paee.map((item) => item.key), ["assistiveTech", "supportStaff", "networkDemands"]);
  assert.deepEqual(missing.pei.map((item) => item.key), ["aeeServices", "commonRoomStrategies", "assessmentAccessibility", "monitoring", "familyFeedback"]);
  assert.deepEqual(missing.authorship, ["professor(a) da classe comum", "participação da família"]);
  assert.equal(missingCount({}), 13);
  const full = Object.fromEntries(PLAN_DOCUMENT_KEYS.map((key) => [key, key === "participants" ? "Família" : "Registrado"]));
  assert.equal(missingCount(full), 0);
});

test("sugestões a partir do estudo de caso", () => {
  const defaults = planDefaultsFromCaseStudy({
    recursos: "AEE na sala de recursos; Profissional de apoio; Intérprete de Libras; Prancha de comunicação",
    encaminhamentos: "Avaliação auditiva; Rede de saúde; Conselho Tutelar",
    participantes: "Professor(a) do AEE; Família; O próprio estudante",
    necessidades: "Desenvolvimento da autonomia; Comunicação alternativa e aumentativa; Apoio à autorregulação; Ensino do cálculo no Soroban",
  }, "Ana Souza");
  assert.equal(defaults.aeeTeacher, "Ana Souza");
  assert.equal(defaults.supportStaff, "Profissional de apoio escolar; Tradutor e intérprete de Libras");
  assert.equal(defaults.assistiveTech, "Prancha de comunicação");
  assert.equal(defaults.networkDemands, "Rede de saúde; Conselho Tutelar");
  assert.equal(defaults.participants, "Família; O próprio estudante");
  assert.equal(defaults.aeeServices, "Desenvolvimento de vida autônoma; Ensino do cálculo no Soroban; Comunicação alternativa e aumentativa (CAA)");
  assert.equal(defaults.assessmentAccessibility, "Tradutor-intérprete de Libras");
  assert.deepEqual(planDefaultsFromCaseStudy({}), { aeeTeacher: null, participants: null, assistiveTech: null, supportStaff: null, networkDemands: null, aeeServices: null, assessmentAccessibility: null });
});

test("Censo: um registro de referência basta, e o laudo não entra", () => {
  const concluded = (publicoAlvo) => ({ status: "concluido", content: publicoAlvo ? { publicoAlvo } : {} });
  assert.deepEqual(censusReference(null, false), { backed: false, records: [], pending: null });
  assert.deepEqual(censusReference(concluded(), false), { backed: true, records: ["Estudo de caso"], pending: null });
  assert.deepEqual(censusReference(concluded(), true), { backed: true, records: ["Estudo de caso", "PAEE", "PEI"], pending: null });
  assert.equal(specialEducationAnswer("Sim: estudante com deficiência"), "sim");
  assert.equal(specialEducationAnswer("Em avaliação pela equipe"), "em_avaliacao");
  assert.equal(specialEducationAnswer("Não é público do AEE: acompanhar na sala comum"), "nao");
  assert.equal(specialEducationAnswer(undefined), null);
  assert.deepEqual(censusReference(concluded("Sim: estudante com deficiência"), false).records, ["Estudo de caso"]);
  const evaluating = censusReference(concluded("Em avaliação pela equipe"), false);
  assert.equal(evaluating.backed, false);
  assert.match(evaluating.pending, /ainda avalia/);
  const notPublic = censusReference(concluded("Não é público do AEE: acompanhar na sala comum"), false);
  assert.deepEqual([notPublic.backed, notPublic.records], [false, []]);
  assert.match(notPublic.pending, /não é público/);
  assert.deepEqual(censusReference(concluded("Em avaliação pela equipe"), true).records, ["PAEE", "PEI"]);
  assert.match(INEP_CENSUS_GUIDANCE.url, /^https:\/\/www\.gov\.br\/inep\//);
  assert.match(FEDERAL_SOURCE_LINE, /INEP\/MEC.*Decreto nº 12\.686\/2025.*Portaria MEC nº 421\/2026/);
  assert.ok(CENSUS_RULES.some((rule) => /Laudo médico não pode ser exigido/.test(rule)));
});

test("Educacenso: os nomes do plano são os do Censo", () => {
  assert.deepEqual(AEE_SERVICE_OPTIONS, AEE_SERVICE_LABELS);
  assert.equal(AEE_SERVICE_LABELS.length, 11);
  assert.equal(ASSESSMENT_RESOURCE_LABELS.length, 13);
  assert.deepEqual(ASSESSMENT_ACCESSIBILITY_OPTIONS.slice(0, 13), ASSESSMENT_RESOURCE_LABELS);
});

test("plano e Censo: aponta só a diferença que dá para conferir", () => {
  const plan = { aeeServices: "Desenvolvimento de vida autônoma; Comunicação alternativa e aumentativa (CAA)", assessmentAccessibility: "Auxílio ledor; Tempo adicional; Ambiente mais silencioso" };
  const same = { aee: true, services: ["Comunicação alternativa e aumentativa (CAA)", "Desenvolvimento de vida autônoma"], resources: ["Tempo adicional", "Auxílio ledor"] };
  assert.deepEqual(censusDifferences(plan, same), []);
  const other = censusDifferences(plan, { aee: true, services: ["Desenvolvimento de funções cognitivas"], resources: [] });
  assert.deepEqual(other.map((item) => [item.key, item.census]), [["aeeServices", ["Desenvolvimento de funções cognitivas"]], ["assessmentAccessibility", []]]);
  assert.deepEqual(other[1].plan, ["Auxílio ledor", "Tempo adicional"]);
  assert.deepEqual(censusDifferences({ assessmentAccessibility: "Nenhum recurso" }, { aee: true, services: [], resources: [] }), []);
  assert.deepEqual(censusDifferences(plan, null), []);
  assert.deepEqual(censusDifferences(plan, { aee: false, services: [] }), []);
  assert.deepEqual(censusDifferences({}, same), []);
});
