import "server-only";
import data from "../../prisma/data/bncc.json";
import { normalizeCode, type BnccSkill } from "./bncc-core";

// Base da BNCC no servidor: texto oficial do MEC (PDF homologado), na estrutura
// do projeto bncc-dados (CC BY 4.0). Regras de busca e sugestão em bncc-core.ts.

export const BNCC = data as BnccSkill[];
const byCode = new Map(BNCC.map((skill) => [skill.code, skill]));

export const bnccSkill = (code: string | null | undefined): BnccSkill | null => (code ? byCode.get(normalizeCode(code)) ?? null : null);

// Código conferido na base (ou null): o que a IA ou a pessoa escreveu e não existe não é gravado.
export const validBnccCode = (code: string | null | undefined): string | null => bnccSkill(code)?.code ?? null;
