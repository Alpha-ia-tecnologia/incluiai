import { z } from "zod/v4";
import { OBJECTIVE_STATUSES } from "../scale.ts";

const studentId = z.string();

const PROPOSALS = {
  registrar_aula: {
    label: "Registro de aula",
    args: z.object({
      studentId,
      objectiveId: z.string().nullable(),
      activityId: z.string().nullable(),
      participation: z.string(),
      supportLevel: z.number(),
      criterionMet: z.string(),
      note: z.string().nullable(),
      whatWorked: z.string().nullable(),
      recommendation: z.string().nullable(),
      authorRole: z.string(),
    }),
  },
  decidir_atividade: {
    label: "Decisão sobre atividade",
    args: z.object({ studentId, activityId: z.string(), decision: z.enum(["aceita", "rejeitada"]), reason: z.string().nullable() }),
  },
  marcar_objetivo: {
    label: "Situação do objetivo",
    args: z.object({ studentId, objectiveId: z.string(), status: z.enum(OBJECTIVE_STATUSES) }),
  },
  contar_conquista: {
    label: "Conquista de casa",
    args: z.object({ studentId, note: z.string(), author: z.string() }),
  },
  enviar_orientacoes: {
    label: "Orientações para a escola",
    args: z.object({
      studentId,
      communication: z.string(),
      accessResources: z.string(),
      positioning: z.string().nullable(),
      facilitators: z.string(),
      schoolGuidance: z.string(),
      strategiesToTry: z.string(),
      sharedGoals: z.string(),
    }),
  },
} satisfies Record<string, { label: string; args: z.ZodObject<{ studentId: z.ZodString }> }>;

export type ProposalKind = keyof typeof PROPOSALS;
export type ProposalArgs<K extends ProposalKind> = z.output<(typeof PROPOSALS)[K]["args"]>;

export const isProposalKind = (kind: string): kind is ProposalKind => Object.hasOwn(PROPOSALS, kind);

export const proposalLabel = (kind: string): string => (isProposalKind(kind) ? PROPOSALS[kind].label : kind);

export function writeProposalArgs<K extends ProposalKind>(kind: K, args: ProposalArgs<K>): string {
  return JSON.stringify(PROPOSALS[kind].args.parse(args));
}

export function readProposalArgs<K extends ProposalKind>(kind: K, stored: string): ProposalArgs<K> {
  return PROPOSALS[kind].args.parse(JSON.parse(stored)) as ProposalArgs<K>;
}
