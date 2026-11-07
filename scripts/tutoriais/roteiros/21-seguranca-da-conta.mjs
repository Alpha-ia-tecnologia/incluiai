// Segurança da conta: trocar a senha e ligar a verificação em duas etapas.
// O aplicativo autenticador da gravação: o código da janela seguinte, que o servidor
// aceita agora e daqui a 30 segundos (a digitação pode cruzar a virada da janela).
// Importado só aqui: carregar o .ts tem um aviso do Node que não precisa aparecer nos outros vídeos.
async function authenticatorCode(secret) {
  const { totpAt } = await import("../../../src/lib/totp.ts");
  const ahead = Math.floor(Date.now() / 30_000) + 1;
  return totpAt(secret, ahead * 30_000);
}

export default {
  id: "21-seguranca-da-conta",
  title: "Segurança da conta",
  audience: "Todos os perfis",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao", "secretaria", "familia", "terapeuta"],
  summary: "Trocar a senha e ligar a verificação em duas etapas.",
  async setup(t) {
    await t.quietLogin("professor@escola.edu.br");
    await t.dismissWelcome();
    await t.goto("/");
  },
  async run(t) {
    await t.intro({ title: "Segurança da conta", subtitle: "Trocar a senha e ligar a verificação em duas etapas", eyebrow: "Todos os perfis" }, "Neste vídeo, você vai trocar a sua senha e ligar a verificação em duas etapas.");

    await t.say("No menu com o seu nome, abra Segurança da conta.", async () => {
      await t.click({ css: "header details > summary" }, { wait: false });
      await t.pause(400);
      await t.click({ text: "Segurança da conta", in: "header", tag: "a" });
      // O menu fica aberto depois da navegação: fecha, para não cobrir a página.
      await t.page.evaluate(() => document.querySelector("header details")?.removeAttribute("open"));
    });
    await t.say("Para trocar a senha, abra Trocar a senha.", () => t.click({ text: "Trocar a senha", tag: "summary" }, { wait: false }));
    await t.say("Digite a senha atual.", () => t.type({ field: "Senha atual" }, "demo123", { delay: 90 }));
    await t.say("Depois, a senha nova: pelo menos dez caracteres. Não use o seu nome nem o e-mail. Uma frase pequena funciona bem.", async () => {
      await t.type({ field: "Senha nova" }, "pipa colorida no recreio", { delay: 45 });
      await t.type({ field: "Repita a senha nova" }, "pipa colorida no recreio", { delay: 30 });
    });
    await t.say("Clique em Trocar a senha. As outras sessões abertas são encerradas.", async () => {
      await t.click({ text: "Trocar a senha", tag: "button" }, { wait: false });
      await t.waitForText("Senha trocada");
    });

    await t.say("A verificação em duas etapas protege os dados dos estudantes: além da senha, a entrada pede um código do celular.", () => t.ring({ text: "Verificação em duas etapas", tag: "h2" }, 2400));
    await t.say("Clique em Ligar a verificação em duas etapas.", async () => {
      await t.click({ text: "Ligar a verificação em duas etapas", tag: "button" }, { wait: false });
      await t.page.waitForSelector("#totp-secret", { timeout: 20000 });
    });
    await t.say("No celular, abra um aplicativo autenticador e leia o código QR.", () => t.ring({ css: "[role=img][aria-label^='QR code']" }, 2200));
    await t.poster();
    await t.say("Digite o código de seis números que aparece no aplicativo.", async () => {
      const secret = (await t.page.$eval("#totp-secret", (element) => element.textContent)).replace(/\s/g, "");
      await t.type({ css: "input[name=code]" }, await authenticatorCode(secret), { delay: 120 });
    });
    await t.say("E clique em Confirmar e ligar.", async () => {
      await t.click({ text: "Confirmar e ligar", tag: "button" }, { wait: false });
      await t.page.waitForSelector("ul[aria-label='Códigos de recuperação'] li", { timeout: 20000 });
    });
    await t.say("Guarde os códigos de recuperação: cada um vale uma entrada sem o celular. Eles não aparecem de novo.", () => t.ring({ css: "ul[aria-label='Códigos de recuperação']" }, 2400));
    await t.say("Você pode imprimir os códigos. Depois, clique em Já guardei os códigos.", async () => {
      await t.point({ text: "Imprimir os códigos", tag: "button" }, { hold: 700 });
      await t.click({ text: "Já guardei os códigos", tag: "button" }, { wait: false });
      await t.waitForText("Ligada desde");
    });
    await t.say("A verificação está ligada. Na próxima entrada, a plataforma pede o código depois da senha.", () => t.ring({ text: "Ligada desde", tag: "p, span, div" }, 2200));

    await t.outro({ subtitle: "Senha forte e código do celular" }, "Pronto! Agora a sua conta está mais protegida, com uma senha forte e a verificação em duas etapas.");
  },
};
