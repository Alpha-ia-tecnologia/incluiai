import { supportInfo } from "./scale";

// Gerador de objetivo observável (item 17.3, Etapa B):
// [Quem] + [ação observável] + [condição/apoio] + [critério] + [prazo]

export interface ObjectiveParts {
  studentName: string;
  action: string;
  condition: string;
  criterion: string;
  deadlineWeeks: number;
  currentSupport: number;
}

export function buildObjectiveDescription(p: ObjectiveParts): string {
  const firstName = p.studentName.split(" ")[0];
  const support = supportInfo(p.currentSupport);
  return `${firstName} ${p.action}, ${p.condition} (${support.code}), em ${p.criterion}, ao longo de ${p.deadlineWeeks} semanas.`;
}

// Sugestões de ação por dimensão, para preenchimento rápido no formulário.
export const ACTION_SUGGESTIONS: Record<string, string[]> = {
  comunicacao: [
    "comunicará três necessidades da rotina escolar",
    "responderá a perguntas de sim/não sobre a rotina",
    "solicitará ajuda ou pausa usando seu canal de comunicação",
  ],
  leitura: [
    "identificará o próprio nome entre 5 opções",
    "lerá palavras com sílabas simples do seu campo de interesse",
    "responderá questões de interpretação de texto adaptado",
  ],
  escrita: [
    "escreverá palavras com sílabas simples do seu campo de interesse",
    "montará palavras com fichas silábicas",
    "registrará uma ideia por meio de escrita, desenho ou prancha",
  ],
  matematica: [
    "contará objetos até 10 em situação concreta",
    "resolverá adições simples com material concreto",
    "identificará números em contextos da rotina",
  ],
  interacao: [
    "participará de uma atividade em dupla com mediação reduzida",
    "aguardará sua vez em jogo de turnos",
    "iniciará uma interação com um colega",
  ],
  autonomia: [
    "organizará o próprio material ao final da aula",
    "realizará a rotina de chegada seguindo apoio visual",
    "fará a transição entre atividades com aviso antecipado",
  ],
  regulacao: [
    "usará uma estratégia de autorregulação diante de sinal de desconforto",
    "solicitará pausa antes de se desorganizar",
    "retomará a atividade após pausa programada",
  ],
};

export const CONDITION_SUGGESTIONS: string[] = [
  "com pista visual",
  "com instrução verbal",
  "com modelo do professor",
  "com apoio físico parcial",
  "com supervisão",
  "de forma independente",
  "usando prancha de comunicação",
  "usando acionador",
];

export const CRITERION_SUGGESTIONS: string[] = [
  "4 de 5 tentativas",
  "3 de 5 tentativas",
  "2 vezes por semana",
  "80% das aulas",
  "3 situações diferentes",
];
