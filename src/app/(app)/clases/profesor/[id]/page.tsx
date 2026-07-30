import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ChevronLeft, Phone, CalendarPlus, GraduationCap } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { studentSlots, upcomingOccurrences } from "@/lib/classes";
import { teacherPrices, teacherWeeklySchedule } from "@/lib/booking";
import { childrenOf } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { formatDate, initials } from "@/lib/utils";
import { BookingClient } from "@/app/(app)/reservar/booking-client";

export const metadata = { title: "Profesor" };

export default async function TeacherForStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const teacherId = Number((await params).id);
  if (!teacherId) notFound();

  const [teacher] = await db
    .select()
    .from(users)
    .where(eq(users.id, teacherId))
    .limit(1);
  if (!teacher || teacher.role !== "profesor") notFound();

  const entries = await teacherWeeklySchedule(teacherId);
  const freeCount = entries.filter((e) => e.status === "libre").length;
  const prices = await teacherPrices(teacherId);
  const classmates = (
    await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "alumno"))
      .orderBy(asc(users.name))
  ).filter((s) => s.id !== user.userId);

  // Mis clases con este profesor (próximas 4 semanas).
  const mySlots = (await studentSlots(user.userId)).filter(
    (s) => s.teacherId === teacherId,
  );
  const myOccurrences = await upcomingOccurrences(mySlots, 28, user.userId);

  const kids = await childrenOf(user.userId);

  return (
    <div className="space-y-6">
      <Link
        href="/clases"
        className="inline-flex items-center gap-1 text-sm font-medium text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Volver a clases
      </Link>

      {/* Info del profesor */}
      <section className="glass p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-semibold text-on-accent">
            {initials(teacher.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{teacher.name}</h1>
              <Badge tone="accent">Profesor</Badge>
            </div>
            {teacher.title ? (
              <p className="text-sm text-muted">{teacher.title}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {freeCount > 0 ? (
                <Badge tone="positive">{freeCount} horas libres</Badge>
              ) : (
                <span className="text-xs text-faint">Sin horas libres ahora</span>
              )}
              {mySlots.length > 0 ? (
                <Badge tone="accent">
                  {mySlots.length} {mySlots.length === 1 ? "clase" : "clases"} contigo
                </Badge>
              ) : null}
            </div>
          </div>
          {teacher.phone ? (
            <a
              href={`tel:${teacher.phone}`}
              title={`Llamar a ${teacher.name}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition hover:bg-accent-deep"
            >
              <Phone className="h-4 w-4" />
            </a>
          ) : null}
        </div>
        {teacher.license ? (
          <p className="mt-3 text-sm text-muted">Licencia {teacher.license}</p>
        ) : null}
      </section>

      {teacher.bio || teacher.specialties || teacher.experienceYears != null ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Sobre {teacher.name.split(" ")[0]}</h2>
          {teacher.experienceYears != null ? (
            <p className="mt-2 text-sm text-ink-soft">
              <span className="text-muted">Experiencia: </span>
              {teacher.experienceYears}{" "}
              {teacher.experienceYears === 1 ? "año" : "años"}
            </p>
          ) : null}
          {teacher.specialties ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted">Especialidades</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {teacher.specialties
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => (
                    <Badge key={s} tone="accent">
                      {s}
                    </Badge>
                  ))}
              </div>
            </div>
          ) : null}
          {teacher.bio ? (
            <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{teacher.bio}</p>
          ) : null}
        </section>
      ) : null}

      {/* Mis clases con este profesor */}
      {myOccurrences.length > 0 ? (
        <section className="glass p-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted" />
            <h2 className="font-semibold">Mis clases con {teacher.name.split(" ")[0]}</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {myOccurrences.map((o) => (
              <li
                key={`${o.id}-${o.date}`}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {o.kind === "grupal" ? (o.groupName ?? "Grupo") : "Clase individual"}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(o.date)} · {o.startTime} ({o.durationMin} min)
                  </p>
                </div>
                {o.status === "cancelada" ? (
                  <Badge tone="negative">Cancelada</Badge>
                ) : o.status === "impartida" ? (
                  <Badge tone="positive">Impartida</Badge>
                ) : (
                  <Badge tone={o.kind === "grupal" ? "accent" : "neutral"}>
                    {o.kind === "grupal" ? "Grupal" : "Individual"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Reservar una hora libre */}
      <section className="glass p-6">
        <div className="flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-muted" />
          <h2 className="font-semibold">Reservar una clase</h2>
        </div>
        <p className="mb-4 mt-1 text-sm text-muted">
          Elige una hora libre. Puntual (un día) o mensual (clase semanal).
          {kids.length > 0 ? " Puedes reservarla para ti o para un hijo." : ""}
        </p>
        {freeCount === 0 ? (
          <p className="text-sm text-muted">
            Este profesor no tiene horas libres ahora mismo.
          </p>
        ) : (
          <BookingClient
            teachers={[{ id: teacher.id, name: teacher.name, entries, prices }]}
            children={kids.map((k) => ({ id: k.id, name: k.name }))}
            classmates={classmates}
          />
        )}
      </section>
    </div>
  );
}
