import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAIEnabled } from "@/lib/agents/model";
import { DuaError } from "@/lib/dua/shared";
import { loadPlanning } from "@/lib/dua/plannings";
import { listSuggestions } from "@/lib/dua/suggestions";
import { listSupports } from "@/lib/dua/supports";
import { DuaEditor } from "@/components/dua/editor";

export const dynamic = "force-dynamic";

export default async function PlanningEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etapa?: string }> }) {
  const [{ id }, { etapa }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let data;
  try {
    const loaded = await loadPlanning(user, id);
    const [suggestions, supports] = await Promise.all([listSuggestions(user, id), listSupports(user, id)]);
    data = { ...loaded, suggestions, supports };
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const { planning, access, current, validated } = data;

  return (
    <DuaEditor
      key={current.version}
      planningId={planning.id}
      access={access}
      version={current.version}
      revision={current.revision}
      state={current.state}
      content={current.content}
      updatedAt={current.updatedAt.toISOString()}
      ownerName={planning.ownerName}
      sharing={planning.sharing}
      hasValidated={validated.length > 0}
      supportsCount={data.supports.length}
      suggestions={data.suggestions}
      aiOn={isAIEnabled()}
      initialStep={Math.max(0, Number(etapa ?? 1) - 1) || 0}
    />
  );
}
