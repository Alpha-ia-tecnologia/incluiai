// Pictograma de reserva dos cartões de material: quando o cartão ainda não tem
// imagem desenhada, um ícone escolhido pelas palavras do cartão (legenda e
// rótulo) mostra o assunto em vez de uma caixa vazia. Puro (sem React nem
// banco), para ser testado com node --test (src/lib/pictograms.test.mjs).

export const PICTOGRAM_KEYS = [
  "calendario", "professora", "fone", "prancha", "lanche", "agua", "banheiro", "maos",
  "pausa", "brincar", "ler", "escrever", "desenhar", "casa", "escola", "amigos",
  "musica", "tela", "feliz", "sentimentos", "esperar", "mochila", "sentar", "lixo", "estrela",
] as const;

export type PictogramKey = (typeof PICTOGRAM_KEYS)[number];

// Palavras inteiras, já sem acento e em minúsculas; as flexões entram uma a uma
// para "jogar o lixo" não virar brincadeira nem "às vezes" virar fila.
//
// A ordem é a prioridade: ganha a primeira regra que casar. Coisas e lugares
// concretos vêm antes do que é genérico (pessoas, o dia, sentimentos), para
// "Pedir para ir ao banheiro" virar banheiro, "Comer com calma" virar lanche e
// "Ir para casa. Terminei!" virar casa. Pausa vem antes de prancha ("peço uma
// pausa") e prancha antes de professora ("Mostrar com: apontar o cartão").
export const PICTOGRAM_RULES: readonly (readonly [Exclude<PictogramKey, "estrela">, readonly string[]])[] = [
  ["banheiro", ["banheiro", "banheiros", "vaso", "descarga", "xixi"]],
  ["maos", ["lavar", "lavo", "lava", "lavando", "mao", "maos", "sabonete", "torneira", "enxaguar"]],
  ["agua", ["agua", "beber", "bebo", "bebe", "garrafa"]],
  ["lanche", ["lanche", "lanches", "lancheira", "merenda", "comer", "come", "comendo", "comida", "refeicao", "almoco", "fruta"]],
  ["ler", ["ler", "leio", "le", "leitura", "livro", "livros", "historia", "historias"]],
  ["escrever", ["escrever", "escrevo", "escreve", "escrita", "lapis", "caderno"]],
  ["desenhar", ["desenhar", "desenho", "desenha", "pintar", "pinto", "pinta", "pintura", "colorir"]],
  ["musica", ["musica", "musicas", "cantar", "canta", "cancao"]],
  ["tela", ["computador", "tablet", "celular", "tela", "video"]],
  ["fone", ["barulho", "barulhos", "som", "sons", "fone", "fones", "abafador", "ouvir", "ouco", "ouve"]],
  ["pausa", ["pausa", "pausas", "descansar", "descanso", "respirar", "respiro", "respira", "calma", "acalmar", "relaxar", "canto silencioso", "canto da calma"]],
  ["prancha", ["prancha", "cartao", "cartoes", "apontar", "aponto", "aponta", "comunicar", "comunico", "pedir", "peco", "pede", "mostro"]],
  ["brincar", ["brincar", "brinca", "brincadeira", "brincadeiras", "brinquedo", "brinquedos", "recreio", "jogo", "jogos", "bola", "parquinho", "quadra"]],
  ["esperar", ["esperar", "espero", "espera", "fila", "vez"]],
  ["mochila", ["mochila", "guardar", "guardo", "guarda", "arrumar", "arrumo", "organizar"]],
  ["lixo", ["lixo", "lixeira", "jogar fora", "joga fora", "reciclar"]],
  ["casa", ["casa", "ir embora", "vou embora", "saida", "despedir", "tchau"]],
  ["escola", ["escola", "chegada", "chegar", "chego", "entrar", "entro", "sala", "aula"]],
  ["amigos", ["amigo", "amigos", "amiga", "amigas", "colega", "colegas", "turma", "juntos"]],
  ["sentar", ["sentar", "sento", "senta", "sentado", "sentada", "cadeira", "mesa", "carteira"]],
  ["professora", ["professora", "professor", "professoras", "professores", "mostrar", "mostra", "explicar", "explica"]],
  ["calendario", ["rotina", "agenda", "hoje", "calendario", "dia", "amanha", "semana"]],
  ["feliz", ["feliz", "contente", "alegre", "calmo", "tranquilo", "terminei", "termina", "terminou", "fim", "acabou", "consegui"]],
  ["sentimentos", ["sentir", "sinto", "sente", "sentimento", "sentimentos", "desconfortavel", "incomodado", "incomodada", "triste", "bravo", "brava", "raiva", "medo", "nervoso", "nervosa"]],
];

// " beber agua " : sem acento, minúsculas, só letras e números, com espaço nas
// pontas para casar palavras (e expressões) inteiras.
export function pictogramWords(text: string): string {
  const words = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return ` ${words} `;
}

export function pictogramFor(text: string): PictogramKey {
  const words = pictogramWords(text);
  for (const [key, terms] of PICTOGRAM_RULES) {
    if (terms.some((term) => words.includes(` ${term} `))) return key;
  }
  return "estrela";
}

// O texto do cartão que decide o pictograma: rótulo e legenda.
export const cardPictogram = (card: { label: string; caption?: string | null }) => pictogramFor(`${card.label} ${card.caption ?? ""}`);
