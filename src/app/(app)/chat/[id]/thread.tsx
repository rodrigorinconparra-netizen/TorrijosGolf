"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Dumbbell,
  CheckCircle2,
  Circle,
  Trash2,
  CalendarCheck,
  Check,
  X,
  Users,
  User,
} from "lucide-react";
import { formatDate, initials, weekdayName } from "@/lib/utils";
import { toggleTrainingAction } from "@/app/(app)/clases/actions";
import {
  acceptBookingAction,
  rejectBookingAction,
} from "@/app/(app)/admin/actions";
import { sendMessageAction, deleteMessageAction } from "../actions";

interface TrainingCard {
  id: number;
  title: string;
  description: string;
  total: number;
  done: number;
  completedBy: string[];
  pendingBy: string[];
  myAssignmentId: number | null;
  myCompleted: boolean;
}

interface BookingCard {
  id: number;
  studentId: number;
  studentName: string;
  teacherId: number;
  teacherName: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  price: number;
  kind: "puntual" | "mensual";
  classKind: "individual" | "grupal";
  date: string | null;
  status: "pendiente" | "aceptada" | "rechazada";
  members: string[];
}

interface Msg {
  id: number;
  senderId: number;
  senderName: string;
  senderIsGuardian?: boolean;
  body: string;
  createdAt: string;
  training?: TrainingCard;
  booking?: BookingCard;
}

/** Tarjeta de entrenamiento dentro del chat, con progreso y quién lo completó. */
function TrainingBubble({
  t,
  canDelete,
  onDelete,
}: {
  t: TrainingCard;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="max-w-[85%] rounded-2xl border border-accent/20 bg-white p-3.5 text-ink shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <Dumbbell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-deep">
            Entrenamiento
          </p>
          <p className="truncate text-sm font-semibold">{t.title}</p>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar"
            className="shrink-0 rounded-lg p-1.5 text-faint transition hover:bg-negative/10 hover:text-negative"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{t.description}</p>

      <div className="mt-3 rounded-xl bg-cream-deep/60 px-3 py-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-ink">
            Completado {t.done}/{t.total}
          </span>
          <span className="text-muted">
            {t.total > 0 ? Math.round((t.done / t.total) * 100) : 0}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/8">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${t.total > 0 ? (t.done / t.total) * 100 : 0}%` }}
          />
        </div>
        {t.completedBy.length > 0 ? (
          <p className="mt-2 text-[11px] text-muted">
            <span className="font-medium text-positive">✓</span>{" "}
            {t.completedBy.join(", ")}
          </p>
        ) : null}
        {t.pendingBy.length > 0 ? (
          <p className="mt-0.5 text-[11px] text-faint">Pendiente: {t.pendingBy.join(", ")}</p>
        ) : null}
      </div>

      {t.myAssignmentId ? (
        <form action={toggleTrainingAction} className="mt-2.5">
          <input type="hidden" name="assignmentId" value={t.myAssignmentId} />
          <button
            type="submit"
            className={
              t.myCompleted
                ? "btn-ghost w-full !py-2 text-sm"
                : "btn-primary w-full !py-2 text-sm"
            }
          >
            {t.myCompleted ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Completado — marcar pendiente
              </>
            ) : (
              <>
                <Circle className="h-4 w-4" /> Marcar como completado
              </>
            )}
          </button>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Tarjeta de reserva dentro del chat (estilo Wallapop): el alumno reserva y el
 * profesor recibe una tarjeta con la info y botones Aceptar/Rechazar. El estado
 * refleja lo real de la reserva (se actualiza en el próximo poll).
 */
function BookingBubble({
  b,
  canDecide,
  body,
  time,
}: {
  b: BookingCard;
  canDecide: boolean;
  body: string;
  time: string;
}) {
  const whenLabel =
    b.kind === "puntual" && b.date
      ? formatDate(b.date)
      : `los ${weekdayName(b.weekday).toLowerCase()}`;
  const priceLabel =
    b.price > 0
      ? `${b.price} €${b.classKind === "grupal" ? "/persona" : ""}`
      : "Sin precio";

  return (
    <div className="w-full max-w-[92%] rounded-2xl border border-accent/20 bg-white p-3.5 text-ink shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-deep">
            Reserva de clase
          </p>
          <p className="truncate text-sm font-semibold">
            {b.studentName} → {b.teacherName}
          </p>
        </div>
        <span
          className={
            b.status === "aceptada"
              ? "rounded-full bg-positive/15 px-2.5 py-0.5 text-[11px] font-semibold text-positive"
              : b.status === "rechazada"
                ? "rounded-full bg-negative/15 px-2.5 py-0.5 text-[11px] font-semibold text-negative"
                : "rounded-full bg-warning/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#9a6500]"
          }
        >
          {b.status === "aceptada"
            ? "Aceptada"
            : b.status === "rechazada"
              ? "Rechazada"
              : "Pendiente"}
        </span>
      </div>

      <ul className="mt-2.5 space-y-1 text-sm text-ink-soft">
        <li className="flex items-center gap-1.5">
          {b.classKind === "grupal" ? (
            <Users className="h-3.5 w-3.5 text-muted" />
          ) : (
            <User className="h-3.5 w-3.5 text-muted" />
          )}
          <span>
            {b.classKind === "grupal" ? "Grupal" : "Individual"} ·{" "}
            {b.kind === "mensual" ? "Semanal" : "Un solo día"}
          </span>
        </li>
        <li>
          <span className="text-muted">Cuándo: </span>
          {whenLabel} a las {b.startTime} ({b.durationMin} min)
        </li>
        <li>
          <span className="text-muted">Precio: </span>
          <span className="font-semibold text-accent-deep">{priceLabel}</span>
        </li>
        {b.classKind === "grupal" && b.members.length > 0 ? (
          <li>
            <span className="text-muted">Grupo: </span>
            {b.studentName}, {b.members.join(", ")}
          </li>
        ) : null}
      </ul>

      {body ? (
        <p className="mt-2.5 rounded-xl bg-cream-deep/60 px-3 py-2 text-sm italic text-ink-soft">
          «{body}»
        </p>
      ) : null}

      {b.status === "pendiente" && canDecide ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={acceptBookingAction} className="flex-1">
            <input type="hidden" name="bookingId" value={b.id} />
            <button type="submit" className="btn-primary w-full !py-2 text-sm">
              <Check className="h-4 w-4" /> Aceptar
            </button>
          </form>
          <form action={rejectBookingAction} className="flex-1">
            <input type="hidden" name="bookingId" value={b.id} />
            <button type="submit" className="btn-danger w-full !py-2 text-sm">
              <X className="h-4 w-4" /> Rechazar
            </button>
          </form>
        </div>
      ) : null}

      <p className="mt-2 text-right text-[10px] text-faint">{time}</p>
    </div>
  );
}

/**
 * Hilo de chat con polling cada 4 s. En grupos muestra el nombre del remitente
 * sobre los mensajes ajenos. Optimista al enviar.
 */
export function Thread({
  conversationId,
  me,
  isAdmin,
  isGroup,
  initial,
}: {
  conversationId: number;
  me: number;
  isAdmin: boolean;
  isGroup: boolean;
  initial: Msg[];
}) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleDelete(id: number) {
    // Borrado optimista; el siguiente poll reconcilia con el servidor.
    setMsgs((prev) => prev.filter((m) => m.id !== id));
    const fd = new FormData();
    fd.set("messageId", String(id));
    await deleteMessageAction(fd);
  }

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`/api/chat/${conversationId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { messages: Msg[] };
        if (active && Array.isArray(data.messages)) setMsgs(data.messages);
      } catch {
        /* reintenta en el siguiente tick */
      }
    }
    const id = setInterval(poll, 4000);
    poll();
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function submit(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    setText("");
    setMsgs((prev) => [
      ...prev,
      {
        id: -Date.now(),
        senderId: me,
        senderName: "",
        body,
        createdAt: new Date().toISOString(),
      },
    ]);
    await sendMessageAction(formData);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="glass min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted">
            No hay mensajes todavía. ¡Escribe el primero!
          </p>
        ) : (
          msgs.map((m, i) => {
            const mine = m.senderId === me;
            const showName =
              isGroup && !mine && msgs[i - 1]?.senderId !== m.senderId;
            // No se pueden borrar los mensajes optimistas (id negativo, aún sin guardar).
            const canDelete = (mine || isAdmin) && m.id > 0;

            const deleteBtn = canDelete ? (
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                title="Eliminar mensaje"
                className="shrink-0 self-center rounded-lg p-1.5 text-faint opacity-70 transition hover:bg-negative/10 hover:text-negative"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null;

            // Las tarjetas de reserva (Wallapop) se muestran centradas; sus
            // botones aparecen solo si quien mira puede decidir (profesor de la
            // reserva o admin).
            if (m.booking) {
              const canDecide = me === m.booking.teacherId || isAdmin;
              const time = new Date(m.createdAt).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div key={m.id} className="flex justify-center">
                  <BookingBubble b={m.booking} canDecide={canDecide} body={m.body} time={time} />
                </div>
              );
            }

            // Los entrenamientos se muestran como tarjeta, centrados en el hilo.
            if (m.training) {
              return (
                <div key={m.id} className="flex justify-center">
                  <TrainingBubble
                    t={m.training}
                    canDelete={canDelete}
                    onDelete={() => handleDelete(m.id)}
                  />
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={
                  mine
                    ? "flex items-end justify-end gap-1.5"
                    : "flex items-end justify-start gap-1.5"
                }
              >
                {mine ? deleteBtn : null}
                {isGroup && !mine ? (
                  <span className="grid h-7 w-7 shrink-0 place-items-center self-end rounded-full bg-accent/12 text-[10px] font-semibold text-accent-deep">
                    {initials(m.senderName)}
                  </span>
                ) : null}
                <div
                  className={
                    mine
                      ? "max-w-[75%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm text-on-accent"
                      : "max-w-[75%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm text-ink shadow-sm"
                  }
                >
                  {showName ? (
                    <p className="mb-0.5 text-[11px] font-semibold text-accent-deep">
                      {m.senderName}
                      {m.senderIsGuardian ? (
                        <span className="font-normal text-muted"> (padre/tutor)</span>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  <p
                    className={
                      mine
                        ? "mt-0.5 text-right text-[10px] text-on-accent/70"
                        : "mt-0.5 text-right text-[10px] text-faint"
                    }
                  >
                    {new Date(m.createdAt).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {!mine ? deleteBtn : null}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form action={submit} className="mt-3 shrink-0">
        <div className="glass flex items-center gap-2 p-2.5">
          <input type="hidden" name="conversationId" value={conversationId} />
          <input
            name="body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe un mensaje…"
            autoComplete="off"
            className="field !py-2.5"
          />
          <button type="submit" className="btn-primary shrink-0 !px-3.5 !py-2.5">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
