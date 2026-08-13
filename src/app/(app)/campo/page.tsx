import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { TORRIJOS } from "@/lib/course";
import { HandicapCard } from "./handicap-card";

export const metadata = { title: "Campo" };

export default async function CoursePage() {
  const user = await requireSession();
  const [me] = await db
    .select({ handicapIndex: users.handicapIndex, sex: users.sex })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);
  // El hándicap se guarda como number (WHS actualizado desde la RFEG). En el
  // input lo mostramos con coma decimal, que es como se escribe en España.
  const defaultIndex =
    me?.handicapIndex != null
      ? me.handicapIndex.toString().replace(".", ",")
      : "";
  const defaultSexo: "hombre" | "mujer" = me?.sex === "mujer" ? "mujer" : "hombre";

  const sc = TORRIJOS.scorecard;
  const ida = sc.slice(0, 9);
  const vuelta = sc.slice(9, 18);
  const sum = (arr: typeof sc, pick: (h: (typeof sc)[number]) => number) =>
    arr.reduce((a, h) => a + pick(h), 0);

  return (
    <>
      <PageHeader
        title="Campo"
        subtitle={`${TORRIJOS.name} · Recorrido ${TORRIJOS.code} · Par ${TORRIJOS.par} · 18 hoyos`}
      />

      {/* Slopes / valoración del campo */}
      <section className="glass p-6">
        <h2 className="font-semibold">Valoración del campo</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Course Rating (CR) y Slope Rating (SR) por barra de salida y sexo.
          Válido desde {TORRIJOS.validFrom}.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-black/8 text-left text-xs text-muted">
                <th className="pb-2 pr-4 font-medium">Barra</th>
                <th className="pb-2 pr-4 font-medium">Hombres CR</th>
                <th className="pb-2 pr-4 font-medium">Hombres SR</th>
                <th className="pb-2 pr-4 font-medium">Mujeres CR</th>
                <th className="pb-2 font-medium">Mujeres SR</th>
              </tr>
            </thead>
            <tbody>
              {(["amarillas", "rojas"] as const).map((b) => (
                <tr key={b} className="border-b border-black/5 last:border-0">
                  <td className="py-2.5 pr-4 font-medium capitalize text-ink">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          b === "amarillas" ? "bg-[#f5c518]" : "bg-[#e5484d]"
                        }`}
                      />
                      {b}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {TORRIJOS.rating[b].hombre.cr.toString().replace(".", ",")}
                  </td>
                  <td className="py-2.5 pr-4">{TORRIJOS.rating[b].hombre.sr}</td>
                  <td className="py-2.5 pr-4">
                    {TORRIJOS.rating[b].mujer.cr.toString().replace(".", ",")}
                  </td>
                  <td className="py-2.5">{TORRIJOS.rating[b].mujer.sr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Calculadora de golpes por hoyo */}
      <HandicapCard defaultIndex={defaultIndex} defaultSexo={defaultSexo} />

      {/* Tarjeta / scorecard */}
      <section className="glass p-6">
        <h2 className="font-semibold">Tarjeta del campo</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Par, distancia (m) e índice de hándicap (idx) de cada hoyo por barra.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-center text-sm">
            <thead>
              <tr className="border-b border-black/8 text-xs text-muted">
                <th className="pb-2 pr-3 text-left font-medium">Hoyo</th>
                <th className="pb-2 pr-3 font-medium">Par</th>
                <th className="pb-2 pr-3 font-medium">Amar. (m)</th>
                <th className="pb-2 pr-3 font-medium">Amar. idx</th>
                <th className="pb-2 pr-3 font-medium">Rojas (m)</th>
                <th className="pb-2 font-medium">Rojas idx</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Ida (1-9)", rows: ida },
                { label: "Vuelta (10-18)", rows: vuelta },
              ].map((block) => (
                <ScoreBlock key={block.label} label={block.label} rows={block.rows} sum={sum} />
              ))}
              <tr className="border-t-2 border-black/10 font-semibold text-ink">
                <td className="py-2.5 pr-3 text-left">Total</td>
                <td className="py-2.5 pr-3">{sum(sc, (h) => h.par)}</td>
                <td className="py-2.5 pr-3">{sum(sc, (h) => h.amarillas.dist)}</td>
                <td className="py-2.5 pr-3">—</td>
                <td className="py-2.5 pr-3">{sum(sc, (h) => h.rojas.dist)}</td>
                <td className="py-2.5">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ScoreBlock({
  label,
  rows,
  sum,
}: {
  label: string;
  rows: typeof TORRIJOS.scorecard;
  sum: (arr: typeof TORRIJOS.scorecard, pick: (h: (typeof TORRIJOS.scorecard)[number]) => number) => number;
}) {
  return (
    <>
      {rows.map((h) => (
        <tr key={h.n} className="border-b border-black/5">
          <td className="py-2 pr-3 text-left font-medium text-ink">Hoyo {h.n}</td>
          <td className="py-2 pr-3">{h.par}</td>
          <td className="py-2 pr-3">{h.amarillas.dist}</td>
          <td className="py-2 pr-3 text-muted">{h.amarillas.si}</td>
          <td className="py-2 pr-3">{h.rojas.dist}</td>
          <td className="py-2 text-muted">{h.rojas.si}</td>
        </tr>
      ))}
      <tr className="border-b border-black/5 bg-black/5 text-xs font-medium text-muted">
        <td className="py-1.5 pr-3 text-left">{label}</td>
        <td className="py-1.5 pr-3">{sum(rows, (h) => h.par)}</td>
        <td className="py-1.5 pr-3">{sum(rows, (h) => h.amarillas.dist)}</td>
        <td className="py-1.5 pr-3">—</td>
        <td className="py-1.5 pr-3">{sum(rows, (h) => h.rojas.dist)}</td>
        <td className="py-1.5">—</td>
      </tr>
    </>
  );
}
