import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECOVERY_CODE_USED_HREF, activitiesBatchHref, caseStudyHref, censusAppliedHref, healthReportsHref, levelsHref, materialCreatedHref, param, profileSavedHref,
  readActivitiesBatch, readCaseStudy, readCensusApplied, readHealthReportNotice, readLevelsBatch, readMaterialCreated, readProfileSaved, readRecoveryCodeUsed,
} from "./search-params.ts";

const parse = (href) => {
  const url = new URL(href, "http://localhost");
  const query = {};
  for (const [key, value] of url.searchParams) query[key] = key in query ? [].concat(query[key], value) : value;
  return { path: url.pathname, hash: url.hash, query };
};

test("o endereço que a ação monta é o que a página lê", () => {
  for (const created of [{ source: "ia", images: 3, failed: true }, { source: "regras", images: null, failed: false }, { source: "ia", images: 0, failed: false }]) {
    assert.deepEqual(readMaterialCreated(parse(materialCreatedHref("/estudantes/e1/materiais/m1", created)).query), created);
  }
  assert.deepEqual(parse(activitiesBatchHref(4)), { path: "/estudantes", hash: "", query: { lote: "4" } });
  assert.equal(readActivitiesBatch(parse(activitiesBatchHref(4)).query), 4);
  assert.equal(readLevelsBatch(parse(levelsHref("p1", "lote-9")).query), "lote-9");
  assert.equal(parse(levelsHref("p1")).path, "/planejamento/p1/niveis");
  assert.deepEqual(readCensusApplied(parse(censusAppliedHref("s1", 2, 5)).query), { created: 2, updated: 5 });
  assert.ok(readProfileSaved(parse(profileSavedHref("e1")).query));
  const caseStudy = parse(caseStudyHref("e1", { notice: "concluido", editing: true, hash: "#aprofundar" }));
  assert.deepEqual([caseStudy.path, caseStudy.hash], ["/estudantes/e1/estudo-de-caso", "#aprofundar"]);
  assert.deepEqual(readCaseStudy(caseStudy.query), { editing: true, saved: false, concluded: true, missingAee: false });
  assert.equal(readHealthReportNotice(parse(healthReportsHref("e1", "r1", "revisado")).query, "revisado"), true);
  assert.equal(parse(healthReportsHref("e1")).path, "/estudantes/e1/estudo-de-caso/laudos");
  assert.equal(readRecoveryCodeUsed(parse(RECOVERY_CODE_USED_HREF).query), true);
});

test("parâmetro repetido vale o primeiro; valor fora do formato não vira aviso", () => {
  assert.equal(param(["1", "2"]), "1");
  assert.equal(param(undefined), "");
  assert.equal(readMaterialCreated({ criado: "outro" }), null);
  assert.equal(readMaterialCreated({ criado: "ia", imagens: "-1" }).images, null);
  assert.equal(readActivitiesBatch({ lote: "3x" }), null);
  assert.equal(readCensusApplied({ aplicado: "2-x" }), null);
  assert.equal(readProfileSaved({ salvo: "<script>" }), null);
  assert.deepEqual(readCaseStudy({}), { editing: false, saved: false, concluded: false, missingAee: false });
  assert.equal(readRecoveryCodeUsed({ aviso: ["recuperacao", "x"] }), true);
});
