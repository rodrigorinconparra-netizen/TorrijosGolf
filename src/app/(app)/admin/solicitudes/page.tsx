import { desc, eq, inArray } from "drizzle-orm";
import { Check, X, Inbox, Clock, CalendarCheck } from "lucide-react";
import { db } from "@/lib/db";
import {
  bookingRequests,
  classRequestStudents,
  classRequests,
  scheduleChangeRequests,
  slots,
  users,
} from "@/lib/db/schema";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { weekdayName, formatEuro, formatDate } from "@/lib/utils";
import { alias } from "drizzle-orm/pg-core";
import {
  acceptClassRequestAction,
  rejectClassRequestAction,
  acceptScheduleChangeAction,
  rejectScheduleChangeAction,
  acceptBookingAction,
  rejectBookingAction,
} from "../actions";

export const metadata = { title: "Solicitudes" };

const STATUS_TONE = {
  pendiente: "warning",
  aceptada: "positive",
  rechazada: "negative",
} as const;

export default async function AdminRequestsPage() {
  const student = alias(users, "student");
  const rows = await db
    .select({
      id: classRequests.id,
      kind: classRequests.kind,
      groupName: classRequests.groupName,
      studentName: student.name,
      teacherName: users.name,
      weekday: classRequests.weekday,
      startTime: classRequests.startTime,
      durationMin: classRequests.durationMin,
      price: classRequests.price,
      note: classRequests.note,
      status: classRequests.status,
      createdAt: classRequests.createdAt,
    })
    .from(classRequests)
    .innerJoin(users, eq(users.id, classRequests.teacherId))
    .leftJoin(student, eq(student.id, classRequests.studentId))
    .orderBy(desc(classRequests.createdAt));

  // Nombres de los alumnos propuestos en las solicitudes grupales.
  const groupReqIds = rows.filter((r) => r.kind === "grupal").map((r) => r.id);
  const memberRows = groupReqIds.length
    ? await db
        .select({
          requestId: classRequestStudents.requestId,
          name: users.name,
        })
        .from(classRequestStudents)
        .innerJoin(users, eq(users.id, classRequestStudents.studentId))
        .where(inArray(classRequestStudents.requestId, groupReqIds))
    : [];
  const studentsByReq = new Map<number, string[]>();
  for (const m of memberRows) {
    studentsByReq.set(m.requestId, [...(studentsByReq.get(m.requestId) ?? []), m.name]);
  }

  const pending = rows.filter((r) => r.status === "pendiente");
  const decided = rows.filter((r) => r.status !== "pendiente").slice(0, 15);

  // Cambios de horario propuestos: proponen nuevos valores para una hora existente.
  const scheduleRows = await db
    .select({
      id: scheduleChangeRequests.id,
      teacherName: users.name,
      kind: slots.kind,
      groupId: slots.groupId,
      studentId: slots.studentId,
      curWeekday: slots.weekday,
      curStart: slots.startTime,
      curDuration: slots.durationMin,
      newWeekday: scheduleChangeRequests.weekday,
      newStart: scheduleChangeRequests.startTime,
      newDuration: scheduleChangeRequests.durationMin,
      note: scheduleChangeRequests.note,
      status: scheduleChangeRequests.status,
    })
    .from(scheduleChangeRequests)
    .innerJoin(users, eq(users.id, scheduleChangeRequests.teacherId))
    .innerJoin(slots, eq(slots.id, scheduleChangeRequests.slotId))
    .where(eq(scheduleChangeRequests.status, "pendiente"))
    .orderBy(desc(scheduleChangeRequests.createdAt));

  // Reservas de alumnos pendientes de confirmar.
  const teacherU = alias(users, "teacher_u");
  const bookingRows = await db
    .select({
      id: bookingRequests.id,
      studentName: users.name,
      teacherName: teacherU.name,
      weekday: bookingRequests.weekday,
      startTime: bookingRequests.startTime,
      durationMin: bookingRequests.durationMin,
      price: bookingRequests.price,
      kind: bookingRequests.kind,
      date: bookingRequests.date,
      note: bookingRequests.note,
    })
    .from(bookingRequests)
    .innerJoin(users, eq(users.id, bookingRequests.studentId))
    .innerJoin(teacherU, eq(teacherU.id, bookingRequests.teacherId))
    .where(eq(bookingRequests.status, "pendiente"))
    .orderBy(desc(bookingRequests.createdAt));

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="font-semibold">Solicitudes pendientes ({pending.length})</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Clases que proponen los profesores. Al aceptar, se crea el grupo (o la hora
          individual) y su chat; puedes ajustar el precio antes de confirmar.
        </p>

        {pending.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No hay solicitudes pendientes"
            description="Cuando un profesor proponga una clase nueva, aparecerá aquí para que la confirmes."
          />
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => {
              const who =
                r.kind === "grupal"
                  ? (studentsByReq.get(r.id) ?? [])
                  : r.studentName
                    ? [r.studentName]
                    : [];
              return (
                <li key={r.id} className="glass-soft p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {r.kind === "grupal"
                          ? (r.groupName ?? "Grupo")
                          : "Clase individual"}
                      </p>
                      <p className="text-xs text-muted">
                        {r.teacherName} · {weekdayName(r.weekday)} {r.startTime} (
                        {r.durationMin} min)
                      </p>
                    </div>
                    <Badge tone={r.kind === "grupal" ? "accent" : "neutral"}>
                      {r.kind === "grupal" ? "Grupal" : "Individual"}
                    </Badge>
                  </div>

                  <p className="mt-2 text-xs text-ink-soft">
                    <span className="text-muted">
                      {r.kind === "grupal" ? "Alumnos: " : "Alumno: "}
                    </span>
                    {who.length ? who.join(", ") : "—"}
                  </p>
                  {r.note ? (
                    <p className="mt-1 text-xs text-muted">Nota: {r.note}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form
                      action={acceptClassRequestAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="requestId" value={r.id} />
                      <div className="flex items-center gap-1">
                        <input
                          name="price"
                          type="number"
                          step="0.5"
                          min="0"
                          defaultValue={r.price || 0}
                          className="field !w-24 !px-2.5 !py-1.5 text-xs"
                          aria-label="Precio de la clase"
                        />
                        <span className="text-xs text-muted">€</span>
                      </div>
                      <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                        <Check className="h-3.5 w-3.5" /> Aceptar
                      </button>
                    </form>
                    <form
                      action={rejectClassRequestAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="requestId" value={r.id} />
                      <input
                        name="reason"
                        placeholder="Motivo (opcional)"
                        className="field !w-40 !px-2.5 !py-1.5 text-xs"
                      />
                      <button type="submit" className="btn-danger !px-3 !py-1.5 text-xs">
                        <X className="h-3.5 w-3.5" /> Rechazar
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Reservas de alumnos ({bookingRows.length})</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Horas libres que han reservado los alumnos. Al aceptar se crea la clase
          (mensual = hora semanal fija; puntual = un solo día).
        </p>
        {bookingRows.length === 0 ? (
          <p className="text-sm text-muted">No hay reservas pendientes.</p>
        ) : (
          <ul className="space-y-3">
            {bookingRows.map((r) => (
              <li key={r.id} className="glass-soft p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                    <CalendarCheck className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-ink">{r.studentName}</p>
                  <Badge tone={r.kind === "mensual" ? "accent" : "neutral"}>
                    {r.kind === "mensual" ? "Mensual" : "Puntual"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  Con {r.teacherName} ·{" "}
                  {r.kind === "puntual" && r.date
                    ? `${formatDate(r.date)} ${r.startTime}`
                    : `${weekdayName(r.weekday)} ${r.startTime}`}{" "}
                  ({r.durationMin} min)
                </p>
                {r.note ? (
                  <p className="mt-1 text-xs text-muted">Nota: {r.note}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={acceptBookingAction} className="flex items-center gap-2">
                    <input type="hidden" name="bookingId" value={r.id} />
                    <div className="flex items-center gap-1">
                      <input
                        name="price"
                        type="number"
                        step="0.5"
                        min="0"
                        defaultValue={r.price || 0}
                        className="field !w-24 !px-2.5 !py-1.5 text-xs"
                        aria-label="Precio"
                      />
                      <span className="text-xs text-muted">€</span>
                    </div>
                    <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                      <Check className="h-3.5 w-3.5" /> Aceptar
                    </button>
                  </form>
                  <form action={rejectBookingAction} className="flex items-center gap-2">
                    <input type="hidden" name="bookingId" value={r.id} />
                    <input
                      name="reason"
                      placeholder="Motivo (opcional)"
                      className="field !w-40 !px-2.5 !py-1.5 text-xs"
                    />
                    <button type="submit" className="btn-danger !px-3 !py-1.5 text-xs">
                      <X className="h-3.5 w-3.5" /> Rechazar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Cambios de horario ({scheduleRows.length})</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Profesores que piden mover una de sus clases. Al aceptar, se actualiza la
          hora en el horario.
        </p>
        {scheduleRows.length === 0 ? (
          <p className="text-sm text-muted">No hay cambios de horario pendientes.</p>
        ) : (
          <ul className="space-y-3">
            {scheduleRows.map((r) => (
              <li key={r.id} className="glass-soft p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                    <Clock className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-ink">{r.teacherName}</p>
                  <Badge tone={r.kind === "grupal" ? "accent" : "neutral"}>
                    {r.kind === "grupal" ? "Grupal" : "Individual"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  <span className="text-muted line-through">
                    {weekdayName(r.curWeekday)} {r.curStart} ({r.curDuration} min)
                  </span>{" "}
                  →{" "}
                  <span className="font-medium text-accent-deep">
                    {weekdayName(r.newWeekday)} {r.newStart} ({r.newDuration} min)
                  </span>
                </p>
                {r.note ? (
                  <p className="mt-1 text-xs text-muted">Nota: {r.note}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={acceptScheduleChangeAction}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                      <Check className="h-3.5 w-3.5" /> Aceptar
                    </button>
                  </form>
                  <form
                    action={rejectScheduleChangeAction}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="requestId" value={r.id} />
                    <input
                      name="reason"
                      placeholder="Motivo (opcional)"
                      className="field !w-40 !px-2.5 !py-1.5 text-xs"
                    />
                    <button type="submit" className="btn-danger !px-3 !py-1.5 text-xs">
                      <X className="h-3.5 w-3.5" /> Rechazar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Historial</h2>
          <ul className="mt-3 space-y-2">
            {decided.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate text-ink-soft">
                  {r.kind === "grupal" ? (r.groupName ?? "Grupo") : "Individual"} ·{" "}
                  {r.teacherName}
                </span>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
