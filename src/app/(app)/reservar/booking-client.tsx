"use client";

import { useActionState, useState } from "react";
import { CalendarCheck, Check, Lock } from "lucide-react";
import { requestBookingAction, type BookingState } from "./actions";
import { weekdayName } from "@/lib/utils";

interface Entry {
  weekday: number;
  startTime: string;
  durationMin: number;
  status: "ocupado" | "libre";
  label: string;
  price: number;
  availabilityId?: number;
  takenDates?: string[];
  monthlyTaken?: boolean;
}

interface TeacherSchedule {
  id: number;
  name: string;
  entries: Entry[];
}

interface Child {
  id: number;
  name: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Próximas fechas (yyyy-mm-dd) que caen en `weekday` (ISO 1-7). */
function nextDates(weekday: number, count = 5): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < 70 && out.length < count; i++) {
    const x = new Date(today);
    x.setDate(today.getDate() + i);
    const iso = x.getDay() === 0 ? 7 : x.getDay();
    if (iso === weekday) out.push(toKey(x));
  }
  return out;
}
function labelDate(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Formulario de reserva de una hora libre concreta. */
function BookSlot({ entry, children }: { entry: Entry; children: Child[] }) {
  const [state, action, pending] = useActionState<BookingState, FormData>(
    requestBookingAction,
    {},
  );
  const taken = new Set(entry.takenDates ?? []);
  // Solo días futuros de esa hora que NO estén ya reservados.
  const dates = nextDates(entry.weekday, 8).filter((d) => !taken.has(d));
  const monthlyTaken = entry.monthlyTaken ?? false;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"puntual" | "mensual">(
    monthlyTaken ? "puntual" : "mensual",
  );

  if (state.ok) {
    return (
      <p className="mt-1 rounded-xl bg-positive/10 px-3 py-1.5 text-xs text-positive">
        {state.ok}
      </p>
    );
  }

  const nothingFree = monthlyTaken && dates.length === 0;

  return (
    <div>
      {nothingFree ? (
        <span className="flex items-center gap-1 text-xs text-faint">
          <Lock className="h-3.5 w-3.5" /> Sin huecos
        </span>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary !px-3 !py-1.5 text-xs"
        >
          <CalendarCheck className="h-3.5 w-3.5" /> Reservar
        </button>
      ) : (
        <form action={action} className="mt-1 space-y-2 rounded-2xl bg-white/60 p-3">
          <input type="hidden" name="availabilityId" value={entry.availabilityId} />

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setKind("mensual")}
              disabled={monthlyTaken}
              title={monthlyTaken ? "Esa clase semanal ya está reservada" : undefined}
              className={
                kind === "mensual"
                  ? "btn-primary !px-3 !py-1.5 text-xs"
                  : "btn-ghost !px-3 !py-1.5 text-xs"
              }
            >
              Mensual (semanal)
            </button>
            <button
              type="button"
              onClick={() => setKind("puntual")}
              className={
                kind === "puntual"
                  ? "btn-primary !px-3 !py-1.5 text-xs"
                  : "btn-ghost !px-3 !py-1.5 text-xs"
              }
            >
              Un solo día
            </button>
          </div>
          <input type="hidden" name="kind" value={kind} />

          {kind === "puntual" ? (
            dates.length === 0 ? (
              <p className="text-xs text-muted">
                No quedan días libres en esta hora próximamente.
              </p>
            ) : (
              <select name="date" required className="field !py-2 text-xs">
                <option value="">Elige el día…</option>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {labelDate(d)}
                  </option>
                ))}
              </select>
            )
          ) : (
            <p className="text-xs text-muted">
              Clase semanal fija los {weekdayName(entry.weekday).toLowerCase()} a las{" "}
              {entry.startTime}.
            </p>
          )}

          {children.length > 0 ? (
            <select name="studentId" className="field !py-2 text-xs" defaultValue="">
              <option value="">Para mí</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  Para {c.name}
                </option>
              ))}
            </select>
          ) : null}

          <input
            name="note"
            placeholder="Nota para el club (opcional)"
            className="field !py-2 text-xs"
          />

          {state.error ? (
            <p className="rounded-xl bg-negative/10 px-3 py-1.5 text-xs text-negative">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || (kind === "puntual" && dates.length === 0)}
              className="btn-primary !px-3 !py-1.5 text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              {pending ? "Enviando…" : "Confirmar reserva"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost !px-3 !py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function BookingClient({
  teachers,
  children,
}: {
  teachers: TeacherSchedule[];
  children: Child[];
}) {
  const [selected, setSelected] = useState<number>(teachers[0]?.id ?? 0);
  const teacher = teachers.find((t) => t.id === selected) ?? teachers[0];

  if (!teacher) return null;

  // Agrupar por día de la semana.
  const byDay = new Map<number, Entry[]>();
  for (const e of teacher.entries) {
    byDay.set(e.weekday, [...(byDay.get(e.weekday) ?? []), e]);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="glass-soft flex gap-1 overflow-x-auto p-1.5">
        {teachers.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              t.id === selected
                ? "bg-accent text-on-accent"
                : "text-ink-soft hover:bg-black/5"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-muted">
          Este profesor no tiene horas libres ahora mismo.
        </p>
      ) : (
        days.map((wd) => (
          <section key={wd} className="glass p-5">
            <h3 className="font-semibold">{weekdayName(wd)}</h3>
            <ul className="mt-3 space-y-2">
              {byDay.get(wd)!.map((e, i) => (
                <li
                  key={i}
                  className={`rounded-2xl px-4 py-3 ${
                    e.status === "libre" ? "bg-positive/8" : "bg-black/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {e.startTime} ({e.durationMin} min)
                      </p>
                      <p className="text-xs text-muted">
                        {e.status === "libre"
                          ? e.price > 0
                            ? `Libre · ${e.price} €`
                            : "Libre"
                          : "Ocupada"}
                      </p>
                    </div>
                    {e.status === "libre" ? (
                      <BookSlot entry={e} children={children} />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-faint">
                        <Lock className="h-3.5 w-3.5" /> No disponible
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
