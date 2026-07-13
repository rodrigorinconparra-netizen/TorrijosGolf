import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  ChevronLeft,
  Check,
  X,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { isGuardianOf } from "@/lib/queries";
import { db } from "@/lib/db";
import { trainingAssignments, trainings, users } from "@/lib/db/schema";
import { studentSlots, upcomingOccurrences } from "@/lib/classes";
import { Badge } from "@/components/ui/badge";
import { formatDate, initials } from "@/lib/utils";
import {
  setAttendancePlanAction,
  toggleTrainingAction,
} from "@/app/(app)/clases/actions";

export const metadata = { title: "Hijo/a" };

export default async function ChildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const childId = Number((await params).id);
  if (!childId) notFound();

  // Solo el padre/tutor (o un admin) puede ver la ficha del menor.
  const isAdmin = user.role === "admin";
  if (!isAdmin && !(await isGuardianOf(user.userId, childId))) notFound();

  const [child] = await db.select().from(users).where(eq(users.id, childId)).limit(1);
  if (!child) notFound();

  const slots = await studentSlots(childId);
  const occurrences = await upcomingOccurrences(slots, 14, childId);

  const myTrainings = await db
    .select({
      assignmentId: trainingAssignments.id,
      completed: trainingAssignments.completed,
      title: trainings.title,
      description: trainings.description,
      teacherName: users.name,
    })
    .from(trainingAssignments)
    .innerJoin(trainings, eq(trainings.id, trainingAssignments.trainingId))
    .innerJoin(users, eq(users.id, trainings.teacherId))
    .where(eq(trainingAssignments.studentId, childId))
    .orderBy(desc(trainings.createdAt));

  const canManage = !isAdmin; // el admin solo consulta

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-medium text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Volver
      </Link>

      <section className="glass flex items-center gap-4 p-6">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-semibold text-on-accent">
          {initials(child.name)}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{child.name}</h1>
          <p className="text-sm text-muted">
            Hijo/a · {child.license ? `Licencia ${child.license}` : "Sin licencia"}
          </p>
        </div>
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Próximas clases (2 semanas)</h2>
        <p className="mt-1 text-sm text-muted">
          Confirma en su nombre si va a asistir.
        </p>
        {occurrences.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No tiene clases programadas.</p>
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
                    {formatDate(o.date)} · {o.startTime} · {o.teacherName}
                  </p>
                </div>
                {o.status === "cancelada" ? (
                  <Badge tone="negative">Cancelada</Badge>
                ) : o.status === "impartida" ? (
                  <Badge tone="positive">Impartida</Badge>
                ) : canManage ? (
                  <div className="flex items-center gap-1.5">
                    <form action={setAttendancePlanAction}>
                      <input type="hidden" name="slotId" value={o.id} />
                      <input type="hidden" name="date" value={o.date} />
                      <input type="hidden" name="plan" value="asistire" />
                      <input type="hidden" name="studentId" value={childId} />
                      <button
                        type="submit"
                        className={
                          o.myPlan === "asistire"
                            ? "btn-primary !px-3 !py-1.5 text-xs"
                            : "btn-ghost !px-3 !py-1.5 text-xs"
                        }
                      >
                        <Check className="h-3.5 w-3.5" /> Asistirá
                      </button>
                    </form>
                    <form action={setAttendancePlanAction}>
                      <input type="hidden" name="slotId" value={o.id} />
                      <input type="hidden" name="date" value={o.date} />
                      <input type="hidden" name="plan" value="no_asistire" />
                      <input type="hidden" name="studentId" value={childId} />
                      <button
                        type="submit"
                        className={
                          o.myPlan === "no_asistire"
                            ? "btn-danger !px-3 !py-1.5 text-xs"
                            : "btn-ghost !px-3 !py-1.5 text-xs"
                        }
                      >
                        <X className="h-3.5 w-3.5" /> No irá
                      </button>
                    </form>
                  </div>
                ) : o.myPlan === "asistire" ? (
                  <Badge tone="positive">Asistirá</Badge>
                ) : o.myPlan === "no_asistire" ? (
                  <Badge tone="negative">No irá</Badge>
                ) : (
                  <Badge>Sin confirmar</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Entrenamientos</h2>
        {myTrainings.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Sin entrenamientos todavía.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {myTrainings.map((t) => (
              <li key={t.assignmentId} className="glass-soft px-4 py-3">
                <div className="flex items-start gap-3">
                  {canManage ? (
                    <form action={toggleTrainingAction} className="mt-0.5">
                      <input type="hidden" name="assignmentId" value={t.assignmentId} />
                      <button
                        type="submit"
                        title={t.completed ? "Marcar pendiente" : "Marcar completado"}
                        className="text-accent transition active:scale-90"
                      >
                        {t.completed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5 text-faint" />
                        )}
                      </button>
                    </form>
                  ) : t.completed ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 text-faint" />
                  )}
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
    </div>
  );
}
