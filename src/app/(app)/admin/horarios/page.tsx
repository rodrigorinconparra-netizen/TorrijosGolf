import { asc } from "drizzle-orm";
import { CalendarX, Clock, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { groups, users } from "@/lib/db/schema";
import { allSlots } from "@/lib/classes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { weekdayName, formatEuro, WEEKDAYS } from "@/lib/utils";
import { SlotForm } from "./slot-form";
import { assignSlotAction, deactivateSlotAction, updateSlotAction } from "../actions";

export const metadata = { title: "Horarios" };

export default async function AdminSchedulePage() {
  const allUsers = await db.select().from(users).orderBy(asc(users.name));
  const teachers = allUsers.filter((u) => u.role === "profesor");
  const students = allUsers.filter((u) => u.role === "alumno");
  const allGroups = await db.select().from(groups).orderBy(asc(groups.name));
  const slotList = await allSlots();

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="font-semibold">Añadir hora al horario</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Marca las horas disponibles de cada profesor. Una hora puede ser
          individual (un alumno) o grupal (un grupo), y puede quedarse libre para
          asignarla más adelante.
        </p>
        <SlotForm
          teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
          students={students.map((s) => ({ id: s.id, name: s.name }))}
          groups={allGroups.map((g) => ({ id: g.id, name: g.name, teacherId: g.teacherId }))}
        />
      </section>

      {teachers.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Primero registra un profesor"
          description="Los horarios se organizan por profesor. Crea uno en la pestaña Usuarios."
        />
      ) : (
        teachers.map((t) => {
          const teacherSlotList = slotList.filter((s) => s.teacherId === t.id);
          return (
            <section key={t.id} className="glass p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t.name}</h3>
                <Badge tone="accent">
                  {teacherSlotList.length}{" "}
                  {teacherSlotList.length === 1 ? "hora" : "horas"} / semana
                </Badge>
              </div>

              {teacherSlotList.length === 0 ? (
                <p className="mt-3 text-sm text-faint">Sin horas asignadas.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {teacherSlotList.map((s) => (
                    <li key={s.id} className="glass-soft px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">
                            {weekdayName(s.weekday)} · {s.startTime} ({s.durationMin} min)
                          </p>
                          <p className="text-xs text-muted">
                            {s.kind === "grupal"
                              ? (s.groupName ?? "Hora grupal libre")
                              : (s.studentName ?? "Hora individual libre")}
                            {s.price > 0 ? ` · ${formatEuro(s.price)}` : ""}
                          </p>
                        </div>
                        <Badge tone={s.kind === "grupal" ? "accent" : "neutral"}>
                          {s.kind === "grupal" ? "Grupal" : "Individual"}
                        </Badge>

                        <form action={assignSlotAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="slotId" value={s.id} />
                          {s.kind === "grupal" ? (
                            <select
                              name="groupId"
                              defaultValue={s.groupId ?? ""}
                              className="field !w-44 !px-2.5 !py-1.5 text-xs"
                            >
                              <option value="">Libre</option>
                              {allGroups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              name="studentId"
                              defaultValue={s.studentId ?? ""}
                              className="field !w-44 !px-2.5 !py-1.5 text-xs"
                            >
                              <option value="">Libre</option>
                              {students.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <button type="submit" className="btn-ghost !px-3 !py-1.5 text-xs">
                            Asignar
                          </button>
                        </form>

                        <form action={deactivateSlotAction}>
                          <input type="hidden" name="slotId" value={s.id} />
                          <button
                            type="submit"
                            title="Quitar hora del horario"
                            className="btn-danger !px-2.5 !py-1.5"
                          >
                            <CalendarX className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>

                      <details className="mt-2 group">
                        <summary className="flex w-fit cursor-pointer items-center gap-1 text-xs font-medium text-accent">
                          <Pencil className="h-3 w-3" /> Editar horario
                        </summary>
                        <form
                          action={updateSlotAction}
                          className="mt-2 flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="slotId" value={s.id} />
                          <label className="text-xs text-muted">
                            Día
                            <select
                              name="weekday"
                              defaultValue={s.weekday}
                              className="field mt-0.5 !w-32 !px-2.5 !py-1.5 text-xs"
                            >
                              {WEEKDAYS.map((dName, i) => (
                                <option key={dName} value={i + 1}>
                                  {dName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs text-muted">
                            Hora
                            <input
                              name="startTime"
                              type="time"
                              defaultValue={s.startTime}
                              className="field mt-0.5 !w-28 !px-2.5 !py-1.5 text-xs"
                            />
                          </label>
                          <label className="text-xs text-muted">
                            Duración
                            <select
                              name="durationMin"
                              defaultValue={s.durationMin}
                              className="field mt-0.5 !w-28 !px-2.5 !py-1.5 text-xs"
                            >
                              <option value="30">30 min</option>
                              <option value="45">45 min</option>
                              <option value="60">1 hora</option>
                              <option value="90">1 h 30</option>
                              <option value="120">2 horas</option>
                            </select>
                          </label>
                          <label className="text-xs text-muted">
                            Precio €
                            <input
                              name="price"
                              type="number"
                              step="0.5"
                              min="0"
                              defaultValue={s.price}
                              className="field mt-0.5 !w-24 !px-2.5 !py-1.5 text-xs"
                            />
                          </label>
                          <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                            Guardar
                          </button>
                        </form>
                      </details>
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
