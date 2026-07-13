"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { createEventAction, type ActionState } from "../actions";

export function EventForm({ mailEnabled }: { mailEnabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createEventAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="title" required placeholder="Título del evento" className="field" />
        <input name="location" placeholder="Lugar (opcional)" className="field" />
        <input
          name="startsAt"
          type="datetime-local"
          required
          className="field"
          aria-label="Fecha y hora"
        />
      </div>
      <input
        name="url"
        type="url"
        placeholder="Enlace de inscripción (p. ej. la app del torneo)"
        className="field"
      />
      <textarea
        name="description"
        rows={3}
        placeholder="Descripción (opcional)"
        className="field resize-y"
      />
      <div className="flex flex-wrap items-center gap-4 text-sm text-ink-soft">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="notify"
            defaultChecked
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Notificar a todo el club (app + push)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="email"
            disabled={!mailEnabled}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          También por email
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
        <CalendarPlus className="h-4 w-4" />
        {pending ? "Creando…" : "Crear evento"}
      </button>
    </form>
  );
}
