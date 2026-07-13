import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classReminders } from "@/lib/db/schema";
import { allSlots, slotParticipants, upcomingOccurrences } from "@/lib/classes";
import { notifyUsers } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Recordatorio de clase ~24 h antes. Notifica (in-app + push) a los alumnos con
 * clase en las próximas 24 horas que aún no hayan sido avisados. Los avisos de
 * menores llegan a su padre/tutor (lo hace notifyUsers).
 *
 * Pensado para dispararse periódicamente (Vercel Cron u otro scheduler). Para
 * un aviso preciso "24 h antes", conviene ejecutarlo cada hora; también sirve a
 * diario (avisa de las clases del día siguiente en cada pasada, sin duplicar).
 *
 * Protección: si CRON_SECRET está definido, exige `?secret=` o cabecera
 * `Authorization: Bearer <secret>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const provided =
      url.searchParams.get("secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const slots = await allSlots();
  const occurrences = await upcomingOccurrences(slots, 2);

  let sent = 0;
  for (const o of occurrences) {
    const start = new Date(`${o.date}T${o.startTime}:00`);
    // Solo las clases dentro de las próximas 24 h (y aún no empezadas).
    if (start <= now || start > limit) continue;

    const participants = await slotParticipants(o.id);
    for (const p of participants) {
      // Marca el recordatorio como enviado de forma atómica; si ya existía, no repite.
      const [row] = await db
        .insert(classReminders)
        .values({ slotId: o.id, date: o.date, studentId: p.id })
        .onConflictDoNothing()
        .returning({ id: classReminders.id });
      if (!row) continue;

      await notifyUsers([p.id], {
        type: "clase",
        title: "Recordatorio de clase",
        body: `Tienes clase mañana a las ${o.startTime}${
          o.teacherName ? ` con ${o.teacherName}` : ""
        }. ¡No faltes!`,
        link: "/clases",
      });
      sent++;
    }
  }

  return NextResponse.json({ ok: true, checked: occurrences.length, sent });
}
