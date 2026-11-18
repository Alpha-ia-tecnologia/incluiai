import { planningContext } from "@/lib/page-context";
import { isAIEnabled } from "@/lib/agents/capabilities";
import { listSuggestions } from "@/lib/dua/suggestions";
import { listSupports } from "@/lib/dua/supports";
import { DuaEditor } from "@/components/dua/editor";
import { stepFromParam } from "@/components/dua/editor-steps";

export default async function PlanningEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etapa?: string }> }) {
  const [{ id }, { etapa }] = await Promise.all([params, searchParams]);
  const { user, planning, access, current, validated } = await planningContext(id);
  const [suggestions, supports] = await Promise.all([listSuggestions(user, id), listSupports(user, id)]);

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
      supportsCount={supports.length}
      suggestions={suggestions}
      aiOn={isAIEnabled()}
      initialStep={stepFromParam(etapa)}
    />
  );
}
