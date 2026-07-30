import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Clock,
  Euro,
  GraduationCap,
  Users,
  Dumbbell,
  CalendarCheck,
  CalendarClock,
  Mail,
  Phone,
  IdCard,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getUserBasic, studentCrm, teacherCrm, familyOf } from "@/lib/crm";
import { TeacherProfileForm } from "@/components/teacher-profile-form";
import { updateTeacherProfileAction } from "../../actions";
import { GolfDataForm } from "./golf-form";
import { TeacherPricesForm } from "./prices-form";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEuro, weekdayName, initials } from "@/lib/utils";

export const metadata = { title: "Ficha" };

const ROLE_LABEL = { admin: "Admin", profesor: "Profesor", alumno: "Alumno" } as const;
const STATUS_TONE = {
  programada: "neutral",
  impartida: "positive",
  cancelada: "negative",
} as const;

export default async function UserCrmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const userId = Number((await params).id);
  if (!userId) notFound();

  const user = await getUserBasic(userId);
  if (!user) notFound();

  const family = await familyOf(userId);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/usuarios"
        className="inline-flex items-center gap-1 text-sm font-medium text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Volver a usuarios
      </Link>

      {/* Cabecera de perfil */}
      <section className="glass p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-semibold text-on-accent">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{user.name}</h1>
              <Badge tone={user.role === "alumno" ? "neutral" : "accent"}>
                {ROLE_LABEL[user.role]}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Alta el {formatDate(user.createdAt)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-2 text-ink-soft">
            <Mail className="h-4 w-4 text-faint" />{" "}
            {user.guardianId ? "Cuenta gestionada (sin login)" : user.email}
          </p>
          <p className="flex items-center gap-2 text-ink-soft">
            <Phone className="h-4 w-4 text-faint" /> {user.phone ?? "—"}
          </p>
          <p className="flex items-center gap-2 text-ink-soft">
            <IdCard className="h-4 w-4 text-faint" /> Licencia {user.license ?? "—"}
          </p>
          {user.role === "profesor" ? (
            <p className="flex items-center gap-2 text-ink-soft">
              <Euro className="h-4 w-4 text-faint" /> Tarifa{" "}
              {user.hourlyRate != null ? `${formatEuro(user.hourlyRate)}/h` : "—"}
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {user.guardianId ? <Badge tone="warning">Menor gestionado</Badge> : null}
          <Badge tone={user.pushEnabled ? "positive" : "neutral"}>
            Push {user.pushEnabled ? "on" : "off"}
          </Badge>
          <Badge tone={user.discoverable ? "positive" : "neutral"}>
            Visible {user.discoverable ? "sí" : "no"}
          </Badge>
          <Badge tone={user.groupAddable ? "positive" : "neutral"}>
            Grupos {user.groupAddable ? "sí" : "no"}
          </Badge>
        </div>
      </section>

      {family.guardian || family.children.length > 0 ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Familia</h2>
          {family.guardian ? (
            <p className="mt-2 text-sm text-ink-soft">
              <span className="text-muted">Padre/tutor: </span>
              <Link
                href={`/admin/usuarios/${family.guardian.id}`}
                className="font-medium text-accent hover:underline"
              >
                {family.guardian.name}
              </Link>
            </p>
          ) : null}
          {family.children.length > 0 ? (
            <div className="mt-2">
              <p className="text-sm text-muted">Hijos gestionados:</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {family.children.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/usuarios/${c.id}`}
                    className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-deep hover:bg-accent/20"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="glass p-6">
        <h2 className="font-semibold">Datos de juego (ligas)</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Hándicap (índice) y sexo: con ellos se calcula el hándicap de juego en
            las ligas según la barra elegida.
          </p>
          <GolfDataForm
            userId={userId}
            handicapIndex={
              user.handicapIndex != null
                ? user.handicapIndex.toString().replace(".", ",")
                : ""
            }
            sex={user.sex ?? ""}
          />
      </section>

      {user.role === "profesor" ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Precios de clases</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Lo que paga el alumno al reservar con este profesor. El grupal es por
            persona. Déjalo vacío si no ofrece ese tipo de clase.
          </p>
          <TeacherPricesForm
            userId={userId}
            defaults={{
              priceIndividualPuntual: user.priceIndividualPuntual?.toString() ?? "",
              priceIndividualMensual: user.priceIndividualMensual?.toString() ?? "",
              priceGrupalPuntual: user.priceGrupalPuntual?.toString() ?? "",
              priceGrupalMensual: user.priceGrupalMensual?.toString() ?? "",
            }}
          />
        </section>
      ) : null}

      {user.role === "profesor" ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Perfil público de profesor</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Habilidades, titulación y descripción. Lo ven todos los usuarios.
          </p>
          <TeacherProfileForm
            action={updateTeacherProfileAction}
            userId={userId}
            defaults={{
              title: user.title ?? "",
              specialties: user.specialties ?? "",
              experienceYears: user.experienceYears?.toString() ?? "",
              bio: user.bio ?? "",
            }}
          />
        </section>
      ) : null}

      {user.role === "alumno" ? (
        <StudentSection userId={userId} />
      ) : user.role === "profesor" ? (
        <TeacherSection userId={userId} />
      ) : (
        <section className="glass p-6">
          <p className="text-sm text-muted">
            Este usuario es administrador: tiene acceso total al panel del club.
          </p>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Alumno */

async function StudentSection({ userId }: { userId: number }) {
  const crm = await studentCrm(userId);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Clases asistidas" value={String(crm.attendedCount)} icon={CalendarCheck} />
        <StatCard label="Faltas" value={String(crm.noShowCount)} icon={CalendarClock} />
        <StatCard label="Próximas clases" value={String(crm.upcomingCount)} icon={GraduationCap} />
        <StatCard label="Gastado en clases" value={formatEuro(crm.spent)} icon={Euro} />
      </div>

      <section className="glass p-6">
        <h2 className="font-semibold">Grupos y profesores</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted">Grupos</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {crm.groups.length ? (
                crm.groups.map((g) => (
                  <Badge key={g} tone="accent">
                    {g}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-faint">Ninguno</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Profesores</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {crm.teachers.length ? (
                crm.teachers.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-faint">Ninguno</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="glass p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Entrenamientos</h2>
          <Badge tone="neutral">
            {crm.trainings.completed}/{crm.trainings.total} completados
          </Badge>
        </div>
        {crm.trainings.list.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin entrenamientos.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {crm.trainings.list.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-soft">
                  {t.title} <span className="text-faint">· {t.teacherName}</span>
                </span>
                <Badge tone={t.completed ? "positive" : "neutral"}>
                  {t.completed ? "Completado" : "Pendiente"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Historial de clases</h2>
        {crm.classes.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin clases registradas.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {crm.classes.map((c, i) => (
              <li
                key={i}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{c.className}</p>
                  <p className="text-xs text-muted">
                    {formatDate(c.date)} · {c.startTime} · {c.teacherName}
                  </p>
                </div>
                {c.status === "impartida" ? (
                  <Badge tone={c.attended ? "positive" : "negative"}>
                    {c.attended ? "Asistió" : "Faltó"}
                  </Badge>
                ) : (
                  <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                )}
                {c.status === "impartida" && c.attended ? (
                  <span className="text-xs text-muted">{formatEuro(c.price)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- Profesor */

async function TeacherSection({ userId }: { userId: number }) {
  const crm = await teacherCrm(userId);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Ingresos generados"
          value={formatEuro(crm.income)}
          hint={`Este mes: ${formatEuro(crm.incomeMonth)}`}
          icon={Euro}
        />
        <StatCard
          label="Horas trabajadas"
          value={String(crm.hoursWorked)}
          unit="h"
          hint={`Este mes: ${crm.hoursMonth} h`}
          icon={Clock}
        />
        <StatCard
          label="Clases impartidas"
          value={String(crm.sessionsGiven)}
          hint={`Este mes: ${crm.sessionsMonth}`}
          icon={GraduationCap}
        />
        <StatCard label="Alumnos" value={String(crm.studentsCount)} icon={Users} />
      </div>

      <section className="glass p-6">
        <h2 className="font-semibold">Alumnos ({crm.students.length})</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {crm.students.length ? (
            crm.students.map((s) => (
              <Badge key={s} tone="neutral">
                {s}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-faint">Ninguno</span>
          )}
        </div>
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Grupos ({crm.groups.length})</h2>
        {crm.groups.length === 0 ? (
          <p className="mt-2 text-sm text-faint">Ninguno</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {crm.groups.map((g, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{g.name}</span>
                <Badge tone="accent">{g.members} alumnos</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Horario semanal ({crm.slots.length})</h2>
        {crm.slots.length === 0 ? (
          <p className="mt-2 text-sm text-faint">Sin horas asignadas.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {crm.slots.map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-ink-soft">
                  {weekdayName(s.weekday)} · {s.startTime} ({s.durationMin} min) · {s.target}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={s.kind === "grupal" ? "accent" : "neutral"}>
                    {s.kind === "grupal" ? "Grupal" : "Individual"}
                  </Badge>
                  {s.price > 0 ? (
                    <span className="text-xs text-muted">{formatEuro(s.price)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="glass p-6">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-muted" />
            <h2 className="font-semibold">Entrenamientos enviados ({crm.trainings.count})</h2>
          </div>
          {crm.trainings.list.length === 0 ? (
            <p className="mt-2 text-sm text-faint">Ninguno.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {crm.trainings.list.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-ink-soft">{t.title}</span>
                  <Badge tone={t.done === t.total && t.total > 0 ? "positive" : "neutral"}>
                    {t.done}/{t.total}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass p-6">
          <h2 className="font-semibold">Solicitudes</h2>
          <div className="mt-2 space-y-1.5 text-sm">
            <p className="flex items-center justify-between">
              <span className="text-muted">Clases propuestas</span>
              <span className="text-ink-soft">
                {crm.classRequests.accepted} aceptadas · {crm.classRequests.pending} pend. ·{" "}
                {crm.classRequests.rejected} rech.
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-muted">Cambios de horario</span>
              <span className="text-ink-soft">
                {crm.scheduleChanges.accepted} aceptados · {crm.scheduleChanges.pending} pend. ·{" "}
                {crm.scheduleChanges.rejected} rech.
              </span>
            </p>
          </div>
        </section>
      </div>

      <section className="glass p-6">
        <h2 className="font-semibold">Historial de clases ({crm.sessions.length})</h2>
        {crm.sessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin clases registradas todavía.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {crm.sessions.map((s, i) => (
              <li
                key={i}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{s.className}</p>
                  <p className="text-xs text-muted">
                    {formatDate(s.date)} · {s.startTime}
                    {s.status === "impartida"
                      ? ` · ${s.attendees} asistieron${s.absents ? `, ${s.absents} faltaron` : ""}`
                      : ""}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                {s.status === "impartida" && s.price > 0 ? (
                  <span className="text-xs text-muted">{formatEuro(s.price)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
