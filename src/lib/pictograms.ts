export type PictogramKey =
  | "calendario" | "professora" | "fone" | "prancha" | "lanche" | "agua" | "banheiro" | "maos"
  | "pausa" | "brincar" | "ler" | "escrever" | "desenhar" | "casa" | "escola" | "amigos"
  | "musica" | "tela" | "feliz" | "sentimentos" | "esperar" | "mochila" | "sentar" | "lixo" | "estrela";

const PICTOGRAM_RULES: readonly (readonly [Exclude<PictogramKey, "estrela">, readonly string[]])[] = [
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

function pictogramWords(text: string): string {
  const words = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return ` ${words} `;
}

function pictogramFor(text: string): PictogramKey {
  const words = pictogramWords(text);
  for (const [key, terms] of PICTOGRAM_RULES) {
    if (terms.some((term) => words.includes(` ${term} `))) return key;
  }
  return "estrela";
}

export const cardPictogram = (card: { label: string; caption?: string | null }) => pictogramFor(`${card.label} ${card.caption ?? ""}`);
