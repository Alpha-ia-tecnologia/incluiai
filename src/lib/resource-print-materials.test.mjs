import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { RESOURCE_CATALOG } from "../../prisma/resource-catalog.mjs";
import { RESOURCE_PRINT_CATALOG, activityPrintMaterials } from "./resource-print-materials.ts";

const key = (resource, activity) => `${resource}\n${activity}`;

test("as 72 propostas possuem materiais próprios, sem recorrer à capa ou ao modelo genérico", () => {
  const expected = RESOURCE_CATALOG.flatMap((resource) => resource.activities.map((activity) => key(resource.title, activity.title)));
  const actual = RESOURCE_PRINT_CATALOG.map((pack) => key(pack.resourceTitle, pack.activityTitle));
  assert.equal(actual.length, 72);
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual(new Set(actual), new Set(expected));
  for (const pack of RESOURCE_PRINT_CATALOG) {
    assert.equal(activityPrintMaterials(pack.resourceTitle, pack.activityTitle), pack.sheets);
    assert.ok(pack.sheets.length >= 1 && pack.sheets.length <= 3, pack.activityTitle);
    for (const sheet of pack.sheets) {
      assert.ok(sheet.title.trim() && sheet.instruction.trim(), pack.activityTitle);
      if (sheet.kind === "cards") {
        assert.ok(sheet.cards.length > 0, pack.activityTitle);
        for (const card of sheet.cards) {
          assert.ok(card.label.trim(), pack.activityTitle);
          const visuals = [card.image, card.quantity !== undefined, card.shape, card.blank].filter(Boolean);
          assert.ok(visuals.length <= 1, `${pack.activityTitle}: um visual inequívoco por cartão`);
          if (card.image) {
            assert.match(card.image, /^\/images\/(games\/|activities\/cards\/)/);
            assert.ok(card.alt?.trim(), `${pack.activityTitle}: descrição da fotografia`);
          }
          if (card.quantity !== undefined) assert.ok(Number.isInteger(card.quantity) && card.quantity >= 0 && card.quantity <= 12);
        }
      } else if (sheet.kind === "worksheet") {
        assert.ok(sheet.fields.length > 0);
        assert.ok(sheet.fields.every((field) => field.label.trim() && [1, 2, 3].includes(field.lines ?? 2)));
      } else if (sheet.kind === "table") {
        assert.ok(sheet.columns.length >= 2 && sheet.rows.length > 0);
        assert.ok(sheet.rows.every((row) => row.length === sheet.columns.length));
      } else if (sheet.kind === "map") {
        assert.equal(sheet.places.length, 3);
        assert.ok(sheet.route.length > 0);
      } else {
        assert.ok(sheet.paragraphs.length > 0 && sheet.paragraphs.every((paragraph) => paragraph.trim()));
      }
    }
  }
});

test("todas as fotografias dos cartões existem no projeto como imagens WebP", async () => {
  const files = new Set(RESOURCE_PRINT_CATALOG.flatMap((pack) => pack.sheets.flatMap((sheet) => sheet.kind === "cards" ? sheet.cards.flatMap((card) => card.image ? [card.image] : []) : [])));
  assert.ok(files.size >= 15, "materiais com fotografias de diferentes objetos e cenas");
  for (const path of files) {
    const file = await readFile(new URL(`../../public${path}`, import.meta.url));
    assert.equal(file.subarray(0, 4).toString("ascii"), "RIFF", path);
    assert.equal(file.subarray(8, 12).toString("ascii"), "WEBP", path);
  }
});

test("recursos criados pela escola recebem ficha para personalizar sem inventar fotos pessoais", () => {
  const sheets = activityPrintMaterials("Recurso da escola", "Proposta personalizada");
  assert.equal(sheets[0].kind, "worksheet");
  assert.equal(sheets[0].title, "Proposta personalizada");
  assert.ok(sheets[0].fields.some((field) => field.label.includes("imagens")));
});
