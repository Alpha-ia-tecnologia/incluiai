import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { FINALIZATION, type Pipeline } from "./descriptors.ts";
import { firstAgentError, type AgentModel, type TraceStep } from "./types.ts";

// Uma rodada de correção: o revisor confere tudo, devolve as partes com
// problema uma vez e confere de novo; o que ainda tiver problema vai para a
// revisão do professor.
const CORRECTION_ROUNDS = 1;

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

type Feedback<Part extends string, Problem> = Partial<Record<Part, Problem[]>>;

export type GraphContext<Input, Prepared, Drafts> = { input: Input; prepared: Prepared; drafts: Partial<Drafts> };

export type ReviewedGraph<Input, Part extends string, Drafts extends Record<Part, unknown>, Prepared, Problem> = {
  pipeline: Pipeline<Part>;
  parts: readonly Part[];
  lead?: { part: Part; redoneNote: string };
  prepare?: (input: Input, model: AgentModel) => Promise<{ prepared: Prepared; summary: string }>;
  write: <P extends Part>(part: P, context: GraphContext<Input, Prepared, Drafts> & { revision: string }, model: AgentModel) => Promise<{ draft: Drafts[P]; summary: string }>;
  review: (context: GraphContext<Input, Prepared, Drafts>, model: AgentModel) => Promise<Feedback<Part, Problem>>;
  check: <P extends Part>(part: P, draft: Drafts[P], context: GraphContext<Input, Prepared, Drafts>) => Problem[];
  problemLine?: (problem: Problem) => string;
  partLabel: (part: Part) => string;
  approved: string;
  finish?: (feedback: Feedback<Part, Problem>) => string;
};

export type ReviewedResult<Part extends string, Drafts, Prepared, Problem> = {
  prepared: Prepared | null;
  drafts: Partial<Drafts>;
  feedback: Feedback<Part, Problem>;
  modelNotes: Feedback<Part, Problem>;
  rounds: number;
  trace: TraceStep[];
};

const replace = <T>(initial: () => T) => Annotation<T>({ reducer: (_current: T, next: T) => next, default: initial });

type Loose<State> = {
  addNode: (name: string, action: (state: State) => Promise<Partial<State>>) => Loose<State>;
  addEdge: (from: string, to: string) => Loose<State>;
  addConditionalEdges: (from: string, route: (state: State) => string | string[], ends: string[]) => Loose<State>;
  compile: () => { invoke: (input: Partial<State>) => Promise<State> };
};

export async function runReviewedGraph<Input, Part extends string, Drafts extends Record<Part, unknown>, Prepared, Problem>(
  graph: ReviewedGraph<Input, Part, Drafts, Prepared, Problem>,
  input: Input,
  model: AgentModel,
): Promise<ReviewedResult<Part, Drafts, Prepared, Problem>> {
  const State = Annotation.Root({
    input: Annotation<Input>(),
    prepared: replace<Prepared | null>(() => null),
    drafts: Annotation<Partial<Drafts>>({ reducer: (current, next) => ({ ...current, ...next }), default: () => ({}) }),
    feedback: replace<Feedback<Part, Problem>>(() => ({})),
    modelNotes: replace<Feedback<Part, Problem>>(() => ({})),
    redo: replace<Part[]>(() => []),
    rounds: replace<number>(() => 0),
    trace: Annotation<TraceStep[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
  });
  type S = typeof State.State;
  const context = (state: S): GraphContext<Input, Prepared, Drafts> => ({ input: state.input, prepared: state.prepared as Prepared, drafts: state.drafts });
  const line = graph.problemLine ?? ((problem: Problem) => String(problem));
  const lead = graph.lead;

  const writer = (part: Part) => async (state: S): Promise<Partial<S>> => {
    const previous = state.drafts[part];
    const problems = state.feedback[part] ?? [];
    const leadRedone = Boolean(lead && part !== lead.part && state.redo.includes(lead.part));
    const revision = previous && (problems.length || leadRedone)
      ? [
        leadRedone ? `\n\n${lead!.redoneNote}` : "",
        problems.length ? `\n\nA versão anterior foi devolvida pelo revisor. Corrija:\n${bullets(problems.map(line))}` : "",
        `\n\nVersão anterior:\n${JSON.stringify(previous)}`,
      ].join("")
      : "";
    const { draft, summary } = await graph.write(part, { ...context(state), revision }, model);
    const drafts: Partial<Drafts> = {};
    drafts[part] = draft;
    return { drafts, trace: [{ agent: graph.pipeline.writers[part], summary }] };
  };

  const reviewer = async (state: S): Promise<Partial<S>> => {
    const ctx = context(state);
    const fromModel = await graph.review(ctx, model);
    const feedback: Feedback<Part, Problem> = {};
    for (const part of graph.parts) {
      const draft = state.drafts[part];
      if (draft === undefined) continue;
      const problems = [...(fromModel[part] ?? []), ...graph.check(part, draft as Drafts[Part], ctx)];
      if (problems.length) feedback[part] = problems;
    }
    const rejected = graph.parts.filter((part) => feedback[part]?.length);
    const canRetry = state.rounds < CORRECTION_ROUNDS;
    const names = rejected.map(graph.partLabel).join(", ");
    return {
      feedback,
      modelNotes: fromModel,
      redo: canRetry ? rejected : [],
      rounds: state.rounds + 1,
      trace: [{
        agent: graph.pipeline.reviewer,
        summary: rejected.length === 0 ? graph.approved : canRetry ? `Devolveu para correção: ${names}.` : `Ainda há pontos a conferir em: ${names}.`,
      }],
    };
  };

  const followers = graph.parts.filter((part) => part !== lead?.part);
  const done = graph.finish ? "finalizar" : END;
  let builder = new StateGraph(State) as unknown as Loose<S>;
  for (const part of graph.parts) builder = builder.addNode(part, writer(part));
  builder = builder.addNode("revisor", reviewer);
  let entry: string = START;
  if (graph.prepare) {
    const prepare = graph.prepare;
    builder = builder.addNode("preparo", async (state) => {
      const { prepared, summary } = await prepare(state.input, model);
      return { prepared, trace: [{ agent: graph.pipeline.preparer!, summary }] };
    }).addEdge(START, "preparo");
    entry = "preparo";
  }
  if (lead) {
    builder = builder.addEdge(entry, lead.part);
    entry = lead.part;
  }
  for (const part of followers) builder = builder.addEdge(entry, part).addEdge(part, "revisor");
  builder = builder.addConditionalEdges(
    "revisor",
    (state) => (!state.redo.length ? done : lead && state.redo.includes(lead.part) ? lead.part : state.redo),
    [...graph.parts, done],
  );
  if (graph.finish) {
    const finish = graph.finish;
    builder = builder.addNode("finalizar", async (state) => ({ trace: [{ agent: FINALIZATION, summary: finish(state.feedback) }] })).addEdge("finalizar", END);
  }

  const result = await builder.compile().invoke({ input }).catch((error: unknown) => { throw firstAgentError(error); });
  return { prepared: result.prepared, drafts: result.drafts, feedback: result.feedback, modelNotes: result.modelNotes, rounds: result.rounds, trace: result.trace };
}
