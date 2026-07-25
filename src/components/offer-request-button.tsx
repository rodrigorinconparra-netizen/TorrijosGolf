"use client";

import { useActionState } from "react";
import { Check, Tag } from "lucide-react";
import {
  requestOfferAction,
  type OfferState,
} from "@/app/(app)/admin/ofertas/actions";

/** Botón para que el alumno solicite una oferta. Queda pendiente de confirmar. */
export function OfferRequestButton({ offerId }: { offerId: number }) {
  const [state, action, pending] = useActionState<OfferState, FormData>(
    requestOfferAction,
    {},
  );

  if (state.ok) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full bg-positive/12 px-3 py-1.5 text-sm font-medium text-positive">
        <Check className="h-4 w-4" /> {state.ok}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="offerId" value={offerId} />
      <button type="submit" disabled={pending} className="btn-primary">
        <Tag className="h-4 w-4" />
        {pending ? "Enviando…" : "Solicitar oferta"}
      </button>
      {state.error ? (
        <p className="text-sm text-negative">{state.error}</p>
      ) : null}
    </form>
  );
}
