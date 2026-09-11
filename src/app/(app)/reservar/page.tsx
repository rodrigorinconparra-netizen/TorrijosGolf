import { asc, eq } from "drizzle-orm";
import { CalendarPlus } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { allTeachers, teacherPrices, teacherWeeklySchedule } from "@/lib/booking";
import { childrenOf } from "@/lib/queries";
import { BookingClient } from "./booking-client";

export const metadata = { title: "Reservar" };

export default async function BookPage() {
  const user = await requireSession();

  const teachers = await allTeachers();
  const schedules = await Promise.all(
    teachers.map(async (t) => ({
      id: t.id,
      name: t.name,
      entries: await teacherWeeklySchedule(t.id),
      prices: await teacherPrices(t.id),
    })),
  );
  // Mostramos todos los profesores del club; los que no tengan horas libres
  // aparecen igualmente y el alumno ve un aviso en su pestaña.

  const kids = await childrenOf(user.userId);

  // Alumnos que se pueden añadir a una clase grupal (todos menos uno mismo).
  const classmates = (
    await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "alumno"))
      .orderBy(asc(users.name))
  ).filter((s) => s.id !== user.userId);

  return (
    <>
      <PageHeader
        title="Reservar clase"
        subtitle="Elige un profesor y una hora libre. Puntual (un día) o mensual (semanal)."
      />
      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="Aún no hay profesores en el club"
          description="Cuando el club dé de alta profesores, aparecerán aquí para reservar."
        />
      ) : (
        <BookingClient
          teachers={schedules}
          children={kids.map((k) => ({ id: k.id, name: k.name }))}
          classmates={classmates}
        />
      )}
    </>
  );
}
