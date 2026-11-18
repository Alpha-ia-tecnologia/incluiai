import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// Foto da demonstração: um personagem desenhado da própria plataforma (nunca a foto de uma pessoa),
// com fundo branco no lugar da transparência, que o JPG deixaria preta.
function illustration() {
  const source = join(ROOT, "public", "illustrations", "characters", "learning-azul.png");
  const out = join(process.env.WORK ?? tmpdir(), "carteirinha-ilustracao.jpg");
  try {
    execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=white:s=1254x1254", "-i", source, "-filter_complex", "overlay", "-frames:v", "1", out]);
    return out;
  } catch {
    return source;
  }
}

// A janela de impressão do navegador não aparece na gravação.
async function printPreview(t, button, narration) {
  await t.page.evaluate(() => { window.print = () => {}; });
  await t.say(narration, async () => {
    await t.click(button, { wait: false });
    await t.pause(500);
    await t.page.emulateMediaType("print");
    await t.page.evaluate(() => window.scrollTo(0, 0));
    await t.pause(2600);
  });
  await t.page.emulateMediaType("screen");
  await t.page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await t.pause(300);
}

export default {
  id: "15-carteirinha",
  title: "Carteirinha digital",
  audience: "AEE, coordenação e família",
  roles: ["professor_aee", "coordenacao", "gestao", "familia"],
  summary: "A família autoriza e escolhe o verso; a escola põe a foto e imprime.",
  async setup(t) {
    t.vars.photo = illustration();
    await t.quietLogin("professor_aee");
    t.vars.card = `/estudantes/${await t.studentId("Dante Oliveira")}/carteirinha`;
    await t.page.deleteCookie(...(await t.page.cookies()));
    await t.quietLogin("familia");
    await t.dismissWelcome();
    t.vars.portal = new URL(t.page.url()).pathname;
    await t.scrollTo({ text: "Autorizações", tag: "h2" }, "start");
  },
  async run(t) {
    await t.intro({ title: "Carteirinha digital", subtitle: "Com a autorização da família", eyebrow: "AEE, coordenação e família" }, "Neste vídeo, você vai ver como a carteirinha digital do estudante é feita, com a autorização da família.");

    await t.say("A carteirinha só existe com o sim da família. No portal, em Autorizações, ela clica em Autorizar.", () => t.click({ text: "Carteirinha digital", tag: "button" }));
    await t.say("Depois, a família escolhe o que vai no verso: como ajudar o estudante e um contato de emergência.", async () => {
      await t.waitForText("Salvar a carteirinha");
      await t.click({ css: "input[name='mostrarComoAjudar']" }, { wait: false });
      await t.click({ css: "input[name='mostrarContato']" }, { wait: false });
      await t.choose("#contato-parentesco", "Mãe");
    });
    await t.say("E clica em Salvar a carteirinha.", async () => {
      await t.click({ text: "Salvar a carteirinha", tag: "button" }, { wait: false });
      await t.waitForText("Carteirinha atualizada");
    });

    await t.card({ title: "Na escola", subtitle: "A equipe do AEE completa a carteirinha", eyebrow: "Carteirinha digital" });
    await t.pause(600);
    await t.page.deleteCookie(...(await t.page.cookies()));
    await t.quietLogin("professor_aee");
    await t.dismissWelcome();
    await t.goto(t.vars.card);
    await t.pause(600);
    await t.card(null);
    await t.pause(500);

    await t.say("Na escola, a carteirinha fica na aba Carteirinha do estudante.", () => t.ring({ css: ".id-card-sheet" }, 1800));
    await t.say("Escolha uma foto do estudante, de frente. A plataforma reduz o tamanho e remove a localização da foto.", async () => {
      const input = await t.point("#carteirinha-foto", { hold: 600 });
      await input.uploadFile(t.vars.photo);
      await t.page.waitForFunction(() => !document.body.innerText.includes("Preparando a foto"), { timeout: 15000 }).catch(() => {});
    });
    await t.say("Clique em Enviar a foto.", async () => {
      await t.click({ text: "Enviar a foto", tag: "button" });
      await t.waitForText("Foto salva");
    });

    await t.say("Na frente, ficam a foto, o nome, a turma e a escola. Nenhum diagnóstico.", () => t.ring({ css: ".id-card", nth: 0 }, 2200));
    await t.poster();
    await t.say("No verso, o que a família escolheu, e o código QR.", () => t.ring({ css: ".id-card", nth: 1 }, 2000));
    await t.say("O código QR só abre a ficha para quem entra na plataforma com permissão. E cada leitura vai para o histórico da família.", () => t.point({ css: "[data-qr-path]" }, { hold: 1600 }));
    await t.say("Perdeu a carteirinha? Gere um código novo, e a anterior deixa de abrir.", () => t.point({ text: "Gerar código novo", tag: "button" }, { hold: 1200 }));
    await printPreview(t, { text: "Imprimir carteirinha", tag: "button" }, "Para imprimir, clique em Imprimir carteirinha. Depois, recorte pela borda e dobre ao meio.");

    await t.outro({ subtitle: "A família autoriza, a escola faz e imprime" }, "Pronto! Agora você já sabe fazer a carteirinha digital, sempre com a autorização da família.");
  },
};
