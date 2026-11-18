import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rolesWith } from "../../../src/lib/roles.ts";

const CSV = "﻿" + [
  "nome;nascimento;etapa;ano;turma;turno;responsavel;telefone;aee;frequencia_aee;profissional_de_apoio",
  "Helena Duarte Lima;12/05/2019;Anos iniciais;2º ano;Turma B;Manhã;Sônia Duarte;(98) 90000-1111;sim;2x por semana;não",
  "Pedro Henrique Sales;03/11/2018;Anos iniciais;2º ano;Turma B;Manhã;Marcos Sales;;não;;não",
  "Tiago Moura Alves;;Anos iniciais;2º ano;Turma B;Manhã;Lúcia Moura;;sim;1x por semana;não",
].join("\r\n") + "\r\n";

// O menu lateral rola por dentro, e o gravador só espera a rolagem da janela:
// traz o item para a vista e espera a rolagem acabar antes de clicar.
async function menu(t, label) {
  const item = await t.find({ text: label, in: "nav" });
  await item.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await t.pause(900);
  await t.click(item);
}

export default {
  id: "19-pessoas-e-planilha",
  title: "Contas e importação de estudantes",
  audience: "Coordenação e gestão da escola",
  roles: rolesWith("management"),
  summary: "Criar a conta de alguém da equipe e cadastrar uma turma por planilha.",
  async setup(t) {
    const dir = join(process.env.WORK ?? tmpdir(), "planilha");
    mkdirSync(dir, { recursive: true });
    t.vars.csv = join(dir, "turma-2B.csv");
    writeFileSync(t.vars.csv, CSV);
    await t.quietLogin("coordenacao");
    await t.dismissWelcome();
    await t.goto("/");
  },
  async run(t) {
    await t.intro({ title: "Contas e planilha de estudantes", subtitle: "Criar acessos e cadastrar uma turma de uma vez", eyebrow: "Coordenação e gestão da escola" }, "Neste vídeo, você vai criar a conta de uma pessoa da equipe e cadastrar estudantes a partir de uma planilha.");

    await t.say("No menu, abra Pessoas e acessos.", () => menu(t, "Pessoas e acessos"));
    await t.say("Aqui ficam as contas que a escola cuida: a equipe, as famílias e os terapeutas.", () => t.ring("#contas-lista", 1800));
    await t.say("Para dar acesso a alguém, clique em Nova conta.", () => t.click({ text: "Nova conta", in: "main" }));
    await t.say("Digite o nome completo.", () => t.type({ field: "Nome completo" }, "Joana Ribeiro Costa"));
    await t.say("O e-mail de acesso.", () => t.type({ field: "E-mail de acesso" }, "joana.costa@escola.edu.br", { delay: 30 }));
    await t.say("E escolha o perfil. A escola já vem preenchida.", () => t.choose({ field: "Perfil" }, "Professor(a) da sala comum"));
    await t.say("Clique em Criar a conta.", async () => {
      await t.click("Criar a conta");
      await t.waitForText("Senha temporária");
    });
    await t.poster();
    await t.say("A plataforma gera uma senha temporária. Ela aparece só agora: entregue à pessoa por um canal seguro.", () => t.ring("#senha-temporaria", 2400));
    await t.say("Se preferir, imprima. No primeiro acesso, a pessoa troca essa senha pela dela.", () => t.point({ text: "Imprimir", in: "main", exact: true }, { hold: 900 }));

    await t.say("Agora, para cadastrar uma turma de uma vez, abra Estudantes.", () => menu(t, "Estudantes"));
    await t.say("E clique em Importar planilha.", () => t.click({ text: "Importar planilha", in: "main" }));
    await t.say("Baixe o modelo, preencha no Excel ou no LibreOffice e salve como CSV.", () => t.point("Baixar o modelo (.csv)", { hold: 1400 }));
    await t.say("Depois, escolha o arquivo da planilha.", async () => {
      const input = await t.find({ css: "main input[type=file]" });
      const [chooser] = await Promise.all([t.page.waitForFileChooser({ timeout: 10000 }), t.click(input, { wait: false })]);
      await chooser.accept([t.vars.csv]);
      await t.pause(600);
    });
    await t.say("E clique em Conferir a planilha. Nada é gravado ainda.", async () => {
      await t.click("Conferir a planilha");
      await t.waitForText("Nada foi gravado ainda");
    });
    await t.say("A conferência mostra quem está pronto e as linhas com problema, com o motivo.", async () => {
      await t.ring({ css: "main section[aria-labelledby$='-ready']" }, 1600);
      await t.ring({ css: "main section[aria-labelledby$='-invalid']" }, 1800);
    });
    await t.say("Corrija na planilha o que faltar. As linhas prontas já podem entrar: clique em Importar.", async () => {
      await t.click({ text: "Importar 2 estudantes" });
      await t.waitForText("estudantes importados");
    });
    await t.say("Os estudantes entram no cadastro da escola, e a importação fica no histórico.", () => t.ring({ text: "estudantes importados", tag: "p" }, 2000));

    await t.outro({ subtitle: "Conta criada e turma cadastrada" }, "Pronto! Agora você já sabe criar contas e cadastrar estudantes por planilha.");
  },
};
