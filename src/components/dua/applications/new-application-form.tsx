"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { createDuaApplication } from "@/actions/dua";
import { APPLICATION_CONTEXTS, APPLICATION_CONTEXT_LABEL, type ApplicationContext } from "@/lib/dua/domain";
import { Field, ResultMessage, buttonCls, inputCls, labelCls, textareaCls } from "../dua-ui";
import { ParticipantPicker, type StudentOption } from "./participant-picker";

export type ValidatedVersionOption = { version: number; label: string; resources: string; organization: string };
type Feedback = { ok: boolean; message?: string; problems?: { field: string; message: string }[] } | null;

// Nova aplicação (RF07): só de versão validada. Registra quando, onde e com quem
// a atividade acontece — não é presença nem atendimento do AEE (CA10).
export function NewApplicationForm({ planningId, versions, defaultClassName, defaultContext, today, students }: {
  planningId: string;
  versions: ValidatedVersionOption[];
  defaultClassName: string;
  defaultContext: ApplicationContext;
  today: string;
  students: StudentOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [versionNumber, setVersionNumber] = useState(versions[0]?.version ?? 0);
  const [className, setClassName] = useState(defaultClassName);
  const [participants, setParticipants] = useState<string[]>([]);
  // Trocar a chave remonta o formulário: os campos voltam ao valor inicial sem
  // dessincronizar os controlados (versão, turma e participantes).
  const [formKey, setFormKey] = useState(0);
  const chosen = versions.find((item) => item.version === versionNumber);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const outcome = await createDuaApplication({
        planningId,
        versionNumber,
        context: String(data.get("context") ?? ""),
        date: String(data.get("date") ?? ""),
        className,
        participantIds: participants,
        resources: String(data.get("resources") ?? ""),
        organization: String(data.get("organization") ?? ""),
        notes: String(data.get("notes") ?? ""),
      });
      if (!outcome.ok) {
        setFeedback(outcome);
        return;
      }
      setFeedback({ ok: true, message: "Aplicação registrada. Registre o que observou com cada participante na lista abaixo." });
      setParticipants([]);
      setClassName(defaultClassName);
      setFormKey((key) => key + 1);
      router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <form key={formKey} onSubmit={submit} className="grid min-w-0 gap-4 sm:grid-cols-2" noValidate>
        <Field id="ap-versao" label="Versão validada a aplicar" hint="A aplicação fica presa a esta versão, mesmo que o planejamento ganhe versões novas.">
          <select id="ap-versao" className={inputCls} value={versionNumber} onChange={(event) => setVersionNumber(Number(event.target.value))} aria-describedby="ap-versao-dica">
            {versions.map((item) => <option key={item.version} value={item.version}>{item.label}</option>)}
          </select>
        </Field>
        <Field id="ap-data" label="Data da aplicação">
          <input id="ap-data" name="date" type="date" required defaultValue={today} className={inputCls} />
        </Field>
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className={labelCls}>Onde a atividade acontece</legend>
          <div className="flex min-w-0 flex-wrap gap-x-6">
            {APPLICATION_CONTEXTS.map((context) => (
              <label key={context} className="flex min-h-11 min-w-0 items-center gap-2 text-sm text-ink">
                <input type="radio" name="context" value={context} defaultChecked={context === defaultContext} className="size-4 shrink-0 accent-[var(--brand)]" />
                {APPLICATION_CONTEXT_LABEL[context]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Field id="ap-turma" label="Turma ou grupo" hint="Vem da turma do planejamento. Mude se a atividade for aplicada em outro grupo.">
            <input id="ap-turma" type="text" maxLength={80} value={className} onChange={(event) => setClassName(event.target.value)} className={inputCls} aria-describedby="ap-turma-dica" />
          </Field>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <ParticipantPicker
            idPrefix="ap-participantes"
            legend="Participantes"
            hint="Aparecem só os estudantes que você acompanha. Os participantes recebem o registro de evidência depois da atividade."
            students={students}
            className={className}
            selected={participants}
            onChange={setParticipants}
          />
        </div>
        <Field id="ap-recursos" label="Recursos disponíveis" hint={chosen?.resources ? `Previsto no planejamento: ${chosen.resources}` : "O que estava de fato à mão: materiais, equipamentos, espaço."}>
          <textarea id="ap-recursos" name="resources" maxLength={1200} className={textareaCls} aria-describedby="ap-recursos-dica" />
        </Field>
        <Field id="ap-organizacao" label="Organização da turma ou do grupo" hint={chosen?.organization ? `Previsto no planejamento: ${chosen.organization}` : "Ex.: em duplas, em roda, em grupos de quatro."}>
          <textarea id="ap-organizacao" name="organization" maxLength={1200} className={textareaCls} aria-describedby="ap-organizacao-dica" />
        </Field>
        <div className="sm:col-span-2">
          <Field id="ap-observacoes" label="Observações (opcional)">
            <textarea id="ap-observacoes" name="notes" maxLength={2000} className={textareaCls} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} aria-busy={pending} className={buttonCls}>
            <CalendarCheck size={16} aria-hidden /> {pending ? "Registrando…" : "Registrar a aplicação"}
          </button>
        </div>
      </form>
      {/* Fora do formulário remontado, para a mensagem ser anunciada. */}
      <ResultMessage result={feedback} />
    </div>
  );
}
