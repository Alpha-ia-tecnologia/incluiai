import "server-only";
import { getCurrentUser, type SessionUser } from "../auth";
import { SESSION_ENDED } from "../action-result";
import { unavailableResponse } from "../tenant";
import { UserError } from "../user-error";

const STATUS: Record<UserError["kind"], number> = { not_found: 404, forbidden: 403, conflict: 409, invalid: 400 };

export async function assistantRoute(work: (user: SessionUser) => Promise<Response>): Promise<Response> {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: SESSION_ENDED }, { status: 401 });
  try {
    return await work(user);
  } catch (error) {
    if (!(error instanceof UserError)) throw error;
    return Response.json({ error: error.message }, { status: STATUS[error.kind] });
  }
}
