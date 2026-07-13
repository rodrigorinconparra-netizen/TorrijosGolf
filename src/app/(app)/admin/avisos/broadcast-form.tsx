"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { broadcastAction, type ActionState } from "../actions";

export function BroadcastForm({ mailEnabled }: { mailEnabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    broadcastAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input name="title" required placeholder="Título del aviso" className="field" />
      <textarea
        name="body"
        required
        rows={4}
        placeholder="Escribe el mensaje…"
        className="field resize-y"
      />
      <div className="flex flex-wrap items-center gap-4">
        <select name="audience" className="field !w-auto" defaultValue="todos">
          <option value="todos">Todo el club</option>
          <option value="alumnos">Solo alumnos</option>
          <option value="profesores">Solo profesores</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="email"
            disabled={!mailEnabled}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Enviar también por email
        </label>
      </div>

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
        {pending ? "Enviando…" : "Enviar aviso"}
      </button>
    </form>
  );
}
