"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { sendTrainingAction, type ActionState } from "./actions";

interface Option {
  id: number;
  name: string;
}

/** El profesor redacta un entrenamiento y elige a quién enviarlo. */
export function TrainingForm({
  groups,
  students,
}: {
  groups: Option[];
  students: Option[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    sendTrainingAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="title"
          required
          placeholder="Título (p. ej. Putts de 2 metros)"
          className="field"
        />
        <select name="target" required className="field" defaultValue="todos">
          <option value="todos">Todos mis alumnos</option>
          {groups.length > 0 ? (
            <optgroup label="Grupos">
              {groups.map((g) => (
                <option key={g.id} value={`grupo:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {students.length > 0 ? (
            <optgroup label="Alumnos">
              {students.map((s) => (
                <option key={s.id} value={`alumno:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
      <textarea
        name="description"
        required
        rows={4}
        placeholder="Describe los ejercicios, series, repeticiones…"
        className="field resize-y"
      />

      {state.error ? (
        <p className="rounded-2xl bg-negative/10 px-4 py-2.5 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-2xl bg-positive/10 px-4 py-2.5 text-sm text-positive">
          {state.ok}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary">
        <Send className="h-4 w-4" />
        {pending ? "Enviando…" : "Enviar entrenamiento"}
      </button>
    </form>
  );
}
