"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  TORRIJOS,
  BARRA_LABEL,
  courseHandicap,
  strokesPerHole,
  type Barra,
  type Sexo,
} from "@/lib/course";

/**
 * Calculadora de hándicap de juego y golpes por hoyo. El usuario mete su
 * hándicap (índice), elige barra de salida y sexo, y ve cuántos golpes recibe
 * en cada hoyo (útil para gestionar torneos). Se prerrellena con los datos
 * del propio usuario si los tiene guardados.
 */
export function HandicapCard({
  defaultIndex = "",
  defaultSexo = "hombre",
}: {
  defaultIndex?: string;
  defaultSexo?: Sexo;
}) {
  const [index, setIndex] = useState(defaultIndex);
  const [barra, setBarra] = useState<Barra>("amarillas");
  const [sexo, setSexo] = useState<Sexo>(defaultSexo);

  const hi = parseFloat(index.replace(",", "."));
  const valid = Number.isFinite(hi);
  const { cr, sr } = TORRIJOS.rating[barra][sexo];
  const ch = valid ? courseHandicap(hi, sr, cr, TORRIJOS.par) : 0;
  const siList = TORRIJOS.scorecard.map((h) => h[barra].si);
  const strokes = strokesPerHole(ch, siList);
  const totalStrokes = strokes.reduce((a, b) => a + b, 0);

  return (
    <section className="glass p-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-muted" />
        <h2 className="font-semibold">Golpes por hoyo</h2>
      </div>
      <p className="mb-4 mt-1 text-sm text-muted">
        Introduce el hándicap del jugador, la barra de salida y el sexo para ver
        su hándicap de juego y los golpes que recibe en cada hoyo.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted">
          Hándicap (índice)
          <input
            value={index}
            onChange={(e) => setIndex(e.target.value)}
            inputMode="decimal"
            placeholder="p. ej. 12,4"
            className="field mt-1 !py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Barra de salida
          <select
            value={barra}
            onChange={(e) => setBarra(e.target.value as Barra)}
            className="field mt-1 !py-2 text-sm"
          >
            <option value="amarillas">Amarillas</option>
            <option value="rojas">Rojas</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Sexo
          <select
            value={sexo}
            onChange={(e) => setSexo(e.target.value as Sexo)}
            className="field mt-1 !py-2 text-sm"
          >
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
          </select>
        </label>
      </div>

      {valid ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-accent/8 px-4 py-3">
            <div>
              <p className="text-xs text-muted">Hándicap de juego</p>
              <p className="text-2xl font-semibold text-accent-deep">{ch}</p>
            </div>
            <div className="text-xs text-muted">
              {BARRA_LABEL[barra]} · {sexo === "hombre" ? "Hombres" : "Mujeres"} · CR{" "}
              {cr.toString().replace(".", ",")} · SR {sr}
            </div>
            <div className="ml-auto text-xs text-muted">
              Total golpes de ventaja:{" "}
              <span className="font-semibold text-ink">{totalStrokes}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {TORRIJOS.scorecard.map((h, i) => (
              <div
                key={h.n}
                className={`rounded-xl px-2.5 py-2 text-center ${
                  strokes[i] > 0
                    ? "bg-accent/12"
                    : strokes[i] < 0
                      ? "bg-negative/10"
                      : "bg-black/5"
                }`}
              >
                <p className="text-[11px] text-muted">Hoyo {h.n}</p>
                <p className="text-sm font-semibold text-ink">
                  {strokes[i] > 0 ? `+${strokes[i]}` : strokes[i]}
                </p>
                <p className="text-[10px] text-faint">
                  par {h.par} · idx {h[barra].si}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-faint">
            El número es cuántos golpes recibe en ese hoyo (par neto = par +
            golpes). El “idx” es el índice de dificultad del hoyo en esa barra.
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-faint">
          Escribe un hándicap para ver el reparto por hoyos.
        </p>
      )}
    </section>
  );
}
