// Regras puras das sugestões do DUA (seção 6): preparação e conferência do
// contexto, sugestões por regras (sem IA) e verificações automáticas da resposta.
// Sem banco e sem servidor, para rodar com node --test (src/lib/dua/checks.test.mjs).
import { randomUUID } from "node:crypto";
import { PATTERNS, escape, isYearRange, nameTokens, type Anonymizer } from "../agents/anonymize-core.ts";
import {
  BARRIER_CATEGORY_LABEL, DUA_PRINCIPLES,
  type AiBlock, type AiCheck, type AiPurpose, type BarrierCategory, type BarrierStatus, type DuaPrinciple,
} from "./domain.ts";

const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export type DuaAiContext = {
  purpose: AiPurpose;
  objective: { learning: string; curriculum: string };
  criteria: Array<{ id: string; description: string }>;
  barriers: Array<{ id: string; description: string; category: BarrierCategory; status: BarrierStatus }>;
  organization: string;
  resources: string[];
  existingStrategies: Array<{ description: string; principles: DuaPrinciple[] }>;
  individual: null | { barrier: string; support: string; purpose: string; profile: Array<{ label: string; value: string }> };
};

// Formato esperado da resposta (6.2); o esquema zod equivalente fica em suggestions.ts.
export type RawBlock = {
  objectiveConsidered: string;
  barrierId: string | null;
  hypothesis: string | null;
  strategy: string;
  principles: DuaPrinciple[];
  justification: string;
  resources: string[];
  suggestedEvidence: string;
  pendingInformation: string[];
  criterionProposal: string | null;
};
export type RawBlocks = { blocks: RawBlock[] };

// Conferência independente depois da troca: nome completo (qualquer grafia), parte
// de nome com inicial maiúscula, e-mail, documento, telefone ou data.
export function remainingIdentifiers(text: string, people: string[], schools: string[]): string[] {
  const found = new Set<string>();
  for (const pattern of PATTERNS) {
    const matches = text.match(new RegExp(pattern.regex.source, pattern.regex.flags)) ?? [];
    // Mesma exceção do anonimizador: "2025-2026" (ano letivo) não é telefone.
    if (matches.some((match) => pattern.replacement !== "[TELEFONE]" || (match.replace(/\D/g, "").length >= 8 && !isYearRange(match)))) found.add(pattern.label);
  }
  for (const name of [...people, ...schools]) {
    const full = name.trim();
    if (full.length >= 5 && new RegExp(`(?<![\\p{L}])${escape(full)}(?![\\p{L}])`, "iu").test(text)) found.add("nome");
  }
  for (const token of new Set(people.flatMap(nameTokens))) {
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escape(token)}(?![\\p{L}\\p{N}])`, "u").test(text)) found.add("nome");
  }
  return [...found];
}

export type PreparedContext = { ok: true; prompt: string; removed: number; summary: string | null } | { ok: false; reasons: string[] };

export function prepareContext(context: DuaAiContext, anonymizer: Anonymizer, people: string[], schools: string[]): PreparedContext {
  const prompt = anonymizer.apply(JSON.stringify(context));
  const reasons = remainingIdentifiers(prompt, people, schools);
  if (reasons.length) return { ok: false, reasons };
  const summary = anonymizer.summary();
  const removed = summary ? Number((summary.match(/\d+/g) ?? []).reduce((total, value) => total + Number(value), 0)) : 0;
  return { ok: true, prompt, removed, summary };
}

// ------------------------------------------------------------- regras (sem IA)

const RULES: Record<BarrierCategory, { strategy: string; principles: DuaPrinciple[]; resources: string[]; evidence: string }> = {
  instrucoes: { strategy: "Apresentar a instrução em etapas curtas, uma por vez, com um cartão visual para cada etapa e checagem rápida antes de seguir.", principles: ["representacao", "engajamento"], resources: ["Cartões de etapas", "Quadro com a sequência"], evidence: "Inicia cada etapa depois da instrução correspondente." },
  leitura: { strategy: "Oferecer o texto também em leitura em voz alta e em sequência ilustrada, mantendo o texto escrito disponível.", principles: ["representacao"], resources: ["Texto impresso", "Leitura em voz alta", "Sequência ilustrada"], evidence: "Responde sobre o conteúdo usando a forma de acesso escolhida." },
  estimulos: { strategy: "Organizar um espaço com menos estímulos para a atividade e combinar um sinal para pausas curtas.", principles: ["engajamento"], resources: ["Canto com menos estímulos", "Cartão de pausa"], evidence: "Permanece na atividade pelo tempo combinado, com pausas quando precisa." },
  material: { strategy: "Oferecer material com pegada adaptada ou em tamanho maior, e alternativa digital para manipular os elementos.", principles: ["acao_expressao"], resources: ["Material com pegada adaptada", "Versão digital"], evidence: "Manipula os elementos da atividade com a alternativa oferecida." },
  tempo: { strategy: "Combinar tempo flexível e dividir a atividade em blocos menores, com marcador visual do tempo.", principles: ["engajamento", "acao_expressao"], resources: ["Marcador visual de tempo"], evidence: "Conclui os blocos combinados, no tempo combinado." },
  resposta: { strategy: "Permitir responder de mais de uma forma: oralmente, por escrito, apontando entre alternativas, com cartões ou por comunicação alternativa.", principles: ["acao_expressao"], resources: ["Cartões de resposta", "Prancha de comunicação"], evidence: "Demonstra o critério pela forma de resposta que escolheu." },
  outra: { strategy: "Explicar a finalidade da atividade no início e combinar com a turma as etapas e as formas de participação.", principles: ["engajamento"], resources: ["Quadro com a finalidade e as etapas"], evidence: "Participa das etapas combinadas." },
};

export function rulesBlocks(context: DuaAiContext): RawBlocks {
  const barriers = context.barriers.length ? context.barriers : [{ id: "", description: "", category: "outra" as BarrierCategory, status: "hipotese" as BarrierStatus }];
  const seen = new Set<BarrierCategory>();
  const blocks = barriers.filter((barrier) => (seen.has(barrier.category) ? false : (seen.add(barrier.category), true))).slice(0, 5).map((barrier) => {
    const rule = RULES[barrier.category];
    return {
      objectiveConsidered: context.objective.learning,
      barrierId: barrier.id || null,
      hypothesis: barrier.id ? null : "Barreira ainda não registrada: confirme na observação da turma.",
      strategy: context.individual ? `${rule.strategy} Combine com o profissional do AEE como oferecer este apoio ao estudante.` : rule.strategy,
      principles: rule.principles,
      justification: barrier.id ? `Responde à barreira "${barrier.description || BARRIER_CATEGORY_LABEL[barrier.category]}" sem mudar o que se quer observar no objetivo.` : "Organiza a participação de todos sem mudar o objetivo.",
      resources: rule.resources,
      suggestedEvidence: context.criteria[0]?.description ? `${rule.evidence} Critério relacionado: ${context.criteria[0].description}` : rule.evidence,
      pendingInformation: ["Confirmar se o recurso está disponível na escola.", "Decidir em que momento da atividade a opção entra."],
      criterionProposal: null,
    };
  });
  return { blocks };
}

// ------------------------------------------------------------- 6.3 verificações automáticas

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
// Palavras inteiras: "cidade", "cidadania", "medição" ou "tratamento da informação" não são diagnóstico.
const DIAGNOSIS = /\b(diagnos\w*|laudo\w*|cid\b|cid[- ]?\d{1,2}\b|cid[- ]?[a-z]\d|tea\b|tdah\b|autis\w*|sindrome\w*|transtorno\w*|deficiencia intelectual|medicament\w*|medicacao|medicad[oa]s?\b|terapia\w*)/;
const REDUCTION = /\b(simplifi\w*|reduzi\w*|diminui\w*|facilit\w*)\b[^.]{0,60}\b(por causa|devido|em razao|por ser|por ter)\b[^.]{0,40}\b(deficien\w*|condic\w*|diagnost\w*|transtorno)/;
const INVENTED = /\b(o estudante|a estudante|o aluno|a aluna|a turma)\s+(demonstrou|apresentou|conseguiu|realizou|respondeu|disse|falou|mostrou)\b|\bobservou-se\b|\bfoi observad\w*|\bna ultima aula\b|\bno ultimo atendimento\b/;
const ATTENDANCE_AS_EVIDENCE = /\b(frequencia|presenca|assiduidade)\b[^.]{0,60}\b(comprova|demonstra|evidencia|indica)\b[^.]{0,40}\b(aprend\w*|evolu\w*|progress\w*)/;

const blockText = (block: RawBlock) => [block.objectiveConsidered, block.hypothesis ?? "", block.strategy, block.justification, block.suggestedEvidence, block.criterionProposal ?? "", ...block.resources, ...block.pendingInformation].join(" \n ");

export function checkBlocks(raw: RawBlocks, context: DuaAiContext, people: string[], schools: string[]): { blocks: AiBlock[]; checks: AiCheck[] } {
  const barrierIds = new Set(context.barriers.map((item) => item.id));
  const objective = normalize(context.objective.learning);
  const counts = { structure: 0, references: 0, identifiers: 0, forbidden: 0, invented: 0, objective: 0, criterion: 0 };
  const candidates = raw.blocks.slice(0, 5).filter((item) => {
    const ok = typeof item.strategy === "string" && item.strategy.trim().length >= 5;
    if (!ok) counts.structure += 1;
    return ok;
  });
  const blocks = candidates.map((item): AiBlock => {
    const problems: string[] = [];
    let blocked = false;
    let barrierId = item.barrierId || null;
    let hypothesis = item.hypothesis?.trim() || null;
    // Barreira que não existe no planejamento vira hipótese a verificar, nunca observação.
    if (barrierId && !barrierIds.has(barrierId)) {
      counts.references += 1;
      problems.push("Citava uma barreira que não está no planejamento; ficou como hipótese a verificar.");
      barrierId = null;
      hypothesis = hypothesis || "Barreira citada pela sugestão, ainda não registrada no planejamento.";
    }
    const changesObjective = Boolean(item.objectiveConsidered?.trim()) && normalize(item.objectiveConsidered) !== objective;
    // O objetivo repetido é texto do professor, não da sugestão: as regras de conteúdo olham só o que a sugestão trouxe.
    const text = normalize(blockText(changesObjective ? item : { ...item, objectiveConsidered: "" }));
    if (remainingIdentifiers(blockText(item), people, schools).length) {
      counts.identifiers += 1;
      blocked = true;
      problems.push("Continha identificador de pessoa, escola ou contato: o bloco não pode ser aceito.");
    }
    if (DIAGNOSIS.test(text) || REDUCTION.test(text)) {
      counts.forbidden += 1;
      blocked = true;
      problems.push("Mencionava diagnóstico, condição clínica ou redução de complexidade por deficiência.");
    }
    if (INVENTED.test(text) || ATTENDANCE_AS_EVIDENCE.test(text)) {
      counts.invented += 1;
      blocked = true;
      problems.push("Apresentava observação, resultado ou frequência como se fosse evidência registrada.");
    }
    if (changesObjective) counts.objective += 1;
    const changesCriterion = Boolean(item.criterionProposal?.trim());
    if (changesCriterion) counts.criterion += 1;
    const principles = [...new Set(item.principles.filter((principle) => DUA_PRINCIPLES.includes(principle)))];
    if (!principles.length) problems.push("Não indicou o princípio relacionado; escolha antes de aceitar.");
    const barrierText = barrierId ? context.barriers.find((barrier) => barrier.id === barrierId)?.description ?? "" : hypothesis ?? "";
    return {
      id: randomUUID(),
      objectiveConsidered: clip(item.objectiveConsidered, 2000),
      barrierConsidered: { barrierId, hypothesis: hypothesis ? clip(hypothesis, 600) : null, text: clip(barrierText, 600) },
      strategy: clip(item.strategy, 1200),
      principles,
      justification: clip(item.justification, 1200),
      resources: item.resources.map((resource) => clip(resource, 300)).filter(Boolean).slice(0, 10),
      suggestedEvidence: clip(item.suggestedEvidence, 600),
      pendingInformation: item.pendingInformation.map((info) => clip(info, 300)).filter(Boolean).slice(0, 6),
      criterionProposal: item.criterionProposal?.trim() ? clip(item.criterionProposal, 600) : null,
      flags: { changesObjective, changesCriterion, individual: context.purpose === "apoio_individual", problems, blocked },
      decision: "pendente",
      decidedBy: null,
      decidedAt: null,
      reason: null,
    };
  });
  const checks: AiCheck[] = [
    { name: "Estrutura da resposta", passed: blocks.length > 0 && counts.structure === 0, detail: blocks.length ? `${blocks.length} bloco(s) com os campos esperados${counts.structure ? `; ${counts.structure} descartado(s) por estrutura incompleta` : ""}.` : "Nenhum bloco aproveitável." },
    { name: "Referências a informações inexistentes", passed: counts.references === 0, detail: counts.references ? `${counts.references} barreira(s) inexistente(s) convertida(s) em hipótese.` : "Todas as barreiras citadas existem no planejamento." },
    { name: "Identificadores na resposta", passed: counts.identifiers === 0, detail: counts.identifiers ? `${counts.identifiers} bloco(s) bloqueado(s) por identificador.` : "Nenhum identificador encontrado." },
    { name: "Diagnóstico e redução por deficiência", passed: counts.forbidden === 0, detail: counts.forbidden ? `${counts.forbidden} bloco(s) bloqueado(s).` : "Nenhuma menção encontrada." },
    { name: "Observações ou resultados inventados", passed: counts.invented === 0, detail: counts.invented ? `${counts.invented} bloco(s) bloqueado(s).` : "Nenhuma afirmação de observação encontrada." },
    { name: "Compatibilidade com o objetivo e os critérios", passed: counts.objective === 0 && counts.criterion === 0, detail: counts.objective || counts.criterion ? `${counts.objective} bloco(s) alteram o objetivo e ${counts.criterion} propõem critério novo: dependem de decisão profissional.` : "Objetivo e critérios preservados." },
  ];
  return { blocks, checks };
}

