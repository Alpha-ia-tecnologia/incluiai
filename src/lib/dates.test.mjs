import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, ageFrom, brDay, brYmd, calendarDay, dayFromInput, dayStart, daysBetween, daysUntil, formatDate, formatDateShort, formatDateTime, isPastDay, isoToBr, monthIndex, monthOfIndex, monthStart } from "./dates.ts";

const at = (iso) => new Date(`${iso}-03:00`);

test("o dia é o de Brasília, também perto da meia-noite UTC", () => {
  assert.equal(brDay(new Date("2026-11-18T02:30:00Z")), "2026-11-17");
  assert.equal(brDay(new Date("2026-11-18T03:00:00Z")), "2026-11-18");
  assert.deepEqual(brYmd(new Date("2027-01-01T01:00:00Z")), { year: 2026, month: 12, day: 31 });
});

test("formatadores mostram o dia de Brasília", () => {
  const lateNight = new Date("2026-11-18T01:30:00Z");
  assert.equal(formatDateShort(lateNight), "17/11");
  assert.match(formatDate(lateNight), /^17 de nov\.? de 2026$/);
  assert.equal(formatDateTime(lateNight), "17/11/2026, 22:30");
});

test("valor de <input type=date>: meio-dia de Brasília; inválido não vira data", () => {
  assert.equal(dayFromInput("2026-03-10").toISOString(), "2026-03-10T15:00:00.000Z");
  assert.equal(dayFromInput("2026-02-30"), null);
  assert.equal(dayFromInput("10/03/2026"), null);
  assert.equal(dayFromInput("2026-13-45"), null);
  assert.equal(dayStart("2026-03-10").toISOString(), "2026-03-10T03:00:00.000Z");
});

test("contas de dias e prazo vencido pelo calendário (no próprio dia ainda está em dia)", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(daysBetween("2026-11-17", "2026-11-10"), -7);
  const due = at("2026-11-17T12:00:00");
  assert.equal(daysUntil(due, at("2026-11-17T23:50:00")), 0);
  assert.equal(isPastDay(due, at("2026-11-17T23:50:00")), false);
  assert.equal(isPastDay(due, at("2026-11-18T00:10:00")), true);
});

test("meses: índice de Brasília e começo do mês à meia-noite de Brasília", () => {
  assert.equal(monthIndex(new Date("2026-12-01T02:00:00Z")), 2026 * 12 + 10);
  assert.deepEqual(monthOfIndex(2026 * 12 + 11), { year: 2026, month: 12 });
  assert.equal(monthStart(2027 * 12).toISOString(), "2027-01-01T03:00:00.000Z");
});

test("datas só de dia (nascimento) e idade", () => {
  assert.equal(calendarDay(new Date("2019-03-12")), "2019-03-12");
  assert.equal(isoToBr("2019-03-12"), "12/03/2019");
  assert.equal(ageFrom(new Date("2019-03-12"), at("2026-03-11T23:00:00")), 6);
  assert.equal(ageFrom(new Date("2019-03-12"), at("2026-03-12T08:00:00")), 7);
});
