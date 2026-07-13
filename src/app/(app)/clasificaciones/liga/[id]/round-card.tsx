"use client";

import { useActionState, useState } from "react";
import { Save, PenLine, Minus, Plus, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveScoresAction,
  signRoundAction,
  type LeagueState,
} from "../../liga-actions";

export interface HoleInfo {
  n: number;
  par: number;
  si: number;
}

/**
 * Tarjeta de una vuelta con doble anotación: yo edito mi columna y veo la del
 * otro (jugador ↔ marcador). Solo se puede firmar cuando ambas tarjetas están
 * completas, coinciden y no hay cambios sin guardar. Con las dos firmas, la
 * vuelta se cierra y suma a la clasificación.
 */
export function RoundCard({
  roundId,
  holes,
  initialScores,
  otherScores,
  otherLabel,
  courseHcp,
  signedMe,
  signedOther,
}: {
  roundId: number;
  holes: HoleInfo[];
  initialScores: number[];
  otherScores: number[];
  /** "marcador" o el nombre del jugador cuya tarjeta marco. */
  otherLabel: string;
  courseHcp: number;
  signedMe: boolean;
  signedOther: boolean;
}) {
  const [scores, setScores] = useState<number[]>(initialScores);
  const [saved, setSaved] = useState<number[]>(initialScores);
  const [saveState, save, saving] = useActionState<LeagueState, FormData>(
    async (prev, fd) => {
      const r = await saveScoresAction(prev, fd);
      if (r.ok) setSaved([...scores]);
      return r;
    },
    {},
  );
  const [signState, sign, signing] = useActionState<LeagueState, FormData>(
    signRoundAction,
    {},
  );

  const filled = scores.filter((s) => s > 0).length;
  const gross = scores.reduce((a, b) => a + b, 0);
  const complete = filled === holes.length;
  const otherComplete = otherScores.every((s) => s > 0);
  const dirty = JSON.stringify(scores) !== JSON.stringify(saved);
  const matches =
    complete && otherComplete && scores.every((s, i) => s === otherScores[i]);
  const canSign = matches && !dirty && !signedMe;

  return (
    <div className="space-y-4">
      {/* Hoyos en columna, grandes (pensado para el móvil en el campo) */}
      <div className="space-y-2">
        {holes.map((h, i) => {
          const mine = scores[i];
          const theirs = otherScores[i];
          const conflict = mine > 0 && theirs > 0 && mine !== theirs;
          return (
            <div
              key={h.n}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3",
                conflict ? "bg-negative/10" : "bg-white/60",
              )}
            >
              <div className="w-20 shrink-0">
                <p className="text-base font-semibold text-ink">Hoyo {h.n}</p>
                <p className="text-xs text-muted">par {h.par}</p>
              </div>

              <div className="flex flex-1 items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={mine <= 0}
                  onClick={() =>
                    setScores((prev) => prev.map((s, j) => (j === i ? s - 1 : s)))
                  }
                  className="grid h-11 w-11 place-items-center rounded-xl bg-black/5 text-ink-soft transition active:scale-95 disabled:opacity-30"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <span
                  className={cn(
                    "w-12 text-center text-3xl font-bold tabular-nums",
                    mine === 0 ? "text-faint" : "text-ink",
                  )}
                >
                  {mine === 0 ? "·" : mine}
                </span>
                <button
                  type="button"
                  disabled={mine >= 20}
                  onClick={() =>
                    setScores((prev) =>
                      prev.map((s, j) => (j === i ? (s === 0 ? h.par : s + 1) : s)),
                    )
                  }
                  className="grid h-11 w-11 place-items-center rounded-xl bg-accent/12 text-accent transition active:scale-95 disabled:opacity-30"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Lo que lleva anotado el otro */}
              <div className="w-16 shrink-0 text-center">
                <p className="text-[10px] uppercase tracking-wide text-faint">
                  {otherLabel}
                </p>
                <p
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    theirs === 0
                      ? "text-faint"
                      : conflict
                        ? "text-negative"
                        : "text-positive",
                  )}
                >
                  {theirs === 0 ? "·" : theirs}
                  {theirs > 0 && mine > 0 ? (
                    conflict ? (
                      <X className="ml-0.5 inline h-3.5 w-3.5" />
                    ) : (
                      <Check className="ml-0.5 inline h-3.5 w-3.5" />
                    )
                  ) : null}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-accent/8 px-4 py-3 text-sm">
        <span className="text-muted">
          Anotados <span className="font-semibold text-ink">{filled}/{holes.length}</span>
        </span>
        <span className="text-muted">
          Bruto <span className="font-semibold text-ink">{gross}</span>
        </span>
        <span className="text-muted">
          Hcp <span className="font-semibold text-ink">{courseHcp}</span>
        </span>
        {complete ? (
          <span className="text-muted">
            Neto <span className="font-semibold text-accent-deep">{gross - courseHcp}</span>
          </span>
        ) : null}
      </div>

      {/* Estado de coincidencia y firmas */}
      {complete && otherComplete && !matches ? (
        <p className="rounded-2xl bg-negative/10 px-4 py-2.5 text-sm text-negative">
          Las tarjetas no coinciden en los hoyos marcados en rojo. Revisadlo antes
          de firmar.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 font-medium",
            signedMe ? "bg-positive/12 text-positive" : "bg-black/5 text-muted",
          )}
        >
          {signedMe ? "✓ Has firmado" : "Tu firma pendiente"}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 font-medium",
            signedOther ? "bg-positive/12 text-positive" : "bg-black/5 text-muted",
          )}
        >
          {signedOther ? "✓ Firma del otro puesta" : "Firma del otro pendiente"}
        </span>
      </div>

      {saveState.error || signState.error ? (
        <p className="rounded-2xl bg-negative/10 px-4 py-2.5 text-sm text-negative">
          {saveState.error ?? signState.error}
        </p>
      ) : null}
      {signState.ok ? (
        <p className="rounded-2xl bg-positive/10 px-4 py-2.5 text-sm text-positive">
          {signState.ok}
        </p>
      ) : saveState.ok && !dirty ? (
        <p className="rounded-2xl bg-positive/10 px-4 py-2.5 text-sm text-positive">
          {saveState.ok}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={save}>
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="scores" value={JSON.stringify(scores)} />
          <button
            type="submit"
            disabled={saving || !dirty}
            className="btn-ghost !px-4 !py-2.5 text-sm"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
          </button>
        </form>
        <form action={sign}>
          <input type="hidden" name="roundId" value={roundId} />
          <button
            type="submit"
            disabled={signing || !canSign}
            title={
              signedMe
                ? "Ya has firmado"
                : dirty
                  ? "Guarda tus cambios antes de firmar"
                  : !complete || !otherComplete
                    ? "Las dos tarjetas deben estar completas"
                    : !matches
                      ? "Las tarjetas deben coincidir"
                      : undefined
            }
            className="btn-primary !px-4 !py-2.5 text-sm"
          >
            <PenLine className="h-4 w-4" />
            {signing ? "Firmando…" : signedMe ? "Firmada" : "Firmar tarjeta"}
          </button>
        </form>
      </div>
    </div>
  );
}
