"use client";

import { useState } from "react";
import { hintCls, inputCls, labelCls } from "../dua-ui";

export type StudentOption = { id: string; name: string; className: string; gradeYear: string };

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Escolha de participantes por caixas de seleção (sem arrastar). Começa pela
// turma informada; quem já foi marcado continua visível ao trocar o filtro,
// para nada ser enviado sem estar à vista.
export function ParticipantPicker({ idPrefix, legend, hint, students, className, selected, onChange, exclude = [] }: {
  idPrefix: string;
  legend: string;
  hint?: string;
  students: StudentOption[];
  className: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  exclude?: string[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const turma = className.trim();
  const available = students.filter((student) => !exclude.includes(student.id));
  const byClass = turma ? available.filter((student) => student.className === turma) : available;
  const pool = showAll || !turma ? available : byClass;
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const visible = available.filter((student) => selected.includes(student.id) || (pool.includes(student) && terms.every((term) => normalize(student.name).includes(term))));
  const toggle = (studentId: string, checked: boolean) => onChange(checked ? [...selected, studentId] : selected.filter((item) => item !== studentId));

  return (
    <fieldset className="min-w-0">
      <legend className={labelCls}>{legend}</legend>
      {hint ? <p className={hintCls}>{hint}</p> : null}
      <div className="mb-3 grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {turma ? (
          <label className="flex min-h-11 min-w-0 items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} className="size-4 shrink-0 accent-[var(--brand)]" />
            <span className="min-w-0">Mostrar estudantes de todas as turmas (não só {turma})</span>
          </label>
        ) : <p className="text-sm text-ink-soft">Sem turma informada: aparecem todos os estudantes que você acompanha.</p>}
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-busca`} className={labelCls}>Buscar estudante pelo nome</label>
          <input id={`${idPrefix}-busca`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={inputCls} />
        </div>
      </div>
      {visible.length ? (
        <ul className="grid min-w-0 gap-1 sm:grid-cols-2">
          {visible.map((student) => (
            <li key={student.id} className="min-w-0">
              <label className="flex min-h-11 min-w-0 items-start gap-2 py-1 text-sm text-ink">
                <input type="checkbox" checked={selected.includes(student.id)} onChange={(event) => toggle(student.id, event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                <span className="min-w-0 break-words">{student.name} <span className="text-ink-soft">· {student.className}</span></span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">{turma && !showAll ? `Nenhum estudante da turma ${turma} no seu acesso. Marque a opção acima para ver as outras turmas.` : "Nenhum estudante encontrado no seu acesso."}</p>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-xs text-ink-soft">{selected.length} participante(s) marcado(s){byClass.length && turma ? ` · ${byClass.length} na turma ${turma}` : ""}</p>
    </fieldset>
  );
}
