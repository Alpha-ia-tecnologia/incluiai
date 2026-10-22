// Sondagem com linha de base e reavaliação (item 3 do plano), pura para teste
// com node --test (src/lib/assessment.test.mjs). Cada item é observável e
// recebe o nível de apoio da escala única da plataforma (0 independente a 5
// apoio físico total); avanço continua sendo precisar de menos apoio.
// A sondagem não classifica por diagnóstico: o AEE é pedagógico.
//
// Versão 1 do instrumento: rascunho da plataforma para a equipe pedagógica
// revisar. Itens próprios (nenhum copiado de instrumento com direitos autorais).

export const INSTRUMENT_VERSION = "sondagem-2026-10-v1";

export type AreaKey = "comunicacao" | "leitura_escrita" | "matematica" | "autonomia" | "interacao" | "motor";
export type AssessmentItem = { id: string; area: AreaKey; text: string; year?: number; bncc?: string };
export type Answers = Record<string, number | null>;

export const AREAS: { key: AreaKey; label: string }[] = [
  { key: "comunicacao", label: "Comunicação e linguagem" },
  { key: "leitura_escrita", label: "Leitura e escrita" },
  { key: "matematica", label: "Matemática" },
  { key: "autonomia", label: "Autonomia e autocuidado" },
  { key: "interacao", label: "Interação e autorregulação" },
  { key: "motor", label: "Motor e sensorial" },
];
export const AREA_LABEL = Object.fromEntries(AREAS.map((area) => [area.key, area.label])) as Record<AreaKey, string>;

export const ITEMS: AssessmentItem[] = [
  { id: "com-01", area: "comunicacao", text: "Atende quando é chamado pelo nome." },
  { id: "com-02", area: "comunicacao", text: "Segue uma instrução simples, como pegar o lápis." },
  { id: "com-03", area: "comunicacao", text: "Segue uma instrução com duas etapas." },
  { id: "com-04", area: "comunicacao", text: "Pede o que precisa, por fala, gesto, prancha ou outro meio." },
  { id: "com-05", area: "comunicacao", text: "Responde a perguntas de sim ou não." },
  { id: "com-06", area: "comunicacao", text: "Conta um acontecimento na ordem em que aconteceu." },
  { id: "com-07", area: "comunicacao", text: "Faz perguntas para saber mais." },
  { id: "com-08", area: "comunicacao", text: "Mantém uma conversa curta, esperando a sua vez de falar." },

  { id: "le-01", area: "leitura_escrita", text: "Reconhece o próprio nome escrito.", year: 1 },
  { id: "le-02", area: "leitura_escrita", text: "Distingue letras de números e de outros sinais.", year: 1, bncc: "EF01LP04" },
  { id: "le-03", area: "leitura_escrita", text: "Nomeia as letras do alfabeto.", year: 1, bncc: "EF01LP10" },
  { id: "le-04", area: "leitura_escrita", text: "Escreve o próprio nome.", year: 1 },
  { id: "le-05", area: "leitura_escrita", text: "Relaciona as letras aos sons que elas representam.", year: 1, bncc: "EF01LP07" },
  { id: "le-06", area: "leitura_escrita", text: "Separa palavras em sílabas, falando.", year: 1, bncc: "EF01LP06" },
  { id: "le-07", area: "leitura_escrita", text: "Escreve palavras, mesmo com erros de ortografia.", year: 1, bncc: "EF01LP02" },
  { id: "le-08", area: "leitura_escrita", text: "Lê palavras simples.", year: 2, bncc: "EF02LP04" },
  { id: "le-09", area: "leitura_escrita", text: "Escreve frases com as palavras separadas.", year: 2, bncc: "EF02LP08" },
  { id: "le-10", area: "leitura_escrita", text: "Lê um texto curto e responde a perguntas sobre ele.", year: 2, bncc: "EF02LP26" },
  { id: "le-11", area: "leitura_escrita", text: "Escreve um texto curto seguindo um modelo, como uma lista ou uma instrução.", year: 3, bncc: "EF03LP14" },

  { id: "ma-01", area: "matematica", text: "Conta objetos até 10.", year: 1, bncc: "EF01MA02" },
  { id: "ma-02", area: "matematica", text: "Usa números para dizer quantidade ou ordem.", year: 1, bncc: "EF01MA01" },
  { id: "ma-03", area: "matematica", text: "Compara quantidades: mais, menos ou igual.", year: 1, bncc: "EF01MA03" },
  { id: "ma-04", area: "matematica", text: "Conta coleções de até 100 objetos.", year: 1, bncc: "EF01MA04" },
  { id: "ma-05", area: "matematica", text: "Resolve adição e subtração simples com material concreto.", year: 1, bncc: "EF01MA08" },
  { id: "ma-06", area: "matematica", text: "Reconhece formas geométricas em objetos do dia a dia.", year: 1, bncc: "EF01MA13" },
  { id: "ma-07", area: "matematica", text: "Reconhece moedas e cédulas em situações simples.", year: 1, bncc: "EF01MA19" },
  { id: "ma-08", area: "matematica", text: "Compara e ordena números até a centena.", year: 2, bncc: "EF02MA01" },
  { id: "ma-09", area: "matematica", text: "Resolve problemas de adição e subtração com números maiores.", year: 2, bncc: "EF02MA06" },
  { id: "ma-10", area: "matematica", text: "Resolve problemas de multiplicação simples.", year: 2, bncc: "EF02MA07" },
  { id: "ma-11", area: "matematica", text: "Resolve problemas de divisão simples.", year: 3, bncc: "EF03MA08" },

  { id: "aut-01", area: "autonomia", text: "Come sem ajuda." },
  { id: "aut-02", area: "autonomia", text: "Usa o banheiro sem ajuda." },
  { id: "aut-03", area: "autonomia", text: "Lava as mãos sem ajuda." },
  { id: "aut-04", area: "autonomia", text: "Guarda e organiza o próprio material." },
  { id: "aut-05", area: "autonomia", text: "Segue a rotina da sala com apoio visual." },
  { id: "aut-06", area: "autonomia", text: "Passa de uma atividade para outra." },
  { id: "aut-07", area: "autonomia", text: "Anda pela escola com segurança." },

  { id: "int-01", area: "interacao", text: "Aceita a aproximação dos colegas." },
  { id: "int-02", area: "interacao", text: "Participa de brincadeiras com colegas." },
  { id: "int-03", area: "interacao", text: "Espera a sua vez." },
  { id: "int-04", area: "interacao", text: "Divide materiais com os colegas." },
  { id: "int-05", area: "interacao", text: "Pede ajuda a um adulto quando precisa." },
  { id: "int-06", area: "interacao", text: "Reconhece e nomeia o que sente." },
  { id: "int-07", area: "interacao", text: "Usa uma estratégia para se acalmar." },
  { id: "int-08", area: "interacao", text: "Lida com mudanças na rotina." },

  { id: "mot-01", area: "motor", text: "Segura o lápis e faz traços." },
  { id: "mot-02", area: "motor", text: "Recorta com tesoura." },
  { id: "mot-03", area: "motor", text: "Encaixa e monta peças pequenas." },
  { id: "mot-04", area: "motor", text: "Participa das atividades de educação física." },
  { id: "mot-05", area: "motor", text: "Tolera os sons da sala de aula." },
  { id: "mot-06", area: "motor", text: "Fica na atividade pelo tempo combinado." },
];

const LEVEL_MAX_FOR_YEAR = 2; // até instrução verbal ou pista visual

// Respostas válidas: só itens do instrumento e níveis de 0 a 5 (null = não observado).
export function cleanAnswers(raw: Record<string, unknown>): Answers {
  const answers: Answers = {};
  for (const item of ITEMS) {
    const value = raw[item.id];
    const level = value === null || value === undefined || value === "" ? null : Number(value);
    answers[item.id] = level !== null && Number.isInteger(level) && level >= 0 && level <= 5 ? level : null;
  }
  return answers;
}

export const observed = (answers: Answers, area?: AreaKey) => ITEMS.filter((item) => (!area || item.area === area) && answers[item.id] !== null && answers[item.id] !== undefined);

// Por área: quantos itens observados, o apoio médio e quantos já sem apoio (0 ou 1).
export function areaSummary(answers: Answers, area: AreaKey): { observed: number; average: number | null; independent: number } {
  const items = observed(answers, area);
  if (!items.length) return { observed: 0, average: null, independent: 0 };
  const levels = items.map((item) => answers[item.id] as number);
  return { observed: items.length, average: Math.round((levels.reduce((sum, level) => sum + level, 0) / levels.length) * 10) / 10, independent: levels.filter((level) => level <= 1).length };
}

// Ano de referência na BNCC (leitura e escrita, matemática): o maior ano em que
// todos os itens observados até ele saem com apoio até instrução verbal.
// 0 = ainda antes das habilidades do 1º ano; null = área não observada.
export function referenceYear(answers: Answers, area: AreaKey): number | null {
  const items = observed(answers, area).filter((item) => item.year);
  if (!items.length) return null;
  let reached = 0;
  for (const year of [...new Set(items.map((item) => item.year!))].sort()) {
    const upTo = items.filter((item) => item.year! <= year);
    if (upTo.every((item) => (answers[item.id] as number) <= LEVEL_MAX_FOR_YEAR)) reached = year;
    else break;
  }
  return reached;
}

export const referenceLabel = (year: number | null) => (year === null ? null : year === 0 ? "ainda antes das habilidades do 1º ano" : `habilidades do ${year}º ano`);

// Evolução por área entre duas aplicações (positivo = precisa de menos apoio).
export function compareAreas(baseline: Answers, latest: Answers): { area: AreaKey; label: string; start: number | null; end: number | null; change: number | null }[] {
  return AREAS.map(({ key, label }) => {
    const start = areaSummary(baseline, key).average;
    const end = areaSummary(latest, key).average;
    return { area: key, label, start, end, change: start !== null && end !== null ? Math.round((start - end) * 10) / 10 : null };
  });
}

// Itens com muito apoio (modelo ou mais) viram sugestões de objetivo para o plano.
export function objectiveSuggestions(answers: Answers, limit = 6): AssessmentItem[] {
  return observed(answers)
    .filter((item) => (answers[item.id] as number) >= 3)
    .sort((a, b) => (answers[b.id] as number) - (answers[a.id] as number) || ITEMS.indexOf(a) - ITEMS.indexOf(b))
    .slice(0, limit);
}

// Reavaliação: a cada 12 semanas, junto com a revisão do plano.
export const REASSESS_DAYS = 84;
export const reassessmentDue = (lastAppliedAt: Date | null, now: Date = new Date()) => !lastAppliedAt || now.getTime() - lastAppliedAt.getTime() > REASSESS_DAYS * 86_400_000;

// Números pequenos nos indicadores: abaixo de 5, mostra "menos de 5".
export const smallNumber = (count: number) => (count > 0 && count < 5 ? "menos de 5" : String(count));
