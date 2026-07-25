import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { classOffers, offerRequests, users } from "@/lib/db/schema";

export interface OfferCard {
  id: number;
  title: string;
  description: string | null;
  classCount: number | null;
  price: number;
  hasImage: boolean;
  active: boolean;
}

/** Ofertas activas (sin la imagen, que se sirve por API). Para alumnos. */
export async function activeOffers(): Promise<OfferCard[]> {
  const rows = await db
    .select({
      id: classOffers.id,
      title: classOffers.title,
      description: classOffers.description,
      classCount: classOffers.classCount,
      price: classOffers.price,
      hasImage: sql<boolean>`${classOffers.imageData} is not null`,
      active: classOffers.active,
    })
    .from(classOffers)
    .where(eq(classOffers.active, true))
    .orderBy(desc(classOffers.createdAt));
  return rows;
}

export interface AdminOffer extends OfferCard {
  pending: number;
  accepted: number;
  total: number;
}

/** Todas las ofertas con recuento de solicitudes. Para el panel admin. */
export async function allOffersForAdmin(): Promise<AdminOffer[]> {
  const rows = await db
    .select({
      id: classOffers.id,
      title: classOffers.title,
      description: classOffers.description,
      classCount: classOffers.classCount,
      price: classOffers.price,
      hasImage: sql<boolean>`${classOffers.imageData} is not null`,
      active: classOffers.active,
      pending: sql<number>`count(${offerRequests.id}) filter (where ${offerRequests.status} = 'pendiente')::int`,
      accepted: sql<number>`count(${offerRequests.id}) filter (where ${offerRequests.status} = 'aceptada')::int`,
      total: sql<number>`count(${offerRequests.id})::int`,
    })
    .from(classOffers)
    .leftJoin(offerRequests, eq(offerRequests.offerId, classOffers.id))
    .groupBy(classOffers.id)
    .orderBy(desc(classOffers.createdAt));
  return rows;
}

export interface OfferRequestRow {
  id: number;
  studentId: number;
  studentName: string;
  note: string | null;
  status: "pendiente" | "aceptada" | "rechazada";
  createdAt: Date;
}

/** Solicitudes de una oferta con el nombre del alumno. */
export async function requestsForOffer(
  offerId: number,
): Promise<OfferRequestRow[]> {
  const rows = await db
    .select({
      id: offerRequests.id,
      studentId: offerRequests.studentId,
      studentName: users.name,
      note: offerRequests.note,
      status: offerRequests.status,
      createdAt: offerRequests.createdAt,
    })
    .from(offerRequests)
    .innerJoin(users, eq(users.id, offerRequests.studentId))
    .where(eq(offerRequests.offerId, offerId))
    .orderBy(desc(offerRequests.createdAt));
  return rows;
}

/**
 * Estado de la solicitud del usuario para cada oferta (para pintar "Solicitada"
 * en la tarjeta). Devuelve un mapa offerId → estado.
 */
export async function myOfferStatuses(
  userId: number,
): Promise<Map<number, "pendiente" | "aceptada" | "rechazada">> {
  const rows = await db
    .select({ offerId: offerRequests.offerId, status: offerRequests.status })
    .from(offerRequests)
    .where(eq(offerRequests.studentId, userId));
  // Si hay varias, nos quedamos con la más "avanzada" (aceptada > pendiente).
  const rank = { rechazada: 0, pendiente: 1, aceptada: 2 } as const;
  const map = new Map<number, "pendiente" | "aceptada" | "rechazada">();
  for (const r of rows) {
    const cur = map.get(r.offerId);
    if (!cur || rank[r.status] > rank[cur]) map.set(r.offerId, r.status);
  }
  return map;
}

/** ¿Ya tiene el alumno una solicitud viva (pendiente/aceptada) para esa oferta? */
export async function hasLiveRequest(
  offerId: number,
  userId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(offerRequests)
    .where(
      and(
        eq(offerRequests.offerId, offerId),
        eq(offerRequests.studentId, userId),
        sql`${offerRequests.status} in ('pendiente','aceptada')`,
      ),
    );
  return (row?.n ?? 0) > 0;
}
