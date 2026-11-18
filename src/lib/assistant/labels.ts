import { roleGroup, type Group, type Role } from "../roles.ts";

const TEACHER_SUGGESTIONS = [
  "Como está o acompanhamento do meu estudante?",
  "Prepare uma atividade para a aula de hoje",
  "Quero registrar a aula de agora",
  "O que é a escala de apoio?",
];

const SUGGESTIONS: Record<Group, string[]> = {
  familia: [
    "O que a escola está trabalhando com meu filho?",
    "Que atividade posso fazer em casa hoje?",
    "Quero contar uma conquista de casa",
    "O que significa “nível de apoio”?",
  ],
  terapeuta: [
    "O que a escola registrou sobre a comunicação?",
    "Quero enviar orientações para a escola",
    "Como transformo uma observação clínica em orientação para a sala?",
  ],
  rede: [
    "Quais escolas têm mais estudantes com aviso?",
    "Como está o acompanhamento da rede este ano?",
    "Que estratégias mais funcionaram na rede?",
  ],
  escola: [
    "Quais estudantes precisam de atenção?",
    "Como está o acompanhamento este ano?",
    "Que estratégias mais funcionaram na rede?",
    "Quais datas inclusivas vêm aí?",
  ],
  professor: TEACHER_SUGGESTIONS,
  plataforma: TEACHER_SUGGESTIONS,
};

export const suggestionsFor = (role: Role): string[] => SUGGESTIONS[roleGroup(role)];
