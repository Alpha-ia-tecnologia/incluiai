import type { AgentProgress, ToolStep } from "./types";
import { ACTIVITY_PIPELINE, ILLUSTRATION, PLAN_PIPELINE, RULES_ENGINE } from "../agents/descriptors.ts";
import { ACTIVITY_STEPS, HOME_MAX_MINUTES, OBJECTIVES_PER_PLAN } from "../pedagogy-rules.ts";
import { NO_NAMES_HINT, sceneOf } from "./catalog.ts";

export type GardenFamily = "raizes" | "trelica" | "botoes" | "folha" | "vasinho";
export type GardenScene = "broto" | GardenFamily;
export type GardenPhase = "pensando" | "ferramenta" | "organizando" | "escrevendo";
export type GardenOutcome = "pronto" | "erro" | "interrompida";
export type LongKind = "plano" | "atividades";
export type InlineScene = LongKind | "imagem" | "material";
export type LongStage = "inicio" | "analista" | "planejador" | "revisor" | "ajustes" | "especialistas" | "imagens" | "regras";
export type RungState = "espera" | "ativo" | "feito";
export type BudState = "fechado" | "aberto";
export type Palette = "sky" | "teal" | "peach" | "sage" | "rose" | "lime";
export type RootMark = { slot: number; palette: Palette; state: "vivo" | "ok" | "pedra" };
export type TipPool = "pratica" | LongKind;
export type ToolScene = { family: GardenFamily; wait: string; hint?: string; pebble?: Palette; long?: LongKind };
type Trio<T> = [T, T, T];

export type Garden = {
  phase: GardenPhase;
  scene: GardenScene;
  tool: string;
  label: string;
  hint: string;
  grown: number;
  roots: RootMark[];
  stones: number;
  trellis: boolean;
  rungs: Trio<RungState>;
  buds: null | { states: Trio<BudState>; review: boolean };
  side: "folha" | "vasinho" | null;
  crown: boolean;
  long: null | { id: string; kind: LongKind; stage: LongStage; images: boolean };
  handoff: LongKind | null;
  failed: boolean;
};

export type ArtState = {
  grown: number;
  ties: number;
  stem: number;
  roots: RootMark[];
  stones: number;
  trellis: boolean;
  rungs: Trio<RungState>;
  buds: null | { states: Trio<BudState>; review: boolean };
  side: "folha" | "vasinho" | null;
  crown: "nenhum" | "botao" | "flor";
  stake: boolean;
  cloud: boolean;
  sun: number | null;
};

export type Caption = { label: string; hint: string; status: string; keep: boolean };
export type InlineCaption = { title: string; explain: string; time: string; late: string };

export const TURN_THRESHOLDS = [4, 10, 20, 60] as const;
export const LONG_THRESHOLDS = [20, 60, 120, 180, 240] as const;
const INLINE_IMAGE_THRESHOLDS = [20, 60] as const;
const INLINE_LONG_THRESHOLDS = [20, 60, 120, 180] as const;
const INLINE_LONG_IMAGES_THRESHOLDS = [20, 60, 120, 180, 240] as const;
export const FINALE_MIN_SECONDS = 20;

const PRIORITY: Readonly<Record<GardenFamily, number>> = { trelica: 4, botoes: 4, vasinho: 3, folha: 2, raizes: 1 };

export const UNKNOWN_LABEL = "Trabalhando no seu pedido…";

const PLAN_WRITERS: readonly string[] = Object.values(PLAN_PIPELINE.writers);
const ACTIVITY_WRITERS: Trio<string> = [ACTIVITY_PIPELINE.writers.sala_comum, ACTIVITY_PIPELINE.writers.aee, ACTIVITY_PIPELINE.writers.casa];

export const LEAVE_LINE = {
  popup: "Pode fechar o painel: a resposta fica salva.",
  page: "Se sair, a resposta fica salva na conversa.",
} as const;
const FAILED_HINT = "Uma etapa não deu certo; o assistente segue.";
const SLOW_HINT = "Mais lento que o normal; a resposta fica salva.";
const HANDOFF: Readonly<Record<LongKind, { label: string; hint: string }>> = {
  plano: { label: "Proposta pronta para a sua revisão.", hint: "O plano só vale depois que você ativar." },
  atividades: { label: "Sugestões prontas para você avaliar.", hint: "Você decide o que vai usar." },
};
const LONG_OVERRIDE: Partial<Record<LongStage, string>> = {
  ajustes: "O revisor pediu ajustes. Isso é normal.",
  regras: "Os agentes de IA não responderam desta vez.",
  imagens: "Estilo pictograma, sem dados pessoais.",
};

export const TIP_POOLS: Readonly<Record<TipPool, readonly string[]>> = {
  pratica: [
    "Dica: antecipe mudanças na rotina com imagens.",
    "Dica: aceite respostas por fala, gesto ou cartão.",
    "Dica: espere uns segundos antes de ajudar.",
    "Dica: menos apoio na mesma tarefa já é avanço.",
    "Dica: uma atividade, vários caminhos, toda a turma.",
    "Dica: parta dos interesses de quem aprende.",
    "Dica: divida a tarefa em passos curtos.",
    "Dica: elogie o esforço logo que ele acontece.",
    "Dica: em casa, pouco tempo e o que já se tem.",
    "Dica: rotina previsível traz segurança para todos.",
    "Dica: a barreira está no ambiente, não na pessoa.",
  ],
  plano: [
    "Analista (IA): lê o caso e aponta prioridades.",
    `Planejador (IA): até ${OBJECTIVES_PER_PLAN.max} objetivos mensuráveis.`,
    "Revisor (IA): confere critério com número.",
    "Revisor (IA): o apoio esperado deve diminuir.",
    "Revisor (IA): sem termos clínicos.",
    "Você revisa e decide antes de ativar o plano.",
  ],
  atividades: [
    "Sala comum (IA): a turma participa junto.",
    "AEE (IA): escada de apoio e forma de resposta.",
    `Casa (IA): até ${HOME_MAX_MINUTES} minutos, sem compras.`,
    `Revisor (IA): confere de ${ACTIVITY_STEPS.min} a ${ACTIVITY_STEPS.max} passos.`,
    "Revisor (IA): confere as regras de adaptação.",
    "Você decide o que vai usar.",
  ],
};

const sentence = (label: string) => label.replace(/…$/, ".");
const familyOf = (name: string): GardenFamily => sceneOf(name)?.family ?? "raizes";
const longOf = (name: string): LongKind | undefined => sceneOf(name)?.long;

const NO_ROOTS: RootMark[] = [];
const IDLE_RUNGS: Trio<RungState> = ["espera", "espera", "espera"];
const DONE_RUNGS: Trio<RungState> = ["feito", "feito", "feito"];
const CLOSED_BUDS: { states: Trio<BudState>; review: boolean } = { states: ["fechado", "fechado", "fechado"], review: false };
const OPEN_BUDS: { states: Trio<BudState>; review: boolean } = { states: ["aberto", "aberto", "aberto"], review: false };

function latest(progress: readonly AgentProgress[], agent: string): AgentProgress["phase"] | null {
  return progress.findLast((item) => item.agent === agent)?.phase ?? null;
}
const rungOf = (phase: AgentProgress["phase"] | null): RungState => (phase === "start" ? "ativo" : phase === "end" ? "feito" : "espera");

export function planState(step: ToolStep): { stage: LongStage; rungs: Trio<RungState> } {
  const progress = step.progress ?? [];
  if (progress.some((item) => item.agent === RULES_ENGINE)) return { stage: "regras", rungs: IDLE_RUNGS };
  if (step.ok === true) return { stage: "revisor", rungs: DONE_RUNGS };
  const writing: RungState = PLAN_WRITERS.some((agent) => latest(progress, agent) === "start") ? "ativo"
    : PLAN_WRITERS.every((agent) => latest(progress, agent) === "end") ? "feito" : "espera";
  const rungs: Trio<RungState> = [rungOf(latest(progress, PLAN_PIPELINE.preparer)), writing, rungOf(latest(progress, PLAN_PIPELINE.reviewer))];
  const lastStart = progress.findLast((item) => item.phase === "start")?.agent;
  const reviewed = progress.some((item) => item.agent === PLAN_PIPELINE.reviewer && item.phase === "end");
  const stage: LongStage = lastStart === PLAN_PIPELINE.preparer ? "analista"
    : PLAN_WRITERS.includes(lastStart ?? "") ? (reviewed ? "ajustes" : "planejador")
    : lastStart === PLAN_PIPELINE.reviewer ? "revisor"
    : "inicio";
  return { stage, rungs };
}

export function activityState(step: ToolStep): { stage: LongStage; buds: Trio<BudState>; written: number; adjusting: number } {
  const progress = step.progress ?? [];
  const done = step.ok === true;
  const bud = (agent: string): BudState => (done || latest(progress, agent) === "end" ? "aberto" : "fechado");
  const buds: Trio<BudState> = [bud(ACTIVITY_WRITERS[0]), bud(ACTIVITY_WRITERS[1]), bud(ACTIVITY_WRITERS[2])];
  if (progress.some((item) => item.agent === RULES_ENGINE)) {
    return { stage: "regras", buds: done ? buds : ["fechado", "fechado", "fechado"], written: 0, adjusting: 0 };
  }
  const reviewed = progress.findLastIndex((item) => item.agent === ACTIVITY_PIPELINE.reviewer && item.phase === "end");
  const adjusting = reviewed < 0 ? 0 : ACTIVITY_WRITERS.filter((agent) =>
    latest(progress, agent) === "start" && progress.slice(reviewed + 1).some((item) => item.agent === agent && item.phase === "start")).length;
  const stage: LongStage = latest(progress, ILLUSTRATION) === "start" ? "imagens"
    : latest(progress, ACTIVITY_PIPELINE.reviewer) === "start" ? "revisor"
    : adjusting > 0 ? "ajustes"
    : progress.some((item) => item.phase !== "queued") ? "especialistas"
    : "inicio";
  return { stage, buds, written: buds.filter((item) => item === "aberto").length, adjusting };
}

const PLAN_LABELS: Partial<Record<LongStage, string>> = {
  analista: "O analista lê o caso…",
  planejador: "Escrevendo o PAEE, o PEI e os objetivos…",
  revisor: "O revisor confere a proposta…",
  ajustes: "Os agentes ajustam a proposta…",
  regras: "As regras da plataforma montam a proposta…",
};

function longLabel(kind: LongKind, step: ToolStep): { stage: LongStage; label: string } {
  if (kind === "plano") {
    const { stage } = planState(step);
    return { stage, label: PLAN_LABELS[stage] ?? "Preparando a proposta de plano…" };
  }
  const { stage, written, adjusting } = activityState(step);
  const label = stage === "especialistas" ? (written === 0 ? "Três agentes escrevem ao mesmo tempo…" : `${written} de 3 atividades escritas…`)
    : stage === "revisor" ? "O revisor confere as atividades…"
    : stage === "ajustes" ? (adjusting === 1 ? "Ajustando 1 atividade…" : `Ajustando ${adjusting} atividades…`)
    : stage === "imagens" ? "Desenhando as imagens de apoio…"
    : stage === "regras" ? "As regras da plataforma montam as sugestões…"
    : "Criando 3 sugestões de atividade…";
  return { stage, label };
}

export function deriveGarden(steps: readonly ToolStep[], writing: boolean): Garden {
  let focus: ToolStep | null = null;
  for (const step of steps) {
    if (step.ok !== undefined) continue;
    if (!focus || PRIORITY[familyOf(step.name)] >= PRIORITY[familyOf(focus.name)]) focus = step;
  }
  const finished = steps.filter((step) => step.ok !== undefined);
  const lastFinished = finished.at(-1);
  const lookups = steps.filter((step) => familyOf(step.name) === "raizes");
  const roots: RootMark[] = lookups
    .map((step, index): RootMark => ({ slot: index % 3, palette: sceneOf(step.name)?.pebble ?? "sky", state: step.ok === undefined ? "vivo" : step.ok ? "ok" : "pedra" }))
    .slice(-3);
  const plan = steps.findLast((step) => longOf(step.name) === "plano");
  const acts = steps.findLast((step) => longOf(step.name) === "atividades");
  const actInfo = acts ? activityState(acts) : null;
  const sideStep = steps.findLast((step) => familyOf(step.name) === "folha" || familyOf(step.name) === "vasinho");
  const phase: GardenPhase = focus ? "ferramenta" : writing ? "escrevendo" : steps.length ? "organizando" : "pensando";

  let label = "";
  let hint = "";
  let long: Garden["long"] = null;
  if (focus) {
    const kind = longOf(focus.name);
    const runningLookups = steps.filter((step) => step.ok === undefined && familyOf(step.name) === "raizes").length;
    if (kind) {
      const info = longLabel(kind, focus);
      const images = kind === "atividades" && (focus.progress ?? []).some((item) => item.agent === ILLUSTRATION);
      long = { id: focus.id, kind, stage: info.stage, images };
      label = info.label;
      hint = LONG_OVERRIDE[info.stage] ?? "";
    } else if (familyOf(focus.name) === "raizes" && runningLookups > 1) {
      label = `Fazendo ${runningLookups} consultas ao mesmo tempo…`;
      hint = NO_NAMES_HINT;
    } else {
      const scene = sceneOf(focus.name);
      label = scene?.wait ?? UNKNOWN_LABEL;
      hint = scene?.hint ?? "";
    }
  }
  const handoff = !focus && !writing && lastFinished?.ok === true ? longOf(lastFinished.name) ?? null : null;

  return {
    phase,
    scene: focus ? familyOf(focus.name) : "broto",
    tool: focus?.name ?? "",
    label,
    hint,
    grown: Math.min(2, finished.filter((step) => step.ok).length),
    roots,
    stones: Math.min(2, finished.filter((step) => !step.ok && familyOf(step.name) !== "raizes").length),
    trellis: Boolean(plan),
    rungs: plan ? planState(plan).rungs : IDLE_RUNGS,
    buds: actInfo ? { states: actInfo.buds, review: actInfo.stage === "revisor" } : null,
    side: sideStep ? (familyOf(sideStep.name) as "folha" | "vasinho") : null,
    crown: writing && !acts,
    long,
    handoff,
    failed: lastFinished?.ok === false,
  };
}

export function longBudget(garden: Garden): number {
  return garden.long?.images ? 240 : 180;
}

function longTimeLine(kind: LongKind, bucket: number, leave: string, images: boolean): string {
  const budget = images ? 240 : 180;
  const upTo = images ? 4 : 3;
  if (bucket >= budget) return SLOW_HINT;
  if (bucket >= 180) return "Já são 3 minutos. Costuma levar até 4.";
  if (bucket >= 120) return `Já são 2 minutos. Costuma levar até ${upTo}.`;
  if (bucket >= 60) return `Já passou 1 minuto. Costuma levar até ${upTo}.`;
  if (bucket >= 20) return leave;
  return kind === "plano" ? "Analista, três agentes juntos e um revisor." : "Sala comum, AEE e casa. Depois, um revisor.";
}

export function chatCaption(garden: Garden, turnBucket: number, longBucket: number, layout: "popup" | "page", invite: boolean): Caption {
  const leave = LEAVE_LINE[layout];
  if (garden.phase === "pensando") {
    return {
      keep: turnBucket >= 20,
      label: turnBucket >= 10 ? "Ainda pensando no seu pedido…" : "Pensando no seu pedido…",
      hint: turnBucket >= 60 ? leave : turnBucket >= 20 ? "Levando um pouco mais que o normal." : turnBucket >= 4 && invite ? "Enquanto espera, você pode regar a planta." : "",
      status: turnBucket >= 60 ? `Ainda pensando. ${leave}` : turnBucket >= 20 ? "Ainda pensando. Levando um pouco mais que o normal." : "Pensando no seu pedido.",
    };
  }
  if (garden.phase === "organizando") {
    if (garden.handoff) {
      const handoff = HANDOFF[garden.handoff];
      return { label: handoff.label, hint: handoff.hint, status: `${handoff.label} ${handoff.hint}`, keep: true };
    }
    return {
      keep: true,
      label: "Organizando a resposta…",
      hint: garden.failed ? FAILED_HINT : turnBucket >= 60 ? leave : "",
      status: garden.failed ? `Organizando a resposta. ${FAILED_HINT}` : "Organizando a resposta.",
    };
  }
  if (garden.phase === "escrevendo") return { label: "Escrevendo a resposta…", hint: "", status: "Escrevendo a resposta.", keep: false };
  if (garden.long) {
    const budget = longBudget(garden);
    const override = LONG_OVERRIDE[garden.long.stage] ?? "";
    const time = longTimeLine(garden.long.kind, longBucket, leave, garden.long.images);
    const unknown = garden.long.kind === "atividades" && garden.long.stage === "inicio" && !garden.long.images;
    const suffix = longBucket >= budget ? "Está levando mais que o normal; a resposta fica salva."
      : longBucket >= 20 ? leave
        : unknown ? ""
          : garden.long.images ? "Costuma levar de 1 a 4 minutos, com as imagens." : "Costuma levar de 1 a 3 minutos.";
    const spoken = garden.long.stage === "ajustes" || garden.long.stage === "regras" ? override : "";
    return {
      keep: true,
      label: garden.label,
      hint: longBucket >= budget ? time : override || time,
      status: [sentence(garden.label), spoken, suffix].filter(Boolean).join(" "),
    };
  }
  return {
    keep: false,
    label: garden.label,
    hint: garden.hint,
    status: garden.scene === "vasinho" ? `${sentence(garden.label)} ${garden.hint}` : sentence(garden.label),
  };
}

export function endingCaption(outcome: GardenOutcome, awaiting: number): Caption {
  if (outcome === "erro") return { label: "Não deu certo desta vez.", hint: "", status: "", keep: false };
  if (outcome === "interrompida") return { label: "A conexão caiu.", hint: "A resposta continua sendo preparada.", status: "", keep: true };
  const label = awaiting <= 0 ? "Resposta pronta." : awaiting === 1 ? "Resposta pronta. Há 1 cartão para decidir." : `Resposta pronta. Há ${awaiting} cartões para decidir.`;
  return { label, hint: "", status: label, keep: false };
}

export function inlineThresholds(scene: InlineScene, withImages: boolean): readonly number[] {
  if (scene === "imagem") return INLINE_IMAGE_THRESHOLDS;
  if (scene === "material") return withImages ? INLINE_LONG_IMAGES_THRESHOLDS : INLINE_LONG_THRESHOLDS;
  return scene === "atividades" && withImages ? INLINE_LONG_IMAGES_THRESHOLDS : INLINE_LONG_THRESHOLDS;
}

export function inlineTypical(scene: InlineScene, withImages: boolean): number {
  if (scene === "material") return withImages ? 240 : 180;
  return scene === "imagem" ? 60 : scene === "atividades" && withImages ? 240 : 180;
}

export function inlineCaption(scene: InlineScene, bucket: number, withImages: boolean): InlineCaption {
  const late = "Está levando mais que o normal. Mantenha esta página aberta.";
  if (scene === "imagem") {
    return {
      title: "Desenhando a imagem de apoio…",
      explain: "Estilo pictograma, sem nenhum dado pessoal.",
      time: bucket >= 60 ? late : bucket >= 20 ? "Ainda desenhando. Pode levar até 1 minuto." : "Costuma levar de 10 a 30 segundos.",
      late: bucket >= 60 ? late : "",
    };
  }
  if (scene === "material") {
    const lateAt = withImages ? 240 : 180;
    return {
      title: "Criando o material de apoio…",
      explain: withImages
        ? "Os agentes de IA criam os cartões, uma atividade para a sala comum, uma para o AEE e uma para casa, e um revisor confere tudo; depois, um pictograma por cartão. Sem nenhum dado pessoal."
        : "Os agentes de IA criam os cartões, uma atividade para a sala comum, uma para o AEE e uma para casa, e um revisor confere tudo. Sem nenhum dado pessoal.",
      time: bucket >= lateAt ? late
        : bucket >= 180 ? "Já são 3 minutos. Com imagens, costuma levar até 4 minutos."
        : bucket >= 120 ? "Já são 2 minutos. O revisor está conferindo o material."
        : bucket >= 60 ? "Já passou 1 minuto. As atividades estão sendo escritas."
        : bucket >= 20 ? "Mantenha esta página aberta até o material aparecer."
        : withImages ? "Costuma levar de 2 a 4 minutos, com as imagens." : "Costuma levar de 1 a 3 minutos.",
      late: bucket >= lateAt ? late : "",
    };
  }
  const images = scene === "atividades" && withImages;
  const total = images ? 4 : 3;
  const lateAt = images ? 240 : 180;
  const time = bucket >= lateAt ? late
    : bucket >= 180 ? "Já são 3 minutos. Costuma levar até 4 minutos."
    : bucket >= 120 ? `Já são 2 minutos. Costuma levar até ${total} minutos.`
    : bucket >= 60 ? `Já passou 1 minuto. Costuma levar até ${total} minutos.`
    : bucket >= 20 ? (scene === "plano" ? "Mantenha esta página aberta até a proposta aparecer." : "Mantenha esta página aberta até as sugestões aparecerem.")
    : images ? "Costuma levar de 1 a 4 minutos, com as imagens." : "Costuma levar de 1 a 3 minutos.";
  return {
    title: scene === "plano" ? "Preparando a proposta de plano…" : "Criando 3 sugestões de atividade…",
    explain: scene === "plano"
      ? "Um analista lê o caso; três agentes escrevem o PAEE, o PEI e os objetivos ao mesmo tempo; um revisor confere."
      : "Três agentes de IA ao mesmo tempo (sala comum, AEE e casa); depois, um revisor confere.",
    time,
    late: bucket >= lateAt ? late : "",
  };
}

export function sunAngle(bucket: number, typicalSeconds: number): number {
  return Math.round(-60 + 120 * Math.min(bucket / typicalSeconds, 1));
}

export function artFor(garden: Garden, ending: { outcome: GardenOutcome; finale: boolean } | null, sun: number | null): ArtState {
  const bloom = ending?.finale === true && ending.outcome === "pronto";
  const buds = garden.buds && bloom ? OPEN_BUDS : garden.buds;
  const crown = bloom ? (garden.buds ? "nenhum" : "flor") : garden.crown ? "botao" : "nenhum";
  return {
    grown: garden.grown,
    ties: bloom ? 0 : 2 - garden.grown,
    stem: garden.buds || crown !== "nenhum" ? 2 : garden.grown,
    roots: garden.roots,
    stones: garden.stones,
    trellis: garden.trellis,
    rungs: garden.rungs,
    buds,
    side: garden.side,
    crown,
    stake: !bloom,
    cloud: ending?.finale === true && ending.outcome === "erro",
    sun: ending ? null : sun,
  };
}

export const INLINE_SCENES: Readonly<Record<InlineScene, { family: GardenFamily; pool: TipPool }>> = {
  plano: { family: "trelica", pool: "plano" },
  atividades: { family: "botoes", pool: "atividades" },
  imagem: { family: "folha", pool: "pratica" },
  material: { family: "folha", pool: "pratica" },
};

export function inlineArt(scene: InlineScene, sun: number): ArtState {
  const { family } = INLINE_SCENES[scene];
  return {
    grown: 0, ties: 2, stem: family === "botoes" ? 2 : 0, roots: NO_ROOTS, stones: 0,
    trellis: family === "trelica", rungs: IDLE_RUNGS,
    buds: family === "botoes" ? CLOSED_BUDS : null,
    side: family === "folha" ? "folha" : null,
    crown: "nenhum", stake: true, cloud: false, sun,
  };
}
