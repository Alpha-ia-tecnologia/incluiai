"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FileText, Sprout } from "lucide-react";
import { createDuaMaterial } from "@/actions/dua";
import { MATERIAL_ACCESSIBILITY, MATERIAL_FORMATS, MATERIAL_FORMAT_LABEL, REVIEW_STATE_LABEL, type MaterialFormat, type MaterialScope, type ReviewState } from "@/lib/dua/domain";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, hintCls, inputCls, labelCls, linkCls, textareaCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";

type Option = { id: string; label: string };

export function NewMaterialForm({ planningId, versions, defaultVersion, canCollective, supports, library }: {
  planningId: string;
  versions: { version: number; state: ReviewState }[];
  defaultVersion: number;
  canCollective: boolean;
  supports: Option[];
  library: Option[];
}) {
  const { result, pending, submit } = useActionResult<{ id: string }>();
  const [versionNumber, setVersionNumber] = useState(defaultVersion);
  const [format, setFormat] = useState<MaterialFormat>(MATERIAL_FORMATS[0]);
  const [scope, setScope] = useState<MaterialScope>(canCollective ? "coletivo" : "individual");
  const [supportId, setSupportId] = useState(supports[0]?.id ?? "");
  const [resourceId, setResourceId] = useState(library[0]?.id ?? "");
  const [formKey, setFormKey] = useState(0);
  const chosen = versions.find((item) => item.version === versionNumber);

  const createdId = result?.ok ? result.value.id : null;

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    submit(() => createDuaMaterial({
      planningId,
      versionNumber,
      format,
      purpose: String(data.get("purpose") ?? ""),
      scope,
      supportId: scope === "individual" ? supportId : "",
      resourceId: format === "anexo" ? resourceId : "",
    }), { onSuccess: () => setFormKey((key) => key + 1) });
  }

  return (
    <div className="min-w-0">
      <form key={formKey} onSubmit={prepare} className="grid min-w-0 gap-4 sm:grid-cols-2" noValidate>
        <Field id="mat-versao" label="Versão de origem" hint="Pode ser qualquer versão. Versão que ainda não foi validada gera material de rascunho.">
          {(control) => (
            <select {...control} value={versionNumber} onChange={(event) => setVersionNumber(Number(event.target.value))} className={inputCls}>
              {versions.map((item) => <option key={item.version} value={item.version}>Versão {item.version} · {REVIEW_STATE_LABEL[item.state]}</option>)}
            </select>
          )}
        </Field>
        <Field id="mat-formato" label="Formato" hint={`Recursos de acessibilidade: ${MATERIAL_ACCESSIBILITY[format].join(", ")}.`}>
          {(control) => (
            <select {...control} value={format} onChange={(event) => setFormat(event.target.value as MaterialFormat)} className={inputCls}>
              {MATERIAL_FORMATS.map((item) => <option key={item} value={item}>{MATERIAL_FORMAT_LABEL[item]}</option>)}
            </select>
          )}
        </Field>
        {chosen && chosen.state !== "validado" ? (
          <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm leading-relaxed text-amber sm:col-span-2">
            A versão {chosen.version} está como “{REVIEW_STATE_LABEL[chosen.state]}”: o material sai como rascunho, impresso com o aviso de RASCUNHO, e só pode ser validado depois que a versão for validada.
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <Field id="mat-finalidade" label="Finalidade pedagógica (obrigatória)" hint="Para que o material serve nesta atividade. Ex.: apoiar a compreensão das etapas da proposta.">
            {(control) => <textarea {...control} name="purpose" required maxLength={600} className={textareaCls} />}
          </Field>
        </div>
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className={labelCls}>Para quem é o material</legend>
          <div className="grid min-w-0 gap-1">
            <label className="flex min-h-11 min-w-0 items-start gap-2 py-1 text-sm text-ink">
              <input type="radio" name="scope" value="coletivo" checked={scope === "coletivo"} disabled={!canCollective} onChange={() => setScope("coletivo")} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
              <span className="min-w-0">Coletivo, para a turma{!canCollective ? <span className="text-ink-soft"> — só quem edita o planejamento prepara materiais da turma</span> : null}</span>
            </label>
            <label className="flex min-h-11 min-w-0 items-start gap-2 py-1 text-sm text-ink">
              <input type="radio" name="scope" value="individual" checked={scope === "individual"} disabled={!supports.length} onChange={() => setScope("individual")} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
              <span className="min-w-0">Individual, para um estudante, a partir do apoio planejado{!supports.length ? <span className="text-ink-soft"> — não há apoio individual que você possa usar (veja a aba Apoios individuais)</span> : null}</span>
            </label>
          </div>
        </fieldset>
        {scope === "individual" && supports.length ? (
          <div className="sm:col-span-2">
            <Field id="mat-apoio" label="Apoio individual" hint="Só aparecem os apoios que você pode editar. O material individual fica restrito a quem acompanha o estudante.">
              {(control) => (
                <select {...control} value={supportId} onChange={(event) => setSupportId(event.target.value)} className={inputCls}>
                  {supports.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              )}
            </Field>
          </div>
        ) : null}
        {format === "anexo" ? (
          <div className="sm:col-span-2">
            {library.length ? (
              <Field id="mat-biblioteca" label="Material da biblioteca a anexar">
                {(control) => (
                  <select {...control} value={resourceId} onChange={(event) => setResourceId(event.target.value)} className={inputCls}>
                    {library.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                )}
              </Field>
            ) : <p className={hintCls}>A biblioteca municipal ainda não tem materiais para anexar.</p>}
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} aria-busy={pending} className={BUTTON_CLS.primary}>
            <FileText size={16} aria-hidden /> {pending ? "Preparando…" : "Preparar o material"}
          </button>
        </div>
      </form>
      <div role="status" aria-live="polite">
        {createdId ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-green-soft px-3 py-2 text-sm text-green">
            <Sprout size={16} aria-hidden className="sprout-mark mt-0.5 shrink-0 text-green" />
            <span className="min-w-0">
              Material preparado. Confira o conteúdo antes de usar.{" "}
              <Link href={`/planejamento/${planningId}/materiais/${createdId}`} className={linkCls}>Abrir o material</Link>
            </span>
          </p>
        ) : null}
      </div>
      {result && !result.ok ? <FormResult result={result} /> : null}
    </div>
  );
}
