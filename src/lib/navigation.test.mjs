import { test } from "node:test";
import assert from "node:assert/strict";
import { getNavigation, isActivePath } from "./navigation.ts";

const menu = (role, studentIds = []) => getNavigation(role, studentIds).map((link) => `${link.href}${link.section === "management" ? "*" : ""}`).join(" ");

test("menu de cada perfil", () => {
  const routine = "/ /estudantes /jornada /planejamento /assistente /recursos /jogos /calendario";
  const management = "/painel* /dossie* /censo* /cadastros* /usuarios* /ajuda";
  assert.equal(menu("professor_sala"), `${routine} /painel /ajuda`);
  assert.equal(menu("apoio"), `${routine} /painel /ajuda`);
  assert.equal(menu("professor_aee"), `${routine} /painel /dossie /ajuda`);
  assert.equal(menu("coordenacao"), `${routine} ${management}`);
  assert.equal(menu("gestao"), `${routine} ${management}`);
  assert.equal(menu("secretaria"), `/ /estudantes /jornada /assistente /recursos /calendario ${management}`);
  assert.equal(menu("familia", ["a"]), "/familia/a /jornada /assistente /calendario /ajuda");
  assert.equal(menu("familia", ["a", "b"]), "/familia /jornada /assistente /calendario /ajuda");
  assert.equal(menu("terapeuta", ["a"]), "/terapeuta /jornada /assistente /calendario /ajuda");
  assert.equal(menu("plataforma"), "");
});

test("link ativo: a seção e as páginas dentro dela; o início só nele mesmo", () => {
  assert.equal(isActivePath("/estudantes/x/perfil", "/estudantes"), true);
  assert.equal(isActivePath("/estudantes-novos", "/estudantes"), false);
  assert.equal(isActivePath("/estudantes", "/", true), false);
  assert.equal(isActivePath("/", "/", true), true);
  assert.equal(isActivePath("/estudantes/x/perfil", "/estudantes/x", true), false);
});
