import { Clock, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { allTeachers, teacherWeeklySchedule } from "@/lib/booking";
import { weekdayName, formatEuro } from "@/lib/utils";
import { AvailabilityForm } from "./availability-form";
import { deleteAvailabilityAction } from "../actions";

export const metadata = { title: "Disponibilidad" };

export default async function AdminAvailabilityPage() {
  const teachers = await allTeachers();
  const schedules = await Promise.all(
    teachers.map(async (t) => ({ teacher: t, entries: await teacherWeeklySchedule(t.id) })),
  );

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="font-semibold">Marcar hora libre</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Las horas libres son las que los alumnos pueden reservar (una clase puntual
          o una clase semanal). Al confirmarse una reserva mensual, esa hora deja de
          estar libre.
        </p>
        <AvailabilityForm teachers={teachers} />
      </section>

      {teachers.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Primero registra un profesor"
          description="La disponibilidad se organiza por profesor."
        />
      ) : (
        schedules.map(({ teacher, entries }) => {
          const busy = entries.filter((e) => e.status === "ocupado").length;
          const free = entries.filter((e) => e.status === "libre").length;
          return (
            <section key={teacher.id} className="glass p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{teacher.name}</h3>
                <div className="flex gap-1.5">
                  <Badge tone="positive">{free} libres</Badge>
                  <Badge tone="neutral">{busy} ocupadas</Badge>
                </div>
              </div>

              {entries.length === 0 ? (
                <p className="mt-3 text-sm text-faint">
                  Sin horas. Marca arriba sus horas libres.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {entries.map((e, i) => (
                    <li
                      key={i}
                      className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 ${
                        e.status === "libre" ? "bg-positive/8" : "bg-black/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">
                          {weekdayName(e.weekday)} · {e.startTime} ({e.durationMin} min)
                        </p>
                        <p className="text-xs text-muted">
                          {e.status === "libre" ? "Libre para reservar" : e.label}
                          {e.price > 0 ? ` · ${formatEuro(e.price)}` : ""}
                        </p>
                      </div>
                      <Badge tone={e.status === "libre" ? "positive" : "neutral"}>
                        {e.status === "libre" ? "Libre" : "Ocupada"}
                      </Badge>
                      {e.status === "libre" && e.availabilityId ? (
                        <form action={deleteAvailabilityAction}>
                          <input type="hidden" name="availabilityId" value={e.availabilityId} />
                          <button
                            type="submit"
                            title="Quitar hora libre"
                            className="btn-danger !px-2.5 !py-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
