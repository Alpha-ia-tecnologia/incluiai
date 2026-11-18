import { test } from "node:test";
import assert from "node:assert/strict";
import { profileFromForm } from "./functional-profile.ts";
import { UserError } from "./user-error.ts";

const formOf = (entries) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return [(name) => data.get(name), (name) => data.getAll(name)];
};

test("Como aprende: listas, sensorial típico por padrão e os níveis de apoio", () => {
  const profile = profileFromForm(...formOf([
    ["interests", "Dinossauros, música; trens"], ["triggers", "Barulho alto"], ["sens_visual", "hiper"], ["readingSupport", "3"],
    ["barriers", "comunicacional"], ["barriers", "pedagogica"], ["usesWheelchairOrOrthosis", "on"], ["strengths", "  "],
  ]));
  assert.equal(profile.interests, JSON.stringify(["Dinossauros", "música", "trens"]));
  assert.equal(profile.triggers, JSON.stringify(["Barulho alto"]));
  assert.equal(profile.earlySigns, "[]");
  assert.deepEqual(JSON.parse(profile.sensoryProfile), { auditiva: "tipica", visual: "hiper", tatil: "tipica", vestibular: "tipica", proprioceptiva: "tipica" });
  assert.equal(profile.readingSupport, 3);
  assert.equal(profile.grossMotor, 0);
  assert.equal(profile.barriers, JSON.stringify(["comunicacional", "pedagogica"]));
  assert.equal(profile.usesWheelchairOrOrthosis, true);
  assert.equal(profile.strengths, null);
  assert.equal(profile.expressiveChannel, "fala");
});

test("Como aprende: sem interesse âncora ou com apoio fora da escala, a pessoa é avisada", () => {
  assert.throws(() => profileFromForm(...formOf([["interests", " , "]])), (error) => error instanceof UserError && /interesse âncora/.test(error.message));
  assert.throws(() => profileFromForm(...formOf([["interests", "Música"], ["mathSupport", "6"]])), (error) => error instanceof UserError && /entre 0 e 5/.test(error.message));
  assert.throws(() => profileFromForm(...formOf([["interests", "Música"], ["mathSupport", "1.5"]])), (error) => error instanceof UserError);
});
