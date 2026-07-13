import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, AlertTriangle, Check } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getDayTeeSheet } from "@/lib/teeone";
import { Badge } from "@/components/ui/badge";
import { formatDate, toDateKey } from "@/lib/utils";

export const metadata = { title: "Pista" };

function shiftDate(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export default async function AdminTeeSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  await requireAdmin();
  const { fecha } = await searchParams;
  const date =
    fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : toDateKey(new Date());

  const sheet = await getDayTeeSheet(date);
  const libres = sheet.slots.filter((s) => s.status !== "ocupado");
  const ocupadas = sheet.slots.filter((s) => s.status === "ocupado");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold">Reservas de pista (teeone.golf)</h2>
        <p className="mt-1 text-sm text-muted">
          Horas ocupadas y libres del día, desde tu sistema de reservas teeone.
        </p>
      </div>

      {!sheet.configured ? (
        <section className="glass p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning/15 text-[#9a6500]">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold">Integración no configurada</h3>
              <p className="mt-1 text-sm text-muted">
                Para ver aquí la disponibilidad de la pista, define tu usuario y
                clave de teeone (los mismos de reservas.teeone.golf) como variables
                de entorno del servidor:
              </p>
              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                <li>
                  <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">
                    TEEONE_USER
                  </code>{" "}
                  · tu usuario de teeone
                </li>
                <li>
                  <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">
                    TEEONE_PASS
                  </code>{" "}
                  · tu contraseña de teeone
                </li>
                <li className="text-muted">
                  Ya configuradas por defecto:{" "}
                  <code className="text-xs">TEEONE_BASE_URL</code>,{" "}
                  <code className="text-xs">TEEONE_SALIDAS_PATH</code>.
                </li>
              </ul>
              <p className="mt-3 text-xs text-faint">
                Ojo: la API de teeone puede estar restringida por IP — quizá haya que
                pedirles que autoricen la IP del servidor. Cuando responda, ajustamos
                el mapeo de campos en <code>src/lib/teeone.ts</code>.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Selector de día */}
          <div className="flex items-center justify-between">
            <Link
              href={`/admin/pista?fecha=${shiftDate(date, -1)}`}
              className="btn-ghost !px-3"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h3 className="font-semibold capitalize">{formatDate(date)}</h3>
            <Link
              href={`/admin/pista?fecha=${shiftDate(date, 1)}`}
              className="btn-ghost !px-3"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {sheet.error ? (
            <section className="glass p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-negative/10 text-negative">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">No se pudo leer la disponibilidad</h3>
                  <p className="mt-1 text-sm text-muted">{sheet.error}</p>
                </div>
              </div>
            </section>
          ) : sheet.slots.length === 0 ? (
            <section className="glass p-6">
              <p className="text-sm text-muted">
                Sin salidas para este día (o la respuesta no trae salidas).
              </p>
            </section>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass p-5">
                  <span className="text-[13px] font-medium text-muted">Libres</span>
                  <p className="mt-2 text-3xl font-semibold text-positive">
                    {libres.length}
                  </p>
                </div>
                <div className="glass p-5">
                  <span className="text-[13px] font-medium text-muted">Ocupadas</span>
                  <p className="mt-2 text-3xl font-semibold text-ink">
                    {ocupadas.length}
                  </p>
                </div>
              </div>

              <section className="glass p-6">
                <h3 className="font-semibold">Salidas</h3>
                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {sheet.slots.map((s) => (
                    <li
                      key={s.time}
                      className={
                        s.status === "ocupado"
                          ? "glass-soft flex items-center justify-between px-3 py-2 opacity-70"
                          : "glass-soft flex items-center justify-between px-3 py-2"
                      }
                    >
                      <span className="text-sm font-medium text-ink">{s.time}</span>
                      {s.status === "ocupado" ? (
                        <Badge tone="neutral">Ocupada</Badge>
                      ) : s.status === "parcial" ? (
                        <Badge tone="warning">
                          {s.available != null ? `${s.available} libres` : "Parcial"}
                        </Badge>
                      ) : (
                        <Badge tone="positive">
                          <Check className="h-3 w-3" /> Libre
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
