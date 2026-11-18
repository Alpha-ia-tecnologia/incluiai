import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../../../prisma/demo-data.mjs";
import { rolesWith } from "../../../src/lib/roles.ts";

export default {
  id: "01-primeiros-passos",
  title: "Primeiros passos",
  audience: "Toda a equipe da escola",
  roles: rolesWith("pedagogical"),
  summary: "Entrar, conhecer o Início e o menu, e achar ajuda.",
  async setup(t) {
    await t.goto("/login");
  },
  async run(t) {
    await t.intro({ title: "Primeiros passos", subtitle: "Entrar, conhecer o Início e achar ajuda", eyebrow: "Toda a equipe da escola" }, "Neste vídeo, você vai entrar no IncluiEdu e conhecer a tela inicial.");

    await t.say("Na tela de entrada, digite o e-mail de acesso que a escola cadastrou para você.", () => t.type("#email", DEMO_ACCOUNTS.professor_aee.email));
    await t.say("Depois, digite a sua senha.", () => t.type("#password", DEMO_PASSWORD, { delay: 90 }));
    await t.say("E clique em Entrar na plataforma.", async () => {
      await t.click("Entrar na plataforma");
      await t.waitForText("O que vamos fazer hoje?");
    });

    await t.say("No primeiro acesso, a plataforma dá as boas-vindas e mostra as etapas do trabalho com cada estudante.", () => t.ring({ text: "Boas-vindas", tag: "h2" }, 2400));
    await t.say("Você pode começar por aqui. Para ver o Início completo, clique em Agora não.", () => t.click({ text: "Agora não", exact: true }));
    await t.poster();

    await t.say("O Início mostra as tarefas mais comuns: registrar uma aula, preparar uma atividade e acompanhar um estudante.", async () => {
      await t.point({ text: "Registrar uma aula", in: "main", tag: "a" }, { hold: 700 });
      await t.point({ text: "Preparar uma atividade", in: "main", tag: "a" }, { hold: 700 });
      await t.point({ text: "Acompanhar um estudante", in: "main", tag: "a" }, { hold: 700 });
    });
    await t.say("Logo abaixo, cada estudante aparece com o próximo passo do acompanhamento.", () => t.ring({ text: "Próximo passo por estudante", tag: "h2" }, 1800));
    await t.scrollTop();

    await t.say("O menu, à esquerda, leva a todas as áreas da plataforma.", async () => {
      await t.point({ text: "Estudantes", in: "nav" }, { hold: 500 });
      await t.point({ text: "Minha jornada", in: "nav" }, { hold: 500 });
      await t.point({ text: "Atividades e recursos", in: "nav" }, { hold: 500 });
    });
    await t.say("No alto, o sino mostra os avisos novos.", () => t.point({ css: "header a[href='/avisos'], header [aria-label*='viso']" }));
    await t.say("E no botão Preciso de ajuda, você encontra o passo a passo de cada tarefa e estes vídeos.", () => t.point("Preciso de ajuda"));

    await t.say("No menu com o seu nome, você pode aumentar o tamanho do texto.", async () => {
      await t.click({ css: "header details > summary" }, { wait: false });
      await t.pause(500);
      await t.click({ text: "Texto grande" }, { wait: false });
    });
    await t.pause(900);
    await t.say("Para voltar ao tamanho padrão, é só escolher de novo.", async () => {
      await t.click({ text: "Texto no tamanho padrão" }, { wait: false });
    });
    await t.say("Ali também ficam a segurança da conta e o botão para sair da plataforma.", async () => {
      await t.point({ text: "Segurança da conta", in: "header" }, { hold: 600 });
      await t.point({ text: "Sair da plataforma", in: "header" }, { hold: 600 });
    });
    await t.click({ css: "header details > summary" }, { wait: false });

    await t.say("O botão de Libras, na lateral direita, abre o avatar do VLibras, que traduz os textos da tela.", () => t.point({ shadow: "#vlibras-access-wrapper", css: "button" }, { hold: 1200 }));

    await t.outro({ subtitle: "Agora você já sabe entrar e se localizar" }, "Pronto! Agora você já sabe entrar e se localizar. Nos próximos vídeos, veja cada tarefa, passo a passo.");
  },
};
