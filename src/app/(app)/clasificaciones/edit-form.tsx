"use client";

import { useActionState } from "react";
import { Pencil, Save } from "lucide-react";
import { editRankingAction, type RankingState } from "./actions";

/** Edición de una clasificación (nombre, descripción y, opcional, el PDF). */
export function RankingEditForm({
  id,
  title,
  description,
}: {
  id: number;
  title: string;
  description: string;
}) {
  const [state, action, pending] = useActionState<RankingState, FormData>(
    editRankingAction,
    {},
  );

  return (
    <details className="group mt-2 w-full">
      <summary className="flex w-fit cursor-pointer items-center gap-1 text-xs font-medium text-accent">
        <Pencil className="h-3 w-3" /> Editar
      </summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="id" value={id} />
        <input
          name="title"
          defaultValue={title}
          required
          placeholder="Título"
          className="field !py-2 text-sm"
        />
        <input
          name="description"
          defaultValue={description}
          placeholder="Descripción (opcional)"
          className="field !py-2 text-sm"
        />
        <div>
          <p className="mb-1 text-xs text-muted">
            Cambiar el PDF (opcional; si lo dejas vacío se mantiene el actual)
          </p>
          <input
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            className="block w-full text-xs text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-on-accent hover:file:bg-accent-deep"
          />
        </div>

        {state.error ? (
          <p className="rounded-xl bg-negative/10 px-3 py-1.5 text-xs text-negative">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="rounded-xl bg-positive/10 px-3 py-1.5 text-xs text-positive">
            {state.ok}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary !px-3 !py-1.5 text-xs">
          <Save className="h-3.5 w-3.5" />
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </details>
  );
}
