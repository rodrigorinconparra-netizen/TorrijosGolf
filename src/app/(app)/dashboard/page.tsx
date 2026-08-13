import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Euro,
  GraduationCap,
  TrendingUp,
  Users,
  ChevronRight,
  Dumbbell,
  Check,
  X,
} from "lucide-react";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { events, trainingAssignments, users } from "@/lib/db/schema";
import {
  studentSlots,
  teacherSlots,
  upcomingOccurrences,
  teacherReports,
  type Occurrence,
} from "@/lib/classes";
import {
  setAttendancePlanAction,
  cancelSessionAction,
  quickCompleteSessionAction,
} from "@/app/(app)/clases/actions";
import { studentIdsOfTeacher, childrenOf } from "@/lib/queries";
import { activeOffers, myOfferStatuses } from "@/lib/offers";
import { OffersList } from "@/components/offers-list";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ChildForm } from "@/app/(app)/hijos/child-form";
import { formatDate, formatDateTime, formatEuro, toDateKey, initials } from "@/lib/utils";

export const metadata = { title: "Inicio" };

function monthRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

/** ¿Ya empezó (pasó la hora de inicio de) la ocurrencia? */
function hasStarted(o: Occurrence): boolean {
  return new Date(`${o.date}T${o.startTime}:00`) <= new Date();
}

function ClassMeta({ o, showTeacher }: { o: Occurrence; showTeacher: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-ink">
        {o.kind === "grupal" ? (o.groupName ?? "Grupo") : "Clase individual"}
      </p>
      <p className="text-xs text-muted">
        {formatDate(o.date)} · {o.startTime}
        {showTeacher && o.teacherName ? ` · ${o.teacherName}` : ""}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Occurrence["status"] }) {
  if (status === "impartida") return <Badge tone="positive">Impartida</Badge>;
  if (status === "cancelada") return <Badge tone="negative">Cancelada</Badge>;
  return null;
}

/** Vista de alumno: confirma asistencia desde el propio Inicio. */
function StudentClasses({ items, empty }: { items: Occurrence[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((o) => (
        <li
          key={`${o.id}-${o.date}`}
          className="glass-soft flex flex-wrap items-center justify-between gap-2 px-4 py-3"
        >
          <ClassMeta o={o} showTeacher />
          {o.status !== "programada" ? (
            <StatusBadge status={o.status} />
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
  );
}

/** Vista de profesor: cancelar (antes de la hora) o completar (pasada la hora). */
function TeacherClasses({ items, empty }: { items: Occurrence[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((o) => (
        <li
          key={`${o.id}-${o.date}`}
          className="glass-soft flex flex-wrap items-center justify-between gap-2 px-4 py-3"
        >
          <ClassMeta o={o} showTeacher={false} />
          {o.status !== "programada" ? (
            <StatusBadge status={o.status} />
          ) : hasStarted(o) ? (
            <form action={quickCompleteSessionAction}>
              <input type="hidden" name="slotId" value={o.id} />
              <input type="hidden" name="date" value={o.date} />
              <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                <Check className="h-3.5 w-3.5" /> Marcar impartida
              </button>
            </form>
          ) : (
            <form action={cancelSessionAction}>
              <input type="hidden" name="slotId" value={o.id} />
              <input type="hidden" name="date" value={o.date} />
              <button type="submit" className="btn-danger !px-3 !py-1.5 text-xs">
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Sección "Mis hijos": aparece si el usuario gestiona cuentas de menores. */
async function ChildrenSection({ userId }: { userId: number }) {
  const kids = await childrenOf(userId);

  return (
    <section className="glass p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Mis hijos</h2>
        <span className="text-xs text-muted">
          {kids.length ? `${kids.length} en el club` : "Añade a tus hijos"}
        </span>
      </div>
      <p className="mb-4 mt-1 text-sm text-muted">
        Gestiona las clases y entrenamientos de tus hijos menores. Sus avisos te
        llegan a ti.
      </p>

      {kids.length > 0 ? (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {kids.map((k) => (
            <Link
              key={k.id}
              href={`/hijos/${k.id}`}
              className="glass-soft flex items-center gap-3 px-4 py-3 transition hover:bg-white/70"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent">
                {initials(k.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{k.name}</p>
                <p className="text-xs text-muted">Ver sus clases y entrenamientos</p>
              </div>
              <ChevronRight className="h-4 w-4 text-faint" />
            </Link>
          ))}
        </div>
      ) : null}

      <ChildForm />
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requireSession();

  const upcomingEvents = await db
    .select()
    .from(events)
    .where(gte(events.startsAt, new Date()))
    .orderBy(events.startsAt)
    .limit(3);

  let content: React.ReactNode = null;

  if (user.role === "alumno") {
    const slots = await studentSlots(user.userId);
    const next = (await upcomingOccurrences(slots, 7, user.userId)).slice(0, 4);
    const [{ n: pendingTrainings }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(trainingAssignments)
      .where(
        and(
          eq(trainingAssignments.studentId, user.userId),
          eq(trainingAssignments.completed, false),
        ),
      );

    content = (
      <>
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Clases esta semana"
            value={String(next.length)}
            icon={GraduationCap}
          />
          <StatCard
            label="Entrenamientos pendientes"
            value={String(pendingTrainings)}
            icon={Dumbbell}
          />
        </div>
        <section className="glass p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Próximas clases</h2>
            <Link
              href="/clases"
              className="flex items-center gap-0.5 text-sm font-medium text-accent"
            >
              Ver todas <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4">
            <StudentClasses
              items={next}
              empty="No tienes clases programadas esta semana. Si crees que falta alguna, habla con el club."
            />
          </div>
        </section>
        <Link href="/mejora" className="glass flex items-center justify-between p-6 transition hover:bg-white/80">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
              <TrendingUp className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-semibold">Mejora tu juego</h2>
              <p className="text-sm text-muted">
                Registra tus vueltas y analiza tu juego con BirdieGolf.
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-faint" />
        </Link>
      </>
    );
  } else if (user.role === "profesor") {
    const slots = await teacherSlots(user.userId);
    const next = (
      await upcomingOccurrences(slots, 7, undefined, { includePastToday: true })
    ).slice(0, 5);
    const studentIds = await studentIdsOfTeacher(user.userId);
    const { from, to } = monthRange();
    const [report] = (await teacherReports(from, to)).filter(
      (r) => r.teacherId === user.userId,
    );

    content = (
      <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Tus alumnos" value={String(studentIds.length)} icon={Users} />
          <StatCard
            label="Horas este mes"
            value={String(report?.hoursWorked ?? 0)}
            unit="h"
            icon={Clock}
          />
          <StatCard
            label="Clases impartidas (mes)"
            value={String(report?.sessionsGiven ?? 0)}
            icon={GraduationCap}
          />
        </div>
        <section className="glass p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Tus próximas clases</h2>
            <Link
              href="/clases"
              className="flex items-center gap-0.5 text-sm font-medium text-accent"
            >
              Ver horario <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4">
            <TeacherClasses
              items={next}
              empty="No tienes horas asignadas todavía. El club configurará tu horario."
            />
          </div>
        </section>
      </>
    );
  } else {
    // admin
    const counts = await db
      .select({ role: users.role, n: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.role);
    const byRole = Object.fromEntries(counts.map((c) => [c.role, c.n]));
    const { from, to } = monthRange();
    const reports = await teacherReports(from, to);
    const income = reports.reduce((acc, r) => acc + r.income, 0);

    content = (
      <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Alumnos" value={String(byRole["alumno"] ?? 0)} icon={Users} />
          <StatCard
            label="Profesores"
            value={String(byRole["profesor"] ?? 0)}
            icon={GraduationCap}
          />
          <StatCard
            label="Ingresos este mes"
            value={formatEuro(income)}
            icon={Euro}
            hint="Clases impartidas"
          />
          <StatCard
            label="Clases impartidas (mes)"
            value={String(reports.reduce((a, r) => a + r.sessionsGiven, 0))}
            icon={Clock}
          />
        </div>
        <section className="glass p-6">
          <h2 className="font-semibold">Gestión del club</h2>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { href: "/admin/usuarios", label: "Usuarios y profesores" },
              { href: "/admin/grupos", label: "Grupos de clases" },
              { href: "/admin/horarios", label: "Horarios de profesores" },
              { href: "/admin/informes", label: "Informes y asistencias" },
              { href: "/admin/avisos", label: "Enviar avisos" },
              { href: "/admin/eventos", label: "Eventos del club" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="glass-soft flex items-center justify-between px-4 py-3 text-sm font-medium text-ink transition hover:bg-white/70"
              >
                {l.label}
                <ChevronRight className="h-4 w-4 text-faint" />
              </Link>
            ))}
          </div>
        </section>
      </>
    );
  }

  const offers = user.role === "alumno" ? await activeOffers() : [];
  const offerStatuses =
    user.role === "alumno"
      ? Object.fromEntries(await myOfferStatuses(user.userId))
      : {};

  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle={`Bienvenido al Club de Golf Torrijos, ${user.name.split(" ")[0]}`}
      />

      {user.role === "alumno" ? (
        <div className="flex flex-wrap gap-3">
          <Link href="/reservar" className="btn-primary">
            <CalendarPlus className="h-4 w-4" /> Reservar clase
          </Link>
        </div>
      ) : null}

      {offers.length > 0 ? (
        <OffersList offers={offers} statuses={offerStatuses} />
      ) : null}

      {content}

      <ChildrenSection userId={user.userId} />

      <section className="glass p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Próximos eventos</h2>
          <Link
            href="/eventos"
            className="flex items-center gap-0.5 text-sm font-medium text-accent"
          >
            Ver todos <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4">
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted">No hay eventos programados.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="glass-soft flex items-center gap-4 px-4 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{e.title}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(e.startsAt)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
