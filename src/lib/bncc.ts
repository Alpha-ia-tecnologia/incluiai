import "server-only";
import data from "../../prisma/data/bncc.json";
import { normalizeCode, type BnccSkill } from "./bncc-core";

// Texto oficial do MEC (PDF homologado), na estrutura do projeto bncc-dados (CC BY 4.0).

export const BNCC = data as BnccSkill[];
const byCode = new Map(BNCC.map((skill) => [skill.code, skill]));

export const bnccSkill = (code: string | null | undefined): BnccSkill | null => (code ? byCode.get(normalizeCode(code)) ?? null : null);

export const validBnccCode = (code: string | null | undefined): string | null => bnccSkill(code)?.code ?? null;
