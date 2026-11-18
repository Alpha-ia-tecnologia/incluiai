import { ACTIVITY_CONTEXTS, ACTIVITY_STEPS, HOME_MAX_MINUTES, MATERIAL_ACTIVITIES, activityMinutesLimit, checkActivity, hasClinicalTerm, isActivityContext, type ActivityContext } from "./pedagogy-rules.ts";
import { CONTEXTS } from "./scale.ts";

export const MATERIAL_KIND_KEYS = ["rotina_visual", "sequencia_tarefa", "historia_social", "prancha_caa", "quadro_escolhas", "regulacao"] as const;
export type MaterialKind = (typeof MATERIAL_KIND_KEYS)[number];

export const MATERIAL_KINDS: { kind: MaterialKind; label: string; description: string; cards: [number, number] }[] = [
  { kind: "rotina_visual", label: "Rotina visual", description: "A sequência de uma situação, com aviso antes de cada troca.", cards: [4, 8] },
  { kind: "sequencia_tarefa", label: "Passo a passo de uma tarefa", description: "Uma tarefa dividida em ações curtas, uma por cartão.", cards: [3, 8] },
  { kind: "historia_social", label: "História social", description: "Narrativa curta em 1ª pessoa que prepara para uma situação.", cards: [5, 8] },
  { kind: "prancha_caa", label: "Prancha de comunicação", description: "Cartões para pedir, escolher e comentar durante a atividade.", cards: [8, 16] },
  { kind: "quadro_escolhas", label: "Quadro de escolhas", description: "Opções visuais para escolher como participar ou o que fazer primeiro.", cards: [2, 6] },
  { kind: "regulacao", label: "Cartões de autorregulação", description: "Como estou e o que me ajuda: termômetro e estratégias de calma.", cards: [4, 8] },
];
export const MAX_MATERIAL_IMAGES = 12;
export const materialImageUrl = (materialId: string, index: number, at: Date) => `/api/materiais/${materialId}/imagens/${index}?v=${at.getTime()}`;

export const MATERIAL_KIND_LABEL = Object.fromEntries(MATERIAL_KINDS.map((item) => [item.kind, item.label])) as Record<MaterialKind, string>;
export const isMaterialKind = (value: string): value is MaterialKind => MATERIAL_KINDS.some((item) => item.kind === value);

export const MATERIAL_CONTEXTS = ACTIVITY_CONTEXTS.map((value) => ({ value, label: CONTEXTS[value].label }));

export const MATERIAL_TOPICS = [
  "Chegada à escola", "Hora do lanche", "Ida ao banheiro", "Troca de sala ou de atividade", "Recreio",
  "Leitura compartilhada", "Atividade de matemática", "Educação física", "Lavar as mãos", "Fim do dia e saída",
];

export type MaterialCard = { label: string; caption?: string; visual: string; alt: string };
export type MaterialActivity = {
  title: string;
  context: ActivityContext;
  durationMinutes: number;
  goal: string;
  materials: string[];
  steps: string[];
  responseForms: string[];
  supportBelow: string;
  supportTarget: string;
  supportAbove: string;
  successCriterion: string;
  planB: string;
  classParticipation?: string;
  record?: string;
};
export type MaterialAdaptation = { text: string; basis: string };
export type MaterialContent = {
  version: 2;
  purpose: string;
  intro: string;
  cards: MaterialCard[];
  preparation: string[];
  howToUse: string[];
  activities: MaterialActivity[];
  adaptations: MaterialAdaptation[];
  accessibility: string[];
  familyTip: string;
  reviewNotes: string[];
};

export function normalizeMaterialContent(value: unknown): MaterialContent {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const list = <T>(item: unknown): T[] => (Array.isArray(item) ? (item as T[]) : []);
  const text = (item: unknown) => (typeof item === "string" ? item : "");
  return {
    version: 2,
    purpose: text(raw.purpose),
    intro: text(raw.intro),
    cards: list<Record<string, unknown>>(raw.cards).map((card) => ({
      label: text(card.label),
      caption: text(card.caption) || text(card.hint) || undefined,
      visual: text(card.visual) || text(card.hint) || text(card.label),
      alt: text(card.alt) || text(card.label),
    })).filter((card) => card.label),
    preparation: list<string>(raw.preparation).filter((item) => typeof item === "string"),
    howToUse: list<string>(raw.howToUse).filter((item) => typeof item === "string"),
    activities: list<MaterialActivity>(raw.activities).filter((item) => item && typeof item.title === "string"),
    adaptations: list<MaterialAdaptation>(raw.adaptations).filter((item) => item && typeof item.text === "string"),
    accessibility: list<string>(raw.accessibility).filter((item) => typeof item === "string"),
    familyTip: text(raw.familyTip),
    reviewNotes: list<string>(raw.reviewNotes).filter((item) => typeof item === "string"),
  };
}

export type ProfileFacts = {
  firstName: string;
  expressiveChannel: string;
  expressiveLabel: string;
  receptiveLabel: string;
  commandSteps: number;
  attentionMinutes: number;
  toleranceMinutes: number;
  interests: string[];
  calming: string[];
  triggers: string[];
  sensitiveTo: string[];
  readingSupport: number;
  fineMotorSupport: number;
  usesWheelchair: boolean;
  strengths: string;
};

const SUPPORT_LADDER = ["Independente", "Supervisão ou lembrete", "Instrução verbal ou pista visual", "Modelo ou demonstração", "Apoio físico parcial", "Apoio físico total"];
const clampLevel = (level: number) => Math.min(5, Math.max(0, Math.round(level)));

function responseFormsFor(facts: Pick<ProfileFacts, "expressiveChannel" | "fineMotorSupport">): string[] {
  const channel = facts.expressiveChannel;
  if (channel === "olhar_acionador") return ["Olhar dirigido para o cartão", "Acionador com varredura entre opções"];
  if (channel.startsWith("caa")) return ["Apontar o cartão", "Entregar o cartão", "Indicar na prancha de comunicação"];
  if (channel === "libras") return ["Responder em Libras", "Apontar o cartão"];
  if (channel === "gestos" || channel === "vocalizacoes") return ["Apontar ou tocar o cartão", "Gesto combinado", "Vocalização com confirmação do adulto"];
  return facts.fineMotorSupport >= 3 ? ["Falar a resposta", "Apontar o cartão"] : ["Falar a resposta", "Apontar ou mover o cartão", "Escrever ou desenhar, se quiser"];
}

export function profileAdaptations(facts: ProfileFacts, kind: MaterialKind): MaterialAdaptation[] {
  const out: MaterialAdaptation[] = [];
  if (facts.commandSteps <= 1) out.push({ text: "Uma ação por cartão e uma instrução de cada vez, com o cartão à vista.", basis: `Como aprende: compreende comandos de ${facts.commandSteps} etapa.` });
  else out.push({ text: `Instruções com até ${facts.commandSteps} etapas, apoiadas nos cartões.`, basis: `Como aprende: compreende comandos de ${facts.commandSteps} etapas.` });
  out.push({ text: `Atividades de até ${facts.toleranceMinutes} minutos, com pausa combinada.`, basis: `Como aprende: permanece na tarefa por cerca de ${facts.toleranceMinutes} min.` });
  if (facts.interests.length) out.push({ text: `Tema visual dos cartões e exemplos com ${facts.interests.slice(0, 2).join(" e ")}.`, basis: `Como aprende: interesses âncora (${facts.interests.slice(0, 3).join(", ")}).` });
  if (facts.sensitiveTo.includes("visual")) out.push({ text: "Poucos elementos por cartão, cores suaves e fundo liso.", basis: "Como aprende: mais sensível a estímulos visuais." });
  if (facts.sensitiveTo.includes("auditiva")) out.push({ text: "Avisar as trocas pelo cartão, sem depender de sinal sonoro; ter o recurso de redução de ruído à mão.", basis: "Como aprende: mais sensível a estímulos sonoros." });
  if (facts.triggers.some((item) => /mudan|transi|troca|imprevist/i.test(item)) || kind === "rotina_visual") out.push({ text: "Mostrar o próximo cartão 2 minutos antes de cada troca.", basis: facts.triggers.length ? `Como aprende: situações de desconforto (${facts.triggers.slice(0, 2).join(", ")}).` : "Rotina visual: antecipar as trocas." });
  if (facts.calming.length) out.push({ text: `Pausa com ${facts.calming[0].toLowerCase()} quando aparecerem sinais de cansaço.`, basis: `Como aprende: o que ajuda a se acalmar (${facts.calming.slice(0, 2).join(", ")}).` });
  out.push({ text: `Formas de resposta aceitas: ${responseFormsFor(facts).join("; ").toLowerCase()}.`, basis: `Como aprende: expressa-se por ${facts.expressiveLabel.toLowerCase()}.` });
  if (facts.readingSupport >= 3) out.push({ text: "Texto curto em letra grande, sempre junto do pictograma; o adulto lê em voz alta.", basis: `Como aprende: apoio na leitura (${SUPPORT_LADDER[clampLevel(facts.readingSupport)].toLowerCase()}).` });
  return out;
}

export const ACCESSIBILITY_BY_KIND: Record<MaterialKind, string[]> = {
  rotina_visual: ["Um pictograma por cartão", "Texto curto em letra grande", "Ordem da esquerda para a direita", "Espaço para marcar o que já foi feito"],
  sequencia_tarefa: ["Uma ação por cartão", "Numeração grande", "Texto curto em letra grande", "Cartões podem ser recortados e reordenados"],
  historia_social: ["Frases curtas em 1ª pessoa", "Uma ideia por página", "Ilustração em cada frase", "Leitura em voz alta pelo adulto"],
  prancha_caa: ["Pictogramas grandes", "Cores por categoria de palavra", "Respostas por apontamento", "Pode ser plastificada"],
  quadro_escolhas: ["Poucas opções por vez", "Opções lado a lado, do mesmo tamanho", "Escolha por apontamento ou olhar"],
  regulacao: ["Cores e expressões simples", "Escala em poucos níveis", "Estratégia concreta em cada cartão", "Fica à mão durante toda a atividade"],
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const TEXT_IN_IMAGE = /\b(com|contendo|mostrando|escrev\w*)\s+(o |a |um |uma )?(texto|palavras?|frase|legenda|letreiro|nome)\b|\blegenda\b|\bletreiro\b/i;

type MaterialRules = { kind: MaterialKind; toleranceMinutes: number };

export function checkMaterialCards(cards: MaterialCard[], kind: MaterialKind): string[] {
  const problems: string[] = [];
  const range = MATERIAL_KINDS.find((item) => item.kind === kind)?.cards ?? [3, 12];
  if (cards.length < range[0] || cards.length > range[1]) problems.push(`Use de ${range[0]} a ${range[1]} cartões (vieram ${cards.length}).`);
  const limit = kind === "historia_social" ? 20 : 8;
  const longCards = cards.filter((card) => words(card.label) > limit);
  if (longCards.length) problems.push(`${longCards.length} cartão(ões) com texto longo: no máximo ${limit} palavras por cartão.`);
  if (cards.some((card) => !card.visual.trim() || TEXT_IN_IMAGE.test(card.visual))) problems.push("Toda descrição visual deve mostrar uma cena ou objeto, sem pedir texto escrito na imagem.");
  return problems;
}

export function checkMaterial(content: MaterialContent, rules: MaterialRules): string[] {
  const problems = checkMaterialCards(content.cards, rules.kind);
  if (content.activities.length < MATERIAL_ACTIVITIES.min || content.activities.length > MATERIAL_ACTIVITIES.max) problems.push(`Proponha de ${MATERIAL_ACTIVITIES.min} a ${MATERIAL_ACTIVITIES.max} atividades para aplicar o material (vieram ${content.activities.length}).`);
  for (const activity of content.activities) problems.push(...checkActivity(activity, rules.toleranceMinutes));
  if (!content.adaptations.length || content.adaptations.some((item) => !item.basis.trim())) problems.push("Cada adaptação precisa dizer em que item do perfil se baseia.");
  if (hasClinicalTerm(content)) problems.push("Retire linguagem clínica ou menção a diagnóstico.");
  return problems;
}

const clip = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const clipList = (value: unknown, maxItems: number, maxChars: number) => (Array.isArray(value) ? value.map((item) => clip(item, maxChars)).filter(Boolean).slice(0, maxItems) : []);

export function finalizeMaterial(content: MaterialContent, rules: MaterialRules): MaterialContent {
  const range = MATERIAL_KINDS.find((item) => item.kind === rules.kind)?.cards ?? [3, 12];
  return {
    version: 2,
    purpose: clip(content.purpose, 400),
    intro: clip(content.intro, 400),
    cards: content.cards.slice(0, range[1]).map((card) => ({ label: clip(card.label, 160), caption: clip(card.caption, 200) || undefined, visual: clip(card.visual, 300), alt: clip(card.alt, 200) || clip(card.label, 160) })),
    preparation: clipList(content.preparation, 6, 240),
    howToUse: clipList(content.howToUse, 8, 300),
    activities: content.activities.slice(0, MATERIAL_ACTIVITIES.max).map((activity) => {
      const context = isActivityContext(activity.context) ? activity.context : "aee";
      const max = activityMinutesLimit(context, rules.toleranceMinutes);
      return {
        title: clip(activity.title, 120),
        context,
        durationMinutes: Math.min(max, Math.max(3, Math.round(Number(activity.durationMinutes)) || 10)),
        goal: clip(activity.goal, 300),
        materials: clipList(activity.materials, 8, 120),
        steps: clipList(activity.steps, ACTIVITY_STEPS.max, 240),
        responseForms: clipList(activity.responseForms, 5, 120),
        supportBelow: clip(activity.supportBelow, 240),
        supportTarget: clip(activity.supportTarget, 240),
        supportAbove: clip(activity.supportAbove, 240),
        successCriterion: clip(activity.successCriterion, 240),
        planB: clip(activity.planB, 300),
        classParticipation: context === "sala_comum" ? clip(activity.classParticipation, 300) || undefined : undefined,
        record: clip(activity.record, 300) || undefined,
      };
    }),
    adaptations: (content.adaptations ?? []).map((item) => ({ text: clip(item.text, 240), basis: clip(item.basis, 200) })).filter((item) => item.text).slice(0, 12),
    accessibility: clipList(content.accessibility, 8, 120),
    familyTip: clip(content.familyTip, 400),
    reviewNotes: clipList(content.reviewNotes, 8, 240),
  };
}

type RulesInput = { kind: MaterialKind; topic: string; context: ActivityContext; objective: string | null; facts: ProfileFacts };

const SITUATION_STEPS: Record<string, string[]> = {
  "Chegada à escola": ["Chegar e cumprimentar", "Guardar a mochila", "Pendurar o casaco", "Sentar no lugar marcado", "Olhar a rotina do dia"],
  "Hora do lanche": ["Lavar as mãos", "Pegar o lanche", "Sentar à mesa", "Comer com calma", "Jogar o lixo fora", "Guardar a lancheira"],
  "Ida ao banheiro": ["Pedir para ir ao banheiro", "Ir até o banheiro", "Usar o vaso", "Dar descarga", "Lavar as mãos", "Voltar para a sala"],
  "Troca de sala ou de atividade": ["Ouvir o aviso da troca", "Guardar o material", "Fazer fila com a turma", "Ir para o novo lugar", "Sentar e começar"],
  "Recreio": ["Guardar o material", "Sair com a turma", "Brincar no lugar combinado", "Ouvir o sinal do fim", "Voltar para a sala"],
  "Leitura compartilhada": ["Sentar na roda", "Olhar a capa do livro", "Ouvir a história", "Mostrar o personagem", "Contar o que aconteceu"],
  "Atividade de matemática": ["Pegar o material de contagem", "Ouvir a pergunta", "Contar os objetos", "Mostrar a resposta", "Guardar o material"],
  "Educação física": ["Trocar de tênis", "Ir para a quadra", "Fazer o aquecimento", "Participar da brincadeira", "Beber água", "Voltar para a sala"],
  "Lavar as mãos": ["Abrir a torneira", "Molhar as mãos", "Passar sabonete", "Esfregar as mãos", "Enxaguar", "Secar as mãos"],
  "Fim do dia e saída": ["Guardar os materiais", "Pegar a mochila", "Despedir da turma", "Esperar o responsável", "Ir para casa"],
};

const firstLower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function situationSteps(topic: string): string[] {
  const known = SITUATION_STEPS[topic];
  if (known) return known;
  const theme = topic.trim() || "a atividade";
  return ["Preparar o lugar", `Começar: ${firstLower(theme)}`, "Fazer a primeira parte", "Pausa combinada", "Fazer a segunda parte", "Guardar e terminar"];
}

const visualOf = (label: string, theme: string) => `Pictograma de uma criança fazendo a ação: ${firstLower(label)}${theme ? `, com detalhes do tema ${theme}` : ""}.`;

function rulesCards(input: RulesInput): MaterialCard[] {
  const { kind, topic, facts } = input;
  const theme = facts.interests[0] ?? "";
  const situation = topic.trim() || "a atividade";
  if (kind === "rotina_visual" || kind === "sequencia_tarefa") {
    const steps = situationSteps(topic).slice(0, kind === "sequencia_tarefa" ? 6 : 8);
    return steps.map((label, index) => ({ label, caption: index === steps.length - 1 ? "Terminei!" : undefined, visual: visualOf(label, theme), alt: `Passo ${index + 1}: ${label}` }));
  }
  if (kind === "historia_social") {
    const help = facts.expressiveChannel.startsWith("caa") ? "eu mostro na minha prancha" : "eu peço ajuda";
    const calm = facts.calming[0] ? firstLower(facts.calming[0]) : "respirar devagar";
    const lines = [
      `Hoje vai ter ${firstLower(situation)}.`,
      "A professora me mostra o que vai acontecer.",
      "Às vezes pode ter barulho ou mudança. Tudo bem.",
      `Se eu ficar desconfortável, uma coisa que me ajuda é: ${calm}.`,
      `Se eu precisar, ${help}.`,
      theme ? `Eu gosto de ${theme}. Pensar em ${theme} me ajuda.` : "Eu faço uma parte de cada vez.",
      "Quando termina, eu fico contente com o que fiz.",
    ];
    return lines.map((label, index) => ({ label, visual: `Cena simples de uma criança na escola: ${firstLower(label)}`, alt: `Página ${index + 1}: ${label}` }));
  }
  if (kind === "prancha_caa") {
    const core = ["Sim", "Não", "Quero", "Não quero", "Ajuda", "Pausa", "Acabou", "Mais", "Água", "Banheiro"];
    const topicWords = SITUATION_STEPS[topic]?.slice(0, 3).map((step) => step.split(" ").slice(-1)[0]) ?? [];
    const extra = [...topicWords, ...(theme ? [theme] : [])].filter((word) => !core.includes(word)).slice(0, 4);
    return [...core, ...extra].map((label) => ({ label, visual: `Pictograma simples que representa: ${firstLower(label)}`, alt: `Cartão: ${label}` }));
  }
  if (kind === "quadro_escolhas") {
    const options = responseFormsFor(facts).slice(0, 3).map((form) => `Mostrar com: ${firstLower(form)}`);
    const choices = ["Fazer sozinho", "Fazer com um colega", "Fazer com a professora", ...(theme ? [`Usar o material de ${theme}`] : [])];
    return [...choices.slice(0, 3), ...options].slice(0, 6).map((label) => ({ label, visual: visualOf(label, theme), alt: `Opção: ${label}` }));
  }
  const strategies = (facts.calming.length ? facts.calming : ["Respirar devagar", "Beber água", "Apertar uma bolinha"]).slice(0, 3);
  return [
    { label: "Estou calmo", visual: "Rosto tranquilo e sorridente, cor verde suave", alt: "Termômetro: estou calmo" },
    { label: "Estou ficando incomodado", visual: "Rosto um pouco preocupado, cor amarela suave", alt: "Termômetro: estou ficando incomodado" },
    { label: "Preciso de uma pausa", visual: "Criança levantando a mão com um cartão de pausa, cor laranja suave", alt: "Termômetro: preciso de uma pausa" },
    ...strategies.map((strategy) => ({ label: strategy, visual: `Criança fazendo: ${firstLower(strategy)}`, alt: `O que me ajuda: ${strategy}` })),
  ];
}

function supportLadder(facts: ProfileFacts) {
  const current = clampLevel(Math.max(facts.readingSupport, 2));
  return {
    supportBelow: `${SUPPORT_LADDER[Math.min(5, current + 1)]}: o adulto faz junto, mostrando cada cartão.`,
    supportTarget: `${SUPPORT_LADDER[current]}: o estudante segue os cartões com a pista do adulto.`,
    supportAbove: `${SUPPORT_LADDER[Math.max(0, current - 1)]}: o estudante usa o material sozinho e só confere com o adulto.`,
  };
}

function rulesActivities(input: RulesInput, cards: MaterialCard[]): MaterialActivity[] {
  const { kind, context, facts, objective } = input;
  const minutes = Math.max(5, Math.min(facts.toleranceMinutes || 15, 20));
  const forms = responseFormsFor(facts);
  const ladder = supportLadder(facts);
  const calm = facts.calming[0] ? firstLower(facts.calming[0]) : "uma pausa curta";
  const theme = facts.interests[0];
  const goal = objective ? `Apoiar o objetivo: ${objective}` : `Participar de ${firstLower(input.topic.trim() || "a atividade")} com mais autonomia.`;
  const label = MATERIAL_KIND_LABEL[kind].toLowerCase();
  const practice: MaterialActivity = {
    title: `Conhecer ${kind === "historia_social" ? "a história" : `o material (${label})`}`,
    context: context === "casa" ? "casa" : "aee",
    durationMinutes: context === "casa" ? Math.min(HOME_MAX_MINUTES, minutes) : minutes,
    goal,
    materials: [`${MATERIAL_KIND_LABEL[kind]} impressa`, ...(theme ? [`Objeto ou figura de ${theme}`] : [])],
    steps: [
      "Mostrar o material inteiro e dizer para que serve.",
      `Apresentar um cartão de cada vez, começando por “${cards[0]?.label.replace(/[.!?]+$/, "") ?? "o primeiro"}”.`,
      "Pedir que o estudante mostre o cartão de cada momento.",
      "Repetir com o estudante conduzindo e o adulto conferindo.",
    ],
    responseForms: forms,
    ...ladder,
    successCriterion: `Indica o cartão certo em pelo menos ${Math.max(2, Math.ceil(cards.length / 2))} momentos, com o apoio previsto.`,
    record: "Registre quantos cartões o estudante indicou e qual apoio foi preciso.",
    planB: `Se aparecerem sinais de cansaço, oferecer ${calm} e retomar com menos cartões.`,
  };
  const inUse: MaterialActivity = context === "casa"
    ? {
        title: "Usar em casa com a família",
        context: "casa",
        durationMinutes: Math.min(HOME_MAX_MINUTES, minutes),
        goal,
        materials: [`${MATERIAL_KIND_LABEL[kind]} impressa`, "Fita adesiva para fixar à vista"],
        steps: ["Fixar o material num lugar à vista.", "Antes da situação, mostrar o material junto.", "Durante a situação, apontar o cartão de cada momento.", "No fim, comemorar o que deu certo."],
        responseForms: forms,
        ...ladder,
        successCriterion: "A família registra se o estudante usou os cartões na situação.",
        record: "Conte à escola em que momentos o material ajudou e em quais não.",
        planB: `Se não der certo, usar só os primeiros cartões e oferecer ${calm}.`,
      }
    : {
        title: "Usar na situação real, junto com a turma",
        context: "sala_comum",
        durationMinutes: minutes,
        goal,
        materials: [`${MATERIAL_KIND_LABEL[kind]} impressa`, "Cartões soltos para mover"],
        steps: ["Antes de começar, mostrar o material para o estudante.", "A cada momento, apontar o cartão correspondente.", "Avisar a troca mostrando o próximo cartão.", "No fim, o estudante marca o que já foi feito."],
        responseForms: forms,
        ...ladder,
        successCriterion: "Acompanha a situação usando os cartões, com no máximo a pista combinada.",
        record: "Registre em quais momentos o estudante usou os cartões e o apoio que foi preciso.",
        planB: `Se a situação ficar difícil, oferecer ${calm} e retomar a partir do último cartão.`,
        classParticipation: "A turma usa a mesma rotina no quadro, e um colega ajuda a virar os cartões.",
      };
  return [practice, inUse];
}

export function rulesMaterial(input: RulesInput): { title: string; content: MaterialContent } {
  const { kind, topic, facts } = input;
  const cards = rulesCards(input);
  const situation = topic.trim();
  const content: MaterialContent = {
    version: 2,
    purpose: `${MATERIAL_KIND_LABEL[kind]}${situation ? ` para ${firstLower(situation)}` : ""}: ${MATERIAL_KINDS.find((item) => item.kind === kind)!.description.toLowerCase()}`,
    intro: kind === "historia_social" ? "Leia com o estudante antes da situação, com calma, uma frase de cada vez." : "Apresente o material antes da situação e use os cartões durante ela.",
    cards,
    preparation: [
      "Imprima em papel firme, de preferência em tamanho A4.",
      kind === "historia_social" ? "Grampeie as páginas na ordem, como um livrinho." : "Recorte os cartões nas linhas e, se puder, plastifique.",
      "Deixe o material onde o estudante alcança e vê durante a situação.",
    ],
    howToUse: [
      "Apresente o material num momento tranquilo, antes de precisar dele.",
      "Use sempre as mesmas palavras dos cartões.",
      "Deixe o material à vista durante a situação.",
      "Reduza o apoio aos poucos, conforme o estudante ganha autonomia.",
    ],
    activities: rulesActivities(input, cards),
    adaptations: profileAdaptations(facts, kind),
    accessibility: ACCESSIBILITY_BY_KIND[kind],
    familyTip: `Mostre o material em casa antes da situação e comemore cada passo${facts.interests[0] ? `, usando ${facts.interests[0]} como incentivo` : ""}.`,
    reviewNotes: [],
  };
  return { title: `${MATERIAL_KIND_LABEL[kind]}${situation ? `: ${situation}` : ""}`, content };
}
