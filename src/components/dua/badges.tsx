import { Badge } from "@/components/ui";
import { ORIGIN_LABEL, REVIEW_STATE, type DuaOrigin, type ReviewState } from "@/lib/dua/domain";

export function ReviewBadge({ state }: { state: ReviewState }) {
  return <Badge tone={REVIEW_STATE[state].tone}>{REVIEW_STATE[state].label}</Badge>;
}

export function OriginBadge({ origin }: { origin: DuaOrigin }) {
  return <Badge tone={origin.kind === "ia" ? "info" : "neutral"}>{ORIGIN_LABEL[origin.kind]}</Badge>;
}
