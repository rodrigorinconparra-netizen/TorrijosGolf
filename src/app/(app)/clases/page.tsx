import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Check, CheckCircle2, ChevronRight, Circle, Trash2, X } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { attendance, groups, trainingAssignments, trainings, users } from "@/lib/db/schema";
import {
  allSlots,
  slotParticipants,
  studentSlots,
  teacherSlots,
  upcomingOccurrences,
} from "@/lib/classes";
import { allTeachers, teacherWeeklySchedule } from "@/lib/booking";
import { chatContacts } from "@/lib/queries";
import { activeOffers, myOfferStatuses } from "@/lib/offers";
import { OffersList } from "@/components/offers-list";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate, weekdayName, initials } from "@/lib/utils";
import { TrainingForm } from "./training-form";
import { ClassRequestForm } from "./class-request-form";
import { ScheduleChangeForm } from "./schedule-change-form";
import {
  cancelSessionAction,
  completeSessionAction,
  deleteTrainingAction,
  setAttendancePlanAction,
  toggleTrainingAction,
} from "./actions";

export const metadata = { title: "Clases" };

/* ----------------------------------------------------------------------------
 * Vista alumno
 * ------------------------------------------------------------------------- */

async function StudentView({ userId }: { userId: number }) {
  const mySlots = await studentSlots(userId);
  const occurrences = await upcomingOccurrences(mySlots, 14, userId);

  // Panel de profesores: todos los profesores, con sus horas realmente libres
  // (excluyendo las que solapan una clase ya ocupada) y cuántas clases tiene ya
  // el alumno con cada uno.
  const teachers = await allTeachers();
  const freeByTeacher = new Map(
    await Promise.all(
      teachers.map(
        async (t) =>
          [
            t.id,
            (await teacherWeeklySchedule(t.id)).filter((e) => e.status === "libre")
              .length,
          ] as const,
      ),
    ),
  );
  const myClassesByTeacher = new Map<number, number>();
  for (const s of mySlots) {
    myClassesByTeacher.set(s.teacherId, (myClassesByTeacher.get(s.teacherId) ?? 0) + 1);
  }

  const myTrainings = await db
    .select({
      assignmentId: trainingAssignments.id,
      completed: trainingAssignments.completed,
      title: trainings.title,
      description: trainings.description,
      teacherName: users.name,
      createdAt: trainings.createdAt,
    })
    .from(trainingAssignments)
    .innerJoin(trainings, eq(trainings.id, trainingAssignments.trainingId))
    .innerJoin(users, eq(users.id, trainings.teacherId))
    .where(eq(trainingAssignments.studentId, userId))
    .orderBy(desc(trainings.createdAt));

  const offers = await activeOffers();
  const offerStatuses = Object.fromEntries(await myOfferStatuses(userId));

  return (
    <>
      <OffersList offers={offers} statuses={offerStatuses} />

      <section className="glass p-6">
        <h2 className="font-semibold">Profesores</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Pulsa un profesor para ver sus horas libres y reservar una clase.
        </p>
        {teachers.length === 0 ? (
          <p className="text-sm text-faint">Aún no hay profesores.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {teachers.map((t) => {
              const free = freeByTeacher.get(t.id) ?? 0;
              const mine = myClassesByTeacher.get(t.id) ?? 0;
              return (
                <Link
                  key={t.id}
                  href={`/clases/profesor/${t.id}`}
                  className="glass-soft flex items-center gap-3 px-4 py-3 transition hover:bg-white/70"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent">
                    {initials(t.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{t.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {mine > 0 ? (
                        <Badge tone="accent">
                          {mine} {mine === 1 ? "clase" : "clases"} contigo
                        </Badge>
                      ) : null}
                      {free > 0 ? (
                        <Badge tone="positive">{free} horas libres</Badge>
                      ) : (
                        <span className="text-xs text-faint">Sin horas libres</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-faint" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Próximas clases (2 semanas)</h2>
        <p className="mt-1 text-sm text-muted">
          Marca si vas a asistir para que tu profesor pueda organizarse.
        </p>
        {occurrences.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No tienes clases programadas. El club asigna las clases desde
            administración.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {occurrences.map((o) => (
              <li
                key={`${o.id}-${o.date}`}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {o.kind === "grupal" ? (o.groupName ?? "Grupo") : "Clase individual"}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(o.date)} · {o.startTime} ({o.durationMin} min) ·{" "}
                    {o.teacherName}
                  </p>
                </div>

                {o.status === "cancelada" ? (
                  <Badge tone="negative">Cancelada</Badge>
                ) : o.status === "impartida" ? (
                  <Badge tone="positive">Impartida</Badge>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <form action={setAttendancePlanAction}>
                      <input type="hidden" name="slotId" value={o.id} />
                      <input type="hidden" name="date" value={o.date} />
                      <input type="hidden" name="plan" value="asistire" />
                      <button
                        type="submit"
                        className={
                          o.myPlan === "asistire"
                            ? "btn-primary !px-3 !py-1.5 text-xs"
                            : "btn-ghost !px-3 !py-1.5 text-xs"
                        }
                      >
                        <Check className="h-3.5 w-3.5" /> Asistiré
                      </button>
                    </form>
                    <form action={setAttendancePlanAction}>
                      <input type="hidden" name="slotId" value={o.id} />
                      <input type="hidden" name="date" value={o.date} />
                      <input type="hidden" name="plan" value="no_asistire" />
                      <button
                        type="submit"
                        className={
                          o.myPlan === "no_asistire"
                            ? "btn-danger !px-3 !py-1.5 text-xs"
                            : "btn-ghost !px-3 !py-1.5 text-xs"
                        }
                      >
                        <X className="h-3.5 w-3.5" /> No iré
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Mis entrenamientos</h2>
        <p className="mt-1 text-sm text-muted">
          Los ejercicios que te envía tu profesor. Márcalos al completarlos.
        </p>
        {myTrainings.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Todavía no te han enviado ningún entrenamiento.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {myTrainings.map((t) => (
              <li key={t.assignmentId} className="glass-soft px-4 py-3">
                <div className="flex items-start gap-3">
                  <form action={toggleTrainingAction} className="mt-0.5">
                    <input type="hidden" name="assignmentId" value={t.assignmentId} />
                    <button
                      type="submit"
                      title={t.completed ? "Marcar como pendiente" : "Marcar como completado"}
                      className="text-accent transition active:scale-90"
                    >
                      {t.completed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5 text-faint" />
                      )}
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        t.completed
                          ? "text-sm font-medium text-faint line-through"
                          : "text-sm font-medium text-ink"
                      }
                    >
                      {t.title}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-xs text-muted">
                      {t.description}
                    </p>
                    <p className="mt-1 text-[11px] text-faint">De {t.teacherName}</p>
                  </div>
                  {t.completed ? <Badge tone="positive">Completado</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* ----------------------------------------------------------------------------
 * Vista profesor (y admin)
 * ------------------------------------------------------------------------- */

async function TeacherView({
  userId,
  isAdmin,
}: {
  userId: number;
  isAdmin: boolean;
}) {
  const mySlots = isAdmin ? await allSlots() : await teacherSlots(userId);
  const occurrences = await upcomingOccurrences(mySlots, 7);

  // Participantes por hora + su plan de asistencia por sesión existente.
  const uniqueSlotIds = [...new Set(occurrences.map((o) => o.id))];
  const participantsBySlot = new Map<
    number,
    { id: number; name: string; phone: string | null }[]
  >();
  for (const slotId of uniqueSlotIds) {
    participantsBySlot.set(slotId, await slotParticipants(slotId));
  }

  const sessionIds = occurrences
    .map((o) => o.sessionId)
    .filter((id): id is number => id != null);
  const plans = sessionIds.length
    ? await db
        .select({
          sessionId: attendance.sessionId,
          studentId: attendance.studentId,
          plan: attendance.plan,
          attended: attendance.attended,
        })
        .from(attendance)
        .where(inArray(attendance.sessionId, sessionIds))
    : [];
  const planFor = (sessionId: number | null, studentId: number) =>
    plans.find((p) => p.sessionId === sessionId && p.studentId === studentId);

  // Entrenamientos enviados, con ratio de completado.
  const sent = await db
    .select({
      id: trainings.id,
      title: trainings.title,
      description: trainings.description,
      createdAt: trainings.createdAt,
      total: sql<number>`count(${trainingAssignments.id})::int`,
      done: sql<number>`count(*) filter (where ${trainingAssignments.completed})::int`,
    })
    .from(trainings)
    .leftJoin(trainingAssignments, eq(trainingAssignments.trainingId, trainings.id))
    .where(isAdmin ? undefined : eq(trainings.teacherId, userId))
    .groupBy(trainings.id, trainings.title, trainings.description, trainings.createdAt)
    .orderBy(desc(trainings.createdAt))
    .limit(20);

  const contacts = await chatContacts(userId, isAdmin ? "admin" : "profesor");
  const myStudents = contacts.filter((c) => c.role === "alumno");
  const myGroups = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(isAdmin ? undefined : eq(groups.teacherId, userId))
    .orderBy(asc(groups.name));

  // Para proponer una clase nueva, el profesor puede elegir cualquier alumno.
  const allStudents = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "alumno"))
    .orderBy(asc(users.name));

  return (
    <>
      <section className="glass p-6">
        <h2 className="font-semibold">Tus clases (7 días)</h2>
        <p className="mt-1 text-sm text-muted">
          Pasa lista y marca la clase como impartida: así se calculan tus horas,
          los ingresos y el histórico de asistencias.
        </p>
        {occurrences.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No tienes horas en el horario. El club las configura en administración.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {occurrences.map((o) => {
              const participants = participantsBySlot.get(o.id) ?? [];
              return (
                <li key={`${o.id}-${o.date}`} className="glass-soft px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {o.kind === "grupal"
                          ? (o.groupName ?? "Hora grupal libre")
                          : (o.studentName ?? "Hora individual libre")}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(o.date)} · {o.startTime} ({o.durationMin} min)
                        {o.teacherName ? ` · ${o.teacherName}` : ""}
                      </p>
                    </div>
                    <Badge tone={o.kind === "grupal" ? "accent" : "neutral"}>
                      {o.kind === "grupal" ? "Grupal" : "Individual"}
                    </Badge>
                    {o.status === "impartida" ? (
                      <Badge tone="positive">Impartida</Badge>
                    ) : o.status === "cancelada" ? (
                      <Badge tone="negative">Cancelada</Badge>
                    ) : null}
                  </div>

                  {o.status === "programada" && participants.length > 0 ? (
                    <form action={completeSessionAction} className="mt-3">
                      <input type="hidden" name="slotId" value={o.id} />
                      <input type="hidden" name="date" value={o.date} />
                      <div className="space-y-1.5">
                        {participants.map((p) => {
                          const pl = planFor(o.sessionId, p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-2.5 rounded-xl bg-white/50 px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                name={`attended-${p.id}`}
                                defaultChecked={pl?.plan !== "no_asistire"}
                                className="h-4 w-4 accent-[var(--color-accent)]"
                              />
                              <span className="flex-1 text-ink">{p.name}</span>
                              {pl?.plan === "asistire" ? (
                                <Badge tone="positive">Confirmó</Badge>
                              ) : pl?.plan === "no_asistire" ? (
                                <Badge tone="negative">No viene</Badge>
                              ) : (
                                <Badge>Sin confirmar</Badge>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="submit" className="btn-primary !px-3.5 !py-2 text-sm">
                          <Check className="h-4 w-4" /> Impartida (guardar lista)
                        </button>
                        <button
                          formAction={cancelSessionAction}
                          className="btn-danger !px-3.5 !py-2 text-sm"
                        >
                          <X className="h-4 w-4" /> Cancelar clase
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {o.status === "impartida" && participants.length > 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      Asistieron:{" "}
                      {participants
                        .filter((p) => planFor(o.sessionId, p.id)?.attended)
                        .map((p) => p.name)
                        .join(", ") || "nadie"}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Enviar entrenamiento</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Envía ejercicios a un alumno, a un grupo o a todos tus alumnos. Les
          llegará una notificación y podrán marcarlo como completado.
        </p>
        <TrainingForm
          groups={myGroups}
          students={myStudents.map((s) => ({ id: s.id, name: s.name }))}
        />
      </section>

      {!isAdmin ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Proponer nueva clase al club</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Crea la propuesta de un grupo o una clase individual con sus alumnos. El
            club recibirá la solicitud y la aceptará o rechazará; al aceptarla se crea
            la clase y su horario.
          </p>
          <ClassRequestForm students={allStudents} />
        </section>
      ) : null}

      {!isAdmin && mySlots.length > 0 ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Tu horario semanal</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            ¿Necesitas mover una clase? Propón un nuevo horario y el club lo confirmará.
          </p>
          <ul className="space-y-2">
            {mySlots.map((s) => (
              <li key={s.id} className="glass-soft px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {weekdayName(s.weekday)} · {s.startTime} ({s.durationMin} min)
                    </p>
                    <p className="text-xs text-muted">
                      {s.kind === "grupal"
                        ? (s.groupName ?? "Grupo")
                        : (s.studentName ?? "Individual")}
                    </p>
                  </div>
                  <Badge tone={s.kind === "grupal" ? "accent" : "neutral"}>
                    {s.kind === "grupal" ? "Grupal" : "Individual"}
                  </Badge>
                </div>
                <div className="mt-2">
                  <ScheduleChangeForm
                    slot={{
                      id: s.id,
                      weekday: s.weekday,
                      startTime: s.startTime,
                      durationMin: s.durationMin,
                      label: `${weekdayName(s.weekday)} ${s.startTime}`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sent.length > 0 ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Entrenamientos enviados</h2>
          <ul className="mt-4 space-y-2">
            {sent.map((t) => (
              <li
                key={t.id}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{t.title}</p>
                  <p className="line-clamp-1 text-xs text-muted">{t.description}</p>
                </div>
                <Badge tone={t.done === t.total && t.total > 0 ? "positive" : "neutral"}>
                  {t.done}/{t.total} completados
                </Badge>
                <form action={deleteTrainingAction}>
                  <input type="hidden" name="trainingId" value={t.id} />
                  <button
                    type="submit"
                    title="Eliminar entrenamiento"
                    className="btn-danger !px-2.5 !py-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export default async function ClassesPage() {
  const user = await requireSession();

  return (
    <>
      <PageHeader
        title="Clases"
        subtitle={
          user.role === "alumno"
            ? "Tu horario, asistencias y entrenamientos"
            : "Horario, pase de lista y entrenamientos de tus alumnos"
        }
      />
      {user.role === "alumno" ? (
        <StudentView userId={user.userId} />
      ) : (
        <TeacherView userId={user.userId} isAdmin={user.role === "admin"} />
      )}
    </>
  );
}
