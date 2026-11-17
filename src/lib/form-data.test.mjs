import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod/v4";
import { dateFromInput, formField, readForm } from "./form-data.ts";
import { UserError } from "./user-error.ts";

const form = (entries) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};

const schema = z.object({
  title: formField.text(5),
  note: formField.optionalText(),
  notify: formField.checkbox(),
  tags: formField.list(),
  due: formField.optionalDate("o prazo"),
  status: formField.choice(["ativo", "encerrado"], "Escolha a situação."),
});

test("lê cada campo do esquema: texto aparado e cortado, vazio vira null, caixa marcada, lista pelos repetidos", () => {
  const data = readForm(form([["title", "  Leitura em dupla "], ["note", "   "], ["notify", "on"], ["tags", " a "], ["tags", ""], ["tags", "b"], ["status", "ativo"], ["extra", "fica de fora"]]), schema);
  assert.deepEqual(data, { title: "Leitu", note: null, notify: true, tags: ["a", "b"], due: null, status: "ativo" });
});

test("campos ausentes: texto vazio, caixa desmarcada, lista vazia; um só valor também vira lista", () => {
  const data = readForm(form([["tags", "único"], ["status", "encerrado"]]), schema);
  assert.deepEqual(data, { title: "", note: null, notify: false, tags: ["único"], due: null, status: "encerrado" });
});

test("data do <input type=date> fica ao meio-dia; data inválida e opção fora da lista viram mensagem para a pessoa", () => {
  const { due } = readForm(form([["due", "2026-03-09"], ["status", "ativo"]]), schema);
  assert.deepEqual([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours()], [2026, 2, 9, 12]);
  assert.throws(() => readForm(form([["due", "09/03/2026"], ["status", "ativo"]]), schema), (error) => error instanceof UserError && error.message === "Informe o prazo no formato dia/mês/ano.");
  assert.throws(() => readForm(form([["status", "outro"]]), schema), (error) => error instanceof UserError && error.message === "Escolha a situação.");
  assert.throws(() => dateFromInput(""), { message: "Informe a data no formato dia/mês/ano." });
});
