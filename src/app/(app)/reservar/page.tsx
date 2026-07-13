import { CalendarPlus } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { allTeachers, teacherWeeklySchedule } from "@/lib/booking";
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
    })),
  );
  // Solo profesores que tengan alguna hora libre para reservar.
  const withFree = schedules.filter((s) =>
    s.entries.some((e) => e.status === "libre"),
  );

  const kids = await childrenOf(user.userId);

  return (
    <>
      <PageHeader
        title="Reservar clase"
        subtitle="Elige un profesor y una hora libre. Puntual (un día) o mensual (semanal)."
      />
      {withFree.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="No hay horas libres ahora mismo"
          description="Cuando el club abra horas disponibles de los profesores, podrás reservarlas aquí."
        />
      ) : (
        <BookingClient
          teachers={withFree}
          children={kids.map((k) => ({ id: k.id, name: k.name }))}
        />
      )}
    </>
  );
}
