import type { FunctionalProfile, Objective, Student } from "@prisma/client";
import { applicableRules, type AdaptationRule } from "./rules";
import { parseJson } from "./format";
import { supportInfo } from "./scale";

// Motor de personalização (item 17.3): combina regras determinísticas com
// templates parametrizados pelo interesse âncora. Os agentes de IA (lib/agents,
// orquestrados com LangGraph) substituem os templates quando há chave; as regras
// obrigatórias valem nos dois caminhos. A IA nunca fecha o ciclo sozinha:
// ela propõe, o professor decide, o registro corrige.

export interface ActivityCard {
  title: string;
  context: "sala_comum" | "aee" | "casa";
  durationMinutes: number;
  materials: string[];
  steps: string[];
  responseForm: string;
  adaptations: { text: string; rule: string }[];
  supportBelow: string;
  supportTarget: string;
  supportAbove: string;
  successCriterion: string;
  planB: string;
  classParticipation?: string;
  reviewNotes?: string[]; // pendências apontadas pelo agente revisor
  source: "regras" | "ia";
}

export interface EngineInput {
  student: Student;
  profile: FunctionalProfile;
  objective: Objective;
  lessonTopic?: string;
}

function responseFormFor(profile: FunctionalProfile): string {
  const c = profile.expressiveChannel;
  if (c === "olhar_acionador") return "Olhar dirigido ou acionador (varredura entre opções)";
  if (c.startsWith("caa")) return "Apontar, entregar cartão ou indicar na prancha de comunicação";
  if (c === "libras") return "Resposta em Libras ou apontar";
  if (c === "gestos" || c === "vocalizacoes") return "Gesto, vocalização ou escolha entre 2 opções";
  return "Fala, escrita ou apontar";
}

function durationFor(profile: FunctionalProfile): number {
  const t = profile.taskToleranceMinutes;
  if (t <= 0) return 15;
  return Math.min(Math.max(t - 1, 4), 25);
}

function adaptationsFrom(rules: AdaptationRule[]): { text: string; rule: string }[] {
  return rules.filter((r) => r.id !== "R00-ANTISSEGREGACAO").map((r) => ({ text: r.then, rule: r.id }));
}

function supportLadder(objective: Objective, interest: string) {
  const current = supportInfo(objective.currentSupport);
  const target = supportInfo(objective.targetSupport);
  return {
    below: `Mais apoio (${current.code}): reduzir opções para 2 ou 3, destacar a resposta correta com cor e oferecer ${current.label.toLowerCase()} imediato.`,
    target: `Alvo (${target.code}): realizar a tarefa ${target.description.toLowerCase()}, mantendo o tema "${interest}" como âncora.`,
    above: `Menos apoio: retirar a pista, aumentar o número de itens e generalizar para outro contexto (outro colega, outro material, outro momento da rotina).`,
  };
}

export function generateActivityCards(input: EngineInput): ActivityCard[] {
  const { student, profile, objective, lessonTopic } = input;
  const firstName = student.name.split(" ")[0];
  const interests = parseJson<string[]>(profile.interests, []);
  const interest = interests[0] ?? "tema preferido do estudante";
  const rules = applicableRules(profile);
  const adaptations = adaptationsFrom(rules);
  const responseForm = responseFormFor(profile);
  const duration = durationFor(profile);
  const ladder = supportLadder(objective, interest);
  const topic = lessonTopic?.trim() || "o conteúdo da aula da turma";
  const shortPause = profile.taskToleranceMinutes > 0 && profile.taskToleranceMinutes < 10;
  const goal = objective.action;

  const common: ActivityCard = {
    title: `${topic[0].toUpperCase()}${topic.slice(1)} com âncora em ${interest}`,
    context: "sala_comum",
    durationMinutes: duration,
    materials: [
      "Material da própria aula da turma",
      `Cartões ou itens visuais do tema "${interest}"`,
      profile.expressiveChannel.startsWith("caa") ? "Prancha de comunicação do estudante" : "Quadro de apoio visual",
    ],
    steps: [
      `Apresente ${topic} para a turma toda, como de costume.`,
      `Entregue a ${firstName} a mesma tarefa com o corpus do tema "${interest}".`,
      "Dê um comando por vez, aguardando a resposta.",
      `Registre a resposta pela forma aceita: ${responseForm.toLowerCase()}.`,
      shortPause ? "Ofereça pausa breve ao fim do bloco e retome." : "Acompanhe e reduza o apoio conforme a resposta.",
    ],
    responseForm,
    adaptations,
    supportBelow: ladder.below,
    supportTarget: ladder.target,
    supportAbove: ladder.above,
    successCriterion: objective.criterion,
    planB: `Se houver recusa, ofereça escolha entre duas formas de fazer a mesma tarefa e convide um colega mediador. Não retire ${firstName} da atividade da turma.`,
    classParticipation: `A turma inteira usa a mesma dinâmica; o tema "${interest}" entra como variação para todos (Desenho Universal para a Aprendizagem), sem tarefa separada para ${firstName}.`,
    source: "regras",
  };

  const aee: ActivityCard = {
    title: `Treino estruturado: ${goal}`,
    context: "aee",
    durationMinutes: Math.min(duration, 20),
    materials: [
      `Fichas ou miniaturas do tema "${interest}"`,
      "Material concreto manipulável",
      "Cronômetro visual ou ampulheta",
    ],
    steps: [
      `Retome o objetivo com ${firstName}: ${goal}.`,
      `Estruture blocos de ${shortPause ? Math.max(3, Math.floor(duration / 2)) : duration} minutos com pausa entre eles.`,
      `Use o tema "${interest}" como reforço a cada acerto.`,
      "Modele a resposta uma vez e reduza o modelo nas tentativas seguintes.",
      "Anote o nível de apoio usado em cada tentativa.",
    ],
    responseForm,
    adaptations,
    supportBelow: ladder.below,
    supportTarget: ladder.target,
    supportAbove: ladder.above,
    successCriterion: objective.criterion,
    planB: "Se houver desregulação, use a estratégia de acalmar registrada no perfil e retome com o bloco mais curto.",
    source: "regras",
  };

  const home: ActivityCard = {
    title: `Em casa: ${goal} na rotina da família`,
    context: "casa",
    durationMinutes: Math.min(duration, 10),
    materials: [
      "Objetos da própria casa (sem material comprado)",
      `Itens que remetam a "${interest}"`,
    ],
    steps: [
      `Escolha um momento tranquilo da rotina (banho, refeição ou brincadeira).`,
      `Proponha a ${firstName} uma versão simples da tarefa: ${goal}.`,
      "Comemore cada tentativa, mesmo com ajuda.",
      "Registre no portal da família o que funcionou.",
    ],
    responseForm,
    adaptations: adaptations.slice(0, 2),
    supportBelow: ladder.below,
    supportTarget: ladder.target,
    supportAbove: ladder.above,
    successCriterion: "Participar da proposta ao menos 2 vezes na semana",
    planB: "Se a criança não quiser, encerre sem insistência e tente em outro momento do dia.",
    source: "regras",
  };

  return [common, aee, home];
}
