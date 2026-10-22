// Testes do contato com a família: node --test src/lib/family-contact.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCheckIn, noticeEmail, noticeTitle, weekStart } from "./family-contact.ts";

test("semana pela segunda-feira, no horário de Brasília", () => {
  assert.equal(weekStart(new Date("2026-10-22T15:00:00Z")), "2026-10-19");
  assert.equal(weekStart(new Date("2026-10-19T02:00:00Z")), "2026-10-12"); // domingo 23h em Brasília
  assert.equal(weekStart(new Date("2026-10-25T23:00:00Z")), "2026-10-19");
});

test("o e-mail não leva dado do estudante", () => {
  const { subject, text } = noticeEmail("https://incluiedu.municipio.gov.br/");
  assert.match(text, /https:\/\/incluiedu\.municipio\.gov\.br\/avisos/);
  assert.doesNotMatch(`${subject} ${text}`, /Dante|relatório|material|plano/i);
});

test("títulos dos avisos e a resposta da semana", () => {
  assert.equal(noticeTitle("relatorio_validado", "Dante"), "O relatório do período de Dante está disponível");
  assert.deepEqual(cleanCheckIn([" Dormiu bem ", "Dormiu bem", ""], "  "), { answers: ["Dormiu bem"], note: null });
  assert.deepEqual(cleanCheckIn([], "Foi ao parque."), { answers: [], note: "Foi ao parque." });
  assert.match(cleanCheckIn([], " ").error, /Marque pelo menos uma opção/);
});
