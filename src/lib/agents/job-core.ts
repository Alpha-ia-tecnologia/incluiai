import type { AiGate, AiNeed } from "./capabilities.ts";
import type { RedactionScope } from "./names-in-scope.ts";
import { createRedactor, redactionNames, type Redactor, type ScopeNames } from "./redactor.ts";
import { AI_AGENTS, AI_PROVIDER, ANONYMIZATION, RULES_ENGINE } from "./descriptors.ts";
import type { AgentModel, AgentReport, TraceStep } from "./types.ts";

export type AiJob<T> = {
  task: string;
  madeByRules?: string;
  scope: RedactionScope | { names: ScopeNames };
  student?: string | null;
  needs?: AiNeed;
  run: (model: AgentModel, names: ScopeNames) => Promise<T>;
  rules?: () => T;
  report?: AgentReport;
  deepseekPurpose?: string;
};

export type AiOutcome<T> = {
  source: "ia" | "regras";
  value: T | null;
  trace: TraceStep[];
  reason: "desligada" | "sem_autorizacao" | "falhou" | null;
  error: string | null;
  model: string | null;
  privacy: { removed: number; summary: string | null };
};

export type JobProviders = {
  gate: (need: AiNeed, studentId?: string | null) => Promise<AiGate>;
  names: (scope: RedactionScope | { names: ScopeNames }) => Promise<ScopeNames>;
  chain: (redactor: Redactor, need: AiNeed) => { model: AgentModel; deepseekAgents: () => string[]; modelId: () => string };
  describeError: (error: unknown) => string;
  recordDeepSeekUse: (studentId: string, purpose?: string) => Promise<void>;
};

export type AiJobRunner = {
  <T>(job: AiJob<T> & { rules: () => T }): Promise<AiOutcome<T> & { value: T }>;
  <T>(job: AiJob<T>): Promise<AiOutcome<T>>;
};

const OFF_REASON = {
  desligada: "A IA está desligada nesta instalação.",
  sem_autorizacao: "A família ainda não autorizou o uso de IA com os dados deste estudante.",
} as const;

function reporting(model: AgentModel, report?: AgentReport): AgentModel {
  if (!report) return model;
  return async (request) => {
    report({ agent: request.agent, phase: "start" });
    try {
      const result = await model(request);
      report({ agent: request.agent, phase: "end" });
      return result;
    } catch (error) {
      report({ agent: request.agent, phase: "fail" });
      throw error;
    }
  };
}

const traceOf = (value: unknown): TraceStep[] =>
  value && typeof value === "object" && Array.isArray((value as { trace?: unknown }).trace) ? (value as { trace: TraceStep[] }).trace : [];

export function createJobRunner(providers: JobProviders): AiJobRunner {
  return async <T>(job: AiJob<T>): Promise<AiOutcome<T>> => {
    const need = job.needs ?? "text";
    const made = `${job.madeByRules ?? "A sugestão foi feita"} pelas regras da plataforma.`;
    const byRules = (reason: AiOutcome<T>["reason"], step: TraceStep, error: string | null = null): AiOutcome<T> => {
      if (job.rules) job.report?.({ agent: RULES_ENGINE, phase: "start" });
      return { source: "regras", value: job.rules ? job.rules() : null, trace: [step], reason, error, model: null, privacy: { removed: 0, summary: null } };
    };

    const gate = await providers.gate(need, job.student);
    if (gate !== "liberada") return byRules(gate, { agent: RULES_ENGINE, summary: `${OFF_REASON[gate]} ${made}` });

    const names = await providers.names(job.scope);
    const redactor = createRedactor(redactionNames(names));
    const agents = providers.chain(redactor, need);
    let outcome: AiOutcome<T>;
    try {
      const value = await job.run(reporting(agents.model, job.report), names);
      const summary = redactor.summary();
      outcome = {
        source: "ia",
        value,
        trace: [{ agent: ANONYMIZATION, summary: summary ?? "Nenhuma informação pessoal encontrada nos textos enviados à IA." }, ...traceOf(value)],
        reason: null,
        error: null,
        model: agents.modelId(),
        privacy: { removed: redactor.removed(), summary },
      };
    } catch (failure) {
      console.error(`[agentes] ${job.task}: a IA falhou${job.rules ? "; as regras respondem" : ""}:`, failure);
      const error = providers.describeError(failure);
      outcome = { ...byRules("falhou", { agent: AI_AGENTS, summary: `Indisponíveis no momento (${error}). ${made}` }, error), privacy: { removed: redactor.removed(), summary: redactor.summary() } };
    }
    const deepseek = agents.deepseekAgents();
    if (job.student && deepseek.length) {
      outcome.trace.push({ agent: AI_PROVIDER, summary: `Respondido pelo DeepSeek (fallback): ${deepseek.join(", ")}.` });
      await providers.recordDeepSeekUse(job.student, job.deepseekPurpose);
    }
    return outcome;
  };
}
