import type { FunctionalProfile, Student } from "@prisma/client";
import { parseJson } from "./format";
import { supportInfo } from "./scale";

// Perguntas para reunião (item 9) — aponta o que a equipe precisa discutir,
// sem conclusões automáticas. Determinístico e auditável.
export function meetingQuestions(input: {
  alerts: { message: string }[];
  stalledObjectives: string[];
  workedStrategies: string[];
  hasFamilyNote: boolean;
  hasIntersector: boolean;
}): string[] {
  const q: string[] = [];
  for (const a of input.alerts) {
    if (a.message.includes("plano")) q.push("O plano precisa ser revisado ou os prazos ajustados?");
    else if (a.message.includes("registro")) q.push("O que explica a ausência de registros recentes? Como retomar o acompanhamento?");
    else if (a.message.includes("participação")) q.push("A queda de participação é situacional? Vale revisar o nível de apoio ou o interesse âncora?");
  }
  for (const obj of input.stalledObjectives) {
    q.push(`O objetivo "${obj}" está sem avanço — o próximo passo está grande demais? Vale fracionar?`);
  }
  if (input.workedStrategies.length > 0) {
    q.push(`As estratégias que funcionaram (${input.workedStrategies.slice(0, 3).join(", ")}) podem ser generalizadas para outros contextos?`);
  }
  if (input.hasIntersector) q.push("Como incorporar as orientações do relatório de articulação intersetorial no planejamento?");
  if (!input.hasFamilyNote) q.push("O que a família tem observado em casa? Como aproximar o registro familiar?");
  if (q.length === 0) q.push("O acompanhamento está estável — quais metas ampliar para o próximo ciclo?");
  return q;
}

// Materiais acessíveis (item 17.10) — estruturas geradas a partir do perfil.
export type MaterialKind = "rotina_visual" | "historia_social" | "prancha_caa";

export const MATERIAL_KINDS: { kind: MaterialKind; label: string; description: string }[] = [
  { kind: "rotina_visual", label: "Rotina visual", description: "Sequência de passos com apoio visual e aviso de transição." },
  { kind: "historia_social", label: "História social", description: "Narrativa curta em 1ª pessoa que prepara para uma situação." },
  { kind: "prancha_caa", label: "Prancha de comunicação", description: "Cartões de comunicação alternativa por temas da rotina." },
];

export interface MaterialContent {
  intro: string;
  cards: { label: string; hint?: string }[];
}

export function buildMaterial(kind: MaterialKind, student: Student, profile: FunctionalProfile): { title: string; content: MaterialContent } {
  const first = student.name.split(" ")[0];
  const interests = parseJson<string[]>(profile.interests, []);
  const theme = interests[0] ?? "tema preferido";
  const support = supportInfo(profile.organization);

  if (kind === "rotina_visual") {
    return {
      title: `Rotina visual de ${first}`,
      content: {
        intro: `Rotina com aviso de transição 2 minutos antes de cada troca (${support.label.toLowerCase()}). Ilustre cada passo com o tema "${theme}".`,
        cards: [
          { label: "Chegar e guardar a mochila", hint: "Foto do armário" },
          { label: "Sentar no lugar marcado", hint: "Cartão com o nome" },
          { label: "Primeira atividade", hint: `Ícone do tema ${theme}` },
          { label: "Pausa combinada", hint: "Ampulheta / relógio visual" },
          { label: "Segunda atividade", hint: "Ícone da tarefa" },
          { label: "Guardar materiais e sair", hint: "Foto da porta" },
        ],
      },
    };
  }
  if (kind === "historia_social") {
    return {
      title: `História social: um dia na escola — ${first}`,
      content: {
        intro: "Leia com o estudante antes da situação. Frases curtas, em 1ª pessoa, tom tranquilo.",
        cards: [
          { label: `Eu sou o(a) ${first} e vou para a escola.` },
          { label: "Na escola tem barulho às vezes. Se ficar alto, eu posso usar meu fone." },
          { label: "Quando a atividade muda, a professora me avisa antes." },
          { label: `Eu gosto de ${theme}. Às vezes a atividade tem ${theme}.` },
          { label: "Se eu precisar de ajuda, eu mostro na minha prancha ou peço." },
          { label: "No fim do dia eu guardo meus materiais e vou para casa. Foi um bom dia." },
        ],
      },
    };
  }
  return {
    title: `Prancha de comunicação de ${first}`,
    content: {
      intro: `Cartões de comunicação alternativa (${profile.expressiveChannel}). Imprima, plastifique e organize por temas.`,
      cards: [
        { label: "Sim" }, { label: "Não" }, { label: "Quero" }, { label: "Acabou" },
        { label: "Ajuda" }, { label: "Pausa" }, { label: "Banheiro" }, { label: "Água" },
        { label: "Dói" }, { label: "Mais" }, { label: `${theme}`, hint: "Interesse âncora" }, { label: "Casa" },
      ],
    },
  };
}
