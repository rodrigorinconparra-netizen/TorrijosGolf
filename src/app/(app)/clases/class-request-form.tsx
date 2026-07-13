"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { createClassRequestAction, type ActionState } from "./actions";
import { WEEKDAYS } from "@/lib/utils";

interface Option {
  id: number;
  name: string;
}

/**
 * El profesor propone una nueva clase (individual o grupo con alumnos). No se
 * crea nada: se envía al club para que un admin la acepte o rechace.
 */
export function ClassRequestForm({ students }: { students: Option[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createClassRequestAction,
    {},
  );
  const [kind, setKind] = useState<"individual" | "grupal">("grupal");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <select
          name="kind"
          className="field"
          value={kind}
          onChange={(e) => setKind(e.target.value as "individual" | "grupal")}
        >
          <option value="grupal">Grupo</option>
          <option value="individual">Individual</option>
        </select>

        <select name="weekday" className="field" defaultValue="1">
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i + 1}>
              {d}
            </option>
          ))}
        </select>

        <input name="startTime" type="time" required className="field" defaultValue="17:00" />

        <select name="durationMin" className="field" defaultValue="60">
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">1 hora</option>
          <option value="90">1 h 30 min</option>
          <option value="120">2 horas</option>
        </select>

        <input
          name="price"
          type="number"
          step="0.5"
          min="0"
          placeholder="Precio sugerido (€)"
          className="field"
        />

        {kind === "grupal" ? (
          <input name="groupName" placeholder="Nombre del grupo" className="field" />
        ) : (
          <select name="studentId" className="field" defaultValue="">
            <option value="" disabled>
              Alumno…
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {kind === "grupal" ? (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-soft">
            Alumnos del grupo ({selected.size})
          </p>
          {students.length === 0 ? (
            <p className="text-xs text-faint">No hay alumnos disponibles.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {students.map((s) => {
                const on = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={
                      on
                        ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-on-accent"
                        : "rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-ink-soft transition hover:bg-black/10"
                    }
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="studentIds" value={id} />
          ))}
        </div>
      ) : null}

      <textarea
        name="note"
        rows={2}
        placeholder="Nota para el club (opcional): objetivos, nivel…"
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
        {pending ? "Enviando…" : "Enviar solicitud al club"}
      </button>
    </form>
  );
}
