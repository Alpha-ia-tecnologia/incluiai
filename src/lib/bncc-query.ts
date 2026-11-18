import type { BnccSkill } from "./bncc-core.ts";

export type BnccOption = Pick<BnccSkill, "code" | "component" | "years" | "description">;
export const bnccOption = ({ code, component, years, description }: BnccSkill): BnccOption => ({ code, component, years, description });

export type BnccQuery = { codes?: string[]; text?: string; studentId?: string; suggest?: string; dimension?: string };

const PARAM = { codes: "codigos", text: "q", studentId: "estudante", suggest: "sugerir", dimension: "dimensao" } as const;

export function bnccSearchUrl(query: BnccQuery): string {
  const search = new URLSearchParams();
  const values = { ...query, codes: query.codes?.join(",") };
  for (const key of Object.keys(PARAM) as (keyof typeof PARAM)[]) {
    if (values[key]) search.set(PARAM[key], values[key]);
  }
  return `/api/bncc?${search}`;
}

export function readBnccQuery(params: URLSearchParams): BnccQuery {
  const value = (key: keyof typeof PARAM) => params.get(PARAM[key]) || undefined;
  return { codes: value("codes")?.split(","), text: value("text"), studentId: value("studentId"), suggest: value("suggest"), dimension: value("dimension") };
}
