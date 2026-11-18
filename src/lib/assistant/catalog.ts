import type { Group } from "../roles.ts";
import { MATERIAL_ACTIVITIES } from "../pedagogy-rules.ts";
import type { ToolScene } from "./garden-scenes.ts";

export type ByGroup<T> = T | Partial<Record<Group, T>>;

export function forGroup<T extends string | ((...args: never[]) => unknown)>(value: ByGroup<T>, group: Group): T | undefined {
  return typeof value === "object" ? value[group] : value;
}

type CatalogEntry = {
  groups: readonly Group[];
  prompt: ByGroup<string>;
  step: { running: string; done: string };
  scene: ToolScene;
};

export const NO_NAMES_HINT = "Os dados chegam à IA sem nomes.";
const SAVE_GATE = "Nada é gravado sem a sua confirmação.";
const SEND_GATE = "Nada é enviado sem a sua confirmação.";

const TEAM: readonly Group[] = ["professor", "escola"];
const STAFF: readonly Group[] = ["professor", "escola", "rede"];
const EVERYONE: readonly Group[] = ["professor", "escola", "rede", "familia", "terapeuta", "plataforma"];

const CONFIRM_ON_CARD = "preparam uma ação que só acontece depois que a pessoa confirma em um cartão na tela. Depois de chamar uma delas, diga em uma frase que o cartão está pronto para confirmação e não chame a mesma ferramenta de novo para o mesmo pedido.";
const DATES_FOR_CLASS = "próximas datas comemorativas com ideias para a turma.";
const DATES = "próximas datas comemorativas.";

export const TOOL_CATALOG = {
  buscar_estudantes: {
    groups: TEAM,
    prompt: "lista os estudantes que a pessoa pode ver, com o marcador, o id e o próximo passo. Use quando não souber a qual estudante a pessoa se refere ou para ter uma visão geral.",
    step: { running: "Consultando os estudantes", done: "Consultou os estudantes" },
    scene: { family: "raizes", wait: "Consultando a lista de estudantes…", hint: NO_NAMES_HINT, pebble: "sky" },
  },
  ver_estudante: {
    groups: TEAM,
    prompt: "resumo completo de um estudante (jornada, avisos, plano e objetivos com ids e tendência, como aprende, registros, atividades, família e saúde). Use antes de responder sobre um estudante específico.",
    step: { running: "Lendo o acompanhamento do estudante", done: "Leu o acompanhamento do estudante" },
    scene: { family: "raizes", wait: "Lendo o acompanhamento…", hint: NO_NAMES_HINT, pebble: "teal" },
  },
  ver_atividades: {
    groups: TEAM,
    prompt: "as atividades de um estudante, com passos e materiais, para orientar a aula de hoje.",
    step: { running: "Consultando as atividades", done: "Consultou as atividades" },
    scene: { family: "raizes", wait: "Consultando as atividades…", hint: NO_NAMES_HINT, pebble: "peach" },
  },
  proximos_passos_dua: {
    groups: TEAM,
    prompt: "próximos passos sugeridos a partir das evidências das atividades planejadas com DUA (/planejamento), cada um com a base usada e o que ainda precisa ser observado. Apresente sempre como recomendações para a equipe revisar: recomendação não é decisão profissional, e nenhuma delas é resultado observado.",
    step: { running: "Consultando os próximos passos do DUA", done: "Consultou os próximos passos do DUA" },
    scene: { family: "raizes", wait: "Consultando os próximos passos do DUA…", hint: "Recomendações para a equipe revisar.", pebble: "sage" },
  },
  propor_plano: {
    groups: TEAM,
    prompt: "pede aos agentes de IA uma proposta de plano (PPI). Demora de 1 a 3 minutos e tem custo. A proposta fica em /estudantes/ID/ppi#proposta para revisão.",
    step: { running: "Preparando a proposta de plano com os agentes", done: "Preparou a proposta de plano" },
    scene: { family: "trelica", wait: "Preparando a proposta de plano…", long: "plano" },
  },
  gerar_atividades: {
    groups: TEAM,
    prompt: "cria 3 sugestões de atividade (sala comum, AEE e casa) para um objetivo e um conteúdo da aula. Demora de 1 a 3 minutos (com imagens, cerca de 1 minuto a mais) e tem custo. Exige o id do objetivo e o conteúdo da aula: se faltar, pergunte antes de chamar.",
    step: { running: "Criando as 3 sugestões de atividade com os agentes", done: "Criou as sugestões de atividade" },
    scene: { family: "botoes", wait: "Criando 3 sugestões de atividade…", long: "atividades" },
  },
  criar_material: {
    groups: TEAM,
    prompt: `cria um material de apoio a partir do perfil (rotina visual, passo a passo, história social, prancha de comunicação, quadro de escolhas ou autorregulação), com ${MATERIAL_ACTIVITIES.min} a ${MATERIAL_ACTIVITIES.max} atividades para aplicar. Passe o tema (a situação) e use imagens=true quando a pessoa pedir imagem, figura ou desenho.`,
    step: { running: "Montando o material de apoio", done: "Montou o material de apoio" },
    scene: { family: "folha", wait: "Montando o material de apoio…", hint: "Fica em Materiais de apoio para revisar e aprovar." },
  },
  registrar_aula: {
    groups: TEAM,
    prompt: CONFIRM_ON_CARD,
    step: { running: "Preparando o registro da aula", done: "Preparou o registro da aula" },
    scene: { family: "vasinho", wait: "Preparando o registro da aula…", hint: SAVE_GATE },
  },
  decidir_atividade: {
    groups: TEAM,
    prompt: CONFIRM_ON_CARD,
    step: { running: "Preparando a decisão sobre a atividade", done: "Preparou a decisão sobre a atividade" },
    scene: { family: "vasinho", wait: "Preparando a decisão sobre a atividade…", hint: SAVE_GATE },
  },
  marcar_objetivo: {
    groups: TEAM,
    prompt: CONFIRM_ON_CARD,
    step: { running: "Preparando a mudança do objetivo", done: "Preparou a mudança do objetivo" },
    scene: { family: "vasinho", wait: "Preparando a mudança do objetivo…", hint: SAVE_GATE },
  },
  buscar_recursos: {
    groups: STAFF,
    prompt: "banco municipal de recursos e atividades.",
    step: { running: "Consultando o banco de recursos", done: "Consultou o banco de recursos" },
    scene: { family: "raizes", wait: "Consultando o banco de recursos…", hint: "Práticas já usadas na rede, com resultados.", pebble: "sage" },
  },
  indicadores: {
    groups: STAFF,
    prompt: "números do painel (jornada, avisos, aulas, atividades, IA) para o recorte da pessoa.",
    step: { running: "Consultando o painel", done: "Consultou o painel" },
    scene: { family: "raizes", wait: "Consultando o painel…", hint: "Números do painel, sem nomes.", pebble: "lime" },
  },
  meu_estudante: {
    groups: ["familia", "terapeuta"],
    prompt: {
      familia: "o que a escola está trabalhando, as atividades para casa com o passo a passo, as conquistas registradas pela escola e o que a família já contou.",
      terapeuta: "comunicação, interesses e apoios registrados pela escola e os relatórios já enviados.",
    },
    step: { running: "Consultando o acompanhamento", done: "Consultou o acompanhamento" },
    scene: { family: "raizes", wait: "Consultando o acompanhamento…", hint: NO_NAMES_HINT, pebble: "teal" },
  },
  contar_conquista: {
    groups: ["familia"],
    prompt: "prepara o envio de uma conquista de casa para a equipe; a família confirma no cartão antes de enviar. Depois de chamar, diga que o cartão está pronto e não chame de novo.",
    step: { running: "Preparando a conquista para enviar", done: "Preparou a conquista para enviar" },
    scene: { family: "vasinho", wait: "Preparando a conquista para enviar…", hint: SEND_GATE },
  },
  enviar_orientacoes: {
    groups: ["terapeuta"],
    prompt: "prepara um relatório de articulação intersetorial (comunicação eficaz, recursos de acessibilidade, posicionamento, facilitadores, estratégias a testar, orientações à escola e objetivos compartilhados); o terapeuta confirma no cartão antes de enviar. Depois de chamar, diga que o cartão está pronto e não chame de novo.",
    step: { running: "Preparando o relatório", done: "Preparou o relatório" },
    scene: { family: "vasinho", wait: "Preparando o relatório…", hint: SEND_GATE },
  },
  datas_inclusivas: {
    groups: EVERYONE,
    prompt: { professor: DATES_FOR_CLASS, escola: DATES_FOR_CLASS, rede: DATES_FOR_CLASS, familia: DATES, terapeuta: DATES },
    step: { running: "Consultando o calendário", done: "Consultou o calendário" },
    scene: { family: "raizes", wait: "Consultando o calendário…", hint: "Datas com ideias para a turma toda.", pebble: "rose" },
  },
} satisfies Record<string, CatalogEntry>;

export type ToolName = keyof typeof TOOL_CATALOG;

const ENTRIES: Record<ToolName, CatalogEntry> = TOOL_CATALOG;
const NAMES = Object.keys(ENTRIES) as ToolName[];

const entryOf = (name: string): CatalogEntry | undefined => (Object.hasOwn(ENTRIES, name) ? ENTRIES[name as ToolName] : undefined);

export const toolNames = (group: Group): ToolName[] => NAMES.filter((name) => ENTRIES[name].groups.includes(group));

export const runningLabel = (name: string): string => entryOf(name)?.step.running ?? name;

export const doneLabel = (name: string): string | undefined => entryOf(name)?.step.done;

export const sceneOf = (name: string): ToolScene | undefined => entryOf(name)?.scene;

const listed = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0]);

export function toolGuide(group: Group): string[] {
  const lines: { names: string[]; text: string }[] = [];
  for (const name of toolNames(group)) {
    const text = forGroup(ENTRIES[name].prompt, group);
    if (!text) continue;
    const last = lines.at(-1);
    if (last?.text === text) last.names.push(name);
    else lines.push({ names: [name], text });
  }
  return lines.map(({ names, text }) => `- ${listed(names)}: ${text}`);
}

export const CONVERSATION_PARAM = "c";
export const conversationHref = (id?: string | null) => (id ? `/assistente?${CONVERSATION_PARAM}=${encodeURIComponent(id)}` : "/assistente");
