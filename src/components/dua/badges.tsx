import { Badge } from "@/components/ui";
import { ORIGIN_LABEL, REVIEW_STATE_LABEL, type DuaOrigin, type ReviewState } from "@/lib/dua/domain";

export function ReviewBadge({ state }: { state: ReviewState }) {
  const tone = state === "validado" ? "green" : state === "em_revisao" ? "amber" : "neutral";
  return <Badge tone={tone}>{REVIEW_STATE_LABEL[state]}</Badge>;
}

export function OriginBadge({ origin }: { origin: DuaOrigin }) {
  return <Badge tone={origin.kind === "ia" ? "brand" : "neutral"}>{ORIGIN_LABEL[origin.kind]}</Badge>;
}
