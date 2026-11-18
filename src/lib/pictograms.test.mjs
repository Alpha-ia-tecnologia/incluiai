import { test } from "node:test";
import assert from "node:assert/strict";
import { cardPictogram } from "./pictograms.ts";
import { rulesMaterial } from "./material-content.ts";

const pictogramFor = (label) => cardPictogram({ label });

test("acentos e maiúsculas não mudam a escolha", () => {
  assert.equal(pictogramFor("Beber água"), "agua");
  assert.equal(pictogramFor("BEBER AGUA"), "agua");
  assert.equal(pictogramFor("Lavar as MÃOS"), "maos");
  assert.equal(pictogramFor("Calendário da semana"), "calendario");
  assert.equal(pictogramFor("Música na roda"), "musica");
  assert.equal(pictogramFor("Lápis e caderno"), "escrever");
  assert.equal(pictogramFor("Saída"), "casa");
  assert.equal(pictogramFor("Estou desconfortável"), "sentimentos");
  assert.equal(pictogramFor("A história do dinossauro"), "ler");
});

test("cada assunto tem o seu pictograma", () => {
  const cases = {
    "Olhar a rotina do dia": "calendario",
    "O professor explica": "professora",
    "Usar o fone": "fone",
    "Apontar o cartão": "prancha",
    "Hora da merenda": "lanche",
    "Ir ao banheiro": "banheiro",
    "Respirar devagar": "pausa",
    "Canto silencioso": "pausa",
    "Brincar no recreio": "brincar",
    "Desenhar e pintar": "desenhar",
    "Ir embora": "casa",
    "Chegar à escola": "escola",
    "Sentar com a turma": "amigos",
    "Usar o tablet": "tela",
    "Terminei!": "feliz",
    "Estou ficando incomodado": "sentimentos",
    "Fazer fila": "esperar",
    "Guardar a mochila": "mochila",
    "Sentar à mesa": "sentar",
    "Jogar o lixo fora": "lixo",
  };
  for (const [text, key] of Object.entries(cases)) assert.equal(pictogramFor(text), key, text);
});

test("prioridade: o assunto mais concreto ganha", () => {
  assert.equal(pictogramFor("Se eu precisar, eu mostro na minha prancha."), "prancha");
  assert.equal(pictogramFor("Às vezes pode ter barulho ou mudança. Tudo bem."), "fone");
  assert.equal(pictogramFor("A professora me mostra o que vai acontecer."), "professora");
  assert.equal(pictogramFor("Mostrar com: apontar o cartão"), "prancha");
  assert.equal(pictogramFor("Pedir para ir ao banheiro"), "banheiro");
  assert.equal(pictogramFor("Comer com calma"), "lanche");
  assert.equal(pictogramFor("Ouvir a história"), "ler");
  assert.equal(pictogramFor("Fazer fila com a turma"), "esperar");
  assert.equal(pictogramFor("Hoje vai ter hora do lanche."), "lanche");
  assert.equal(pictogramFor("Se eu ficar desconfortável, uma coisa que me ajuda é: respirar devagar."), "pausa");
  assert.equal(pictogramFor("Quando termina, eu fico contente com o que fiz."), "feliz");
  assert.equal(cardPictogram({ label: "Ir para casa", caption: "Terminei!" }), "casa");
});

test("só palavras inteiras contam", () => {
  assert.equal(pictogramFor("Jogar o lixo fora"), "lixo");
  assert.equal(pictogramFor("Às vezes"), "estrela");
  assert.equal(pictogramFor("Como estou agora"), "estrela");
  assert.equal(pictogramFor("Eu canto"), "estrela");
  assert.equal(pictogramFor("Cantar junto"), "musica");
});

test("sem correspondência: estrela", () => {
  assert.equal(pictogramFor(""), "estrela");
  assert.equal(pictogramFor("   "), "estrela");
  assert.equal(pictogramFor("Ficar no lugar marcado"), "estrela");
  assert.equal(cardPictogram({ label: "Sim" }), "estrela");
});

test("cartões da história social do motor de regras: o pictograma acompanha cada frase", () => {
  const facts = {
    firstName: "Dante", expressiveChannel: "caa_prancha", expressiveLabel: "CAA (prancha)", receptiveLabel: "Fala",
    commandSteps: 1, attentionMinutes: 8, toleranceMinutes: 15, interests: ["Dinossauros"], calming: ["Fone abafador"],
    triggers: [], sensitiveTo: [], readingSupport: 4, fineMotorSupport: 2, usesWheelchair: false, strengths: "",
  };
  const story = rulesMaterial({ kind: "historia_social", topic: "", context: "aee", objective: null, facts }).content.cards.map(cardPictogram);
  assert.deepEqual(story, ["calendario", "professora", "fone", "fone", "prancha", "estrela", "feliz"]);
});
