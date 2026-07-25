import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bookingRequests,
  classOffers,
  offerRequests,
  users,
} from "@/lib/db/schema";

export type RequestStatus = "pendiente" | "aceptada" | "rechazada";

/** Nº de solicitudes pendientes del alumno (reservas + ofertas) para el badge. */
export async function pendingRequestsForStudent(userId: number): Promise<number> {
  const [[b], [o]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.studentId, userId),
          eq(bookingRequests.status, "pendiente"),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(offerRequests)
      .where(
        and(
          eq(offerRequests.studentId, userId),
          eq(offerRequests.status, "pendiente"),
        ),
      ),
  ]);
  return (b?.n ?? 0) + (o?.n ?? 0);
}

export interface MyBookingRequest {
  id: number;
  teacherName: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  kind: "puntual" | "mensual";
  date: string | null;
  price: number;
  note: string | null;
  status: RequestStatus;
  createdAt: Date;
}

/** Reservas de clase que ha enviado el alumno, con el nombre del profesor. */
export async function myBookingRequests(
  userId: number,
): Promise<MyBookingRequest[]> {
  return db
    .select({
      id: bookingRequests.id,
      teacherName: users.name,
      weekday: bookingRequests.weekday,
      startTime: bookingRequests.startTime,
      durationMin: bookingRequests.durationMin,
      kind: bookingRequests.kind,
      date: bookingRequests.date,
      price: bookingRequests.price,
      note: bookingRequests.note,
      status: bookingRequests.status,
      createdAt: bookingRequests.createdAt,
    })
    .from(bookingRequests)
    .innerJoin(users, eq(users.id, bookingRequests.teacherId))
    .where(eq(bookingRequests.studentId, userId))
    .orderBy(desc(bookingRequests.createdAt));
}

export interface MyOfferRequest {
  id: number;
  offerTitle: string;
  price: number;
  classCount: number | null;
  note: string | null;
  status: RequestStatus;
  createdAt: Date;
}

/** Ofertas (bonos) que ha solicitado el alumno. */
export async function myOfferRequests(
  userId: number,
): Promise<MyOfferRequest[]> {
  return db
    .select({
      id: offerRequests.id,
      offerTitle: classOffers.title,
      price: classOffers.price,
      classCount: classOffers.classCount,
      note: offerRequests.note,
      status: offerRequests.status,
      createdAt: offerRequests.createdAt,
    })
    .from(offerRequests)
    .innerJoin(classOffers, eq(classOffers.id, offerRequests.offerId))
    .where(eq(offerRequests.studentId, userId))
    .orderBy(desc(offerRequests.createdAt));
}
