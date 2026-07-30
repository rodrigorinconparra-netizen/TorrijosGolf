import { NextResponse } from "next/server";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { handicapForLicense } from "@/lib/rfeg";

export const dynamic = "force-dynamic";
// La sincronización con RFEG puede tardar (una consulta por jugador). 60 s es el
// máximo del plan Hobby de Vercel; el cron es idempotente y reintenta a diario.
export const maxDuration = 60;

/**
 * Sincroniza el hándicap (WHS) de todos los usuarios con licencia desde la RFEG.
 * Pensado para ejecutarse a diario (Vercel Cron, ~6:00). Va uno a uno con una
 * pequeña espera para no saturar la web de la federación; los fallos puntuales
 * se ignoran (best-effort).
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

  // Usuarios reales (con login) que tienen licencia.
  const rows = await db
    .select({ id: users.id, license: users.license })
    .from(users)
    .where(and(isNotNull(users.license), ne(users.license, "")));

  let updated = 0;
  let failed = 0;
  for (const u of rows) {
    if (!u.license) continue;
    const hcp = await handicapForLicense(u.license);
    if (hcp === null) {
      failed++;
    } else {
      await db
        .update(users)
        .set({ handicapIndex: hcp })
        .where(eq(users.id, u.id));
      updated++;
    }
    // Pequeña pausa entre consultas para ser amables con la web de la RFEG.
    await new Promise((r) => setTimeout(r, 400));
  }

  return NextResponse.json({ ok: true, total: rows.length, updated, failed });
}
