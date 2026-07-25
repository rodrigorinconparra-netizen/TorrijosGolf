"use client";

import { useActionState } from "react";
import { Tag } from "lucide-react";
import { createOfferAction, type OfferState } from "./actions";

/** Alta de una oferta de clases (bono) con cartel opcional. */
export function OfferForm() {
  const [state, action, pending] = useActionState<OfferState, FormData>(
    createOfferAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input
        name="title"
        required
        placeholder="Título (p. ej. Bono 10 clases)"
        className="field"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="classCount"
          type="number"
          min="1"
          placeholder="Nº de clases (p. ej. 10)"
          className="field"
        />
        <input
          name="price"
          type="number"
          step="0.5"
          min="0"
          placeholder="Precio del bono (€)"
          className="field"
        />
      </div>
      <textarea
        name="description"
        rows={3}
        placeholder="Condiciones de la oferta (validez, profesor, etc.)"
        className="field"
      />
      <label className="block text-sm text-muted">
        Cartel de la oferta (imagen, opcional)
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="field mt-1 file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-accent"
        />
      </label>

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
        <Tag className="h-4 w-4" />
        {pending ? "Publicando…" : "Publicar oferta"}
      </button>
    </form>
  );
}
