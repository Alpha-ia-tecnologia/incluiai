export type Problem = { field: string; message: string };
type UserErrorKind = "not_found" | "forbidden" | "conflict" | "invalid";

export class UserError extends Error {
  readonly kind: UserErrorKind;
  readonly problems: Problem[];

  constructor(message: string, kind: UserErrorKind = "invalid", problems: Problem[] = []) {
    super(message);
    this.name = "UserError";
    this.kind = kind;
    this.problems = problems;
  }
}
