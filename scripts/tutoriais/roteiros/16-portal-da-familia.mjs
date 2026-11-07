// Portal da família: acompanhar, responder a pergunta da semana, fazer a
// atividade de casa, contar uma conquista e decidir as autorizações.

// Antes de gravar: a professora do AEE prepara as sugestões e aceita a
// atividade de casa, para o portal ter uma atividade enviada pela escola.
async function sendHomeActivity(t, studentId) {
  const context = await t.page.browser().createBrowserContext();
  const page = await context.newPage();
  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(`${t.base}/login`, { waitUntil: "networkidle2" });
    await page.type("#email", "aee@escola.edu.br");
    await page.type("#password", "demo123");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.click("button[type=submit]")]);
    await page.goto(`${t.base}/estudantes/${studentId}/atividades`, { waitUntil: "networkidle2" });
    const content = await page.$("select:not(#objectiveId)");
    await content.select("Chamada e nomes da turma");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Preparar 3 sugestões")).click());
    await page.waitForFunction(() => [...document.querySelectorAll(".ui-card")].some((card) => card.innerText.startsWith("Casa") && card.innerText.includes("Usar esta atividade")), { timeout: 60000 });
    await page.evaluate(() => {
      const card = [...document.querySelectorAll(".ui-card")].find((item) => item.innerText.startsWith("Casa") && item.innerText.includes("Usar esta atividade"));
      [...card.querySelectorAll("button")].find((b) => b.textContent.trim() === "Usar esta atividade").click();
    });
    await page.waitForFunction(() => document.querySelector('a[href*="/diario?activityId="]'), { timeout: 20000 });
  } finally {
    await context.close();
  }
}

// O cartão inteiro em volta de um título.
async function card(t, title) {
  const heading = await t.find({ text: title, tag: "h2, h3, p, span", in: "main" });
  return (await heading.evaluateHandle((el) => el.closest(".ui-card") ?? el.parentElement)).asElement();
}

export default {
  id: "16-portal-da-familia",
  title: "Portal da família",
  audience: "Famílias",
  roles: ["familia"],
  summary: "Acompanhar a escola, responder a pergunta da semana, contar conquistas e decidir as autorizações.",
  async setup(t) {
    await t.quietLogin("familia@email.com");
    await t.page.waitForFunction(() => location.pathname.startsWith("/familia/"), { timeout: 15000 });
    const studentId = new URL(t.page.url()).pathname.split("/").pop();
    await sendHomeActivity(t, studentId);
    await t.goto(`/familia/${studentId}`);
  },
  async run(t) {
    await t.intro({ title: "Portal da família", subtitle: "Acompanhar, participar e decidir", eyebrow: "Famílias" }, "Neste vídeo, você vai ver como acompanhar a escola do seu filho, pelo celular ou pelo computador.");

    await t.say("Ao entrar, você já vê o acompanhamento do seu filho.", () => t.ring({ css: "main h1" }, 1800));
    await t.say("Na primeira vez, a página mostra três jeitos de participar: saber o que a escola trabalha, fazer atividades em casa e contar conquistas.", () => t.ring({ text: "Boas-vindas", tag: "h2" }, 3000));
    await t.say("Para ver a página inteira, clique em Agora não.", () => t.click({ text: "Agora não", exact: true }));
    await t.poster();
    await t.say("Se preferir ouvir em vez de ler, clique em Ouvir esta página.", () => t.point({ text: "Ouvir esta página", in: "main" }, { hold: 1000 }));
    await t.say("E aqui você deixa as letras maiores.", () => t.point({ text: "Texto grande", in: "main" }, { hold: 1000 }));

    await t.say("Toda semana, a escola pergunta como foi a semana em casa. Marque o que aconteceu.", async () => {
      await t.click({ text: "Dormiu bem", tag: "label" }, { wait: false });
      await t.click({ text: "Teve uma conquista", tag: "label" }, { wait: false });
    });
    await t.say("Se quiser, escreva mais um pouco.", () => t.type({ field: "Quer contar mais?" }, "Ele contou para a avó o nome de dois colegas da turma."));
    await t.say("E clique em Enviar para a escola. A professora vê a resposta antes da próxima aula.", async () => {
      await t.click({ text: "Enviar para a escola" });
      await t.waitForText("Obrigado!");
      await t.ring({ css: "main [role=status]" }, 1400);
    });

    await t.say("Mais abaixo, você vê o que a escola está trabalhando agora: os objetivos combinados para ele.", async () => t.ring(await card(t, "O que estamos trabalhando agora"), 1600));
    await t.say("A bolinha mostra a ajuda de que ele precisa hoje. O losango mostra até onde a escola quer chegar.", () => t.ring({ text: "Apoio atual", tag: "p, span, li, div" }, 2400));

    await t.say("A escola também envia atividades para fazer em casa, com o passo a passo.", () => t.ring("#casa", 2400));
    await t.say("Depois de fazer, clique em Fizemos esta atividade. A escola fica sabendo.", async () => {
      await t.click({ text: "Fizemos esta atividade" });
      await t.waitForText("A escola foi avisada");
      await t.ring({ text: "A escola foi avisada", tag: "p" }, 1400);
    });

    await t.say("Viu uma conquista em casa? Conte para a escola. Escolha o que aconteceu.", async () => {
      await t.scrollTo("#conquista");
      await t.click({ text: "Reconheceu o próprio nome", in: "#conquista", tag: "label" }, { wait: false });
    });
    await t.say("Diga quem viu, e clique em Enviar.", async () => {
      await t.choose({ field: "Quem observou" }, "Mãe");
      await t.click({ text: "Enviar", in: "#conquista", exact: true });
    });
    await t.say("A conquista aparece logo abaixo, e a escola também vê.", async () => t.ring(await card(t, "O que a família já registrou"), 1800));

    await t.say("Em Autorizações, quem decide é a família. Vocês podem mudar quando quiserem.", () => t.ring("#autorizacoes", 2200));
    await t.say("Cada cartão explica o que acontece. O uso de inteligência artificial e a conexão com o terapeuta já estão autorizados.", async () => {
      await t.point({ text: "Retirar a autorização", in: "#autorizacoes", nth: 0 }, { hold: 900 });
      await t.point({ text: "Retirar a autorização", in: "#autorizacoes", nth: 1 }, { hold: 900 });
    });
    await t.say("Para permitir a carteirinha digital, por exemplo, clique em Autorizar.", async () => {
      await t.click({ text: "Autorizar", in: "#autorizacoes", tag: "button" });
      await t.page.waitForSelector("#carteirinha", { timeout: 15000 });
      await t.settle();
    });
    await t.say("Logo aparece a carteirinha, com frente e verso, para imprimir ou mostrar no celular.", () => t.ring("#carteirinha .id-card-sheet", 2400));
    await t.say("No verso, vocês escolhem o que aparece, como o contato de emergência.", async () => {
      const contact = await t.find({ text: "Contato de emergência", tag: "legend", in: "#carteirinha" });
      await t.ring((await contact.evaluateHandle((el) => el.closest("fieldset") ?? el.parentElement)).asElement(), 1800);
    });
    await t.say("Marque o que pode aparecer, e clique em Salvar a carteirinha.", async () => {
      await t.click({ text: "Mostrar este contato", in: "#carteirinha", tag: "label" }, { wait: false });
      await t.click({ text: "Salvar a carteirinha", in: "#carteirinha" });
    });
    await t.say("Se mudarem de ideia, é só clicar em Retirar a autorização.", () => t.point({ text: "Retirar a autorização", in: "#autorizacoes", nth: 2 }, { hold: 1400 }));

    await t.say("Por último, você vê quem da escola acessou os dados do seu filho, e quando.", async () => t.ring(await card(t, "Quem acessou os dados"), 2200));

    await t.outro({ subtitle: "Acompanhar, contar conquistas e decidir" }, "Pronto! Agora você já sabe acompanhar a escola, contar as conquistas de casa e decidir as autorizações.");
  },
};
