"use client";

import { useActionState, useRef } from "react";
import { Upload } from "lucide-react";
import { uploadRankingAction, type RankingState } from "./actions";

/** Subida de una clasificación en PDF (solo admin). */
export function UploadRankingForm() {
  const [state, action, pending] = useActionState<RankingState, FormData>(
    uploadRankingAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await action(fd);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="title"
          required
          placeholder="Título (p. ej. Liga 9 hoyos 2025 — Final)"
          className="field"
        />
        <input name="description" placeholder="Descripción (opcional)" className="field" />
      </div>
      <input
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        required
        className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-accent hover:file:bg-accent-deep"
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
        <Upload className="h-4 w-4" />
        {pending ? "Subiendo…" : "Publicar clasificación"}
      </button>
    </form>
  );
}
