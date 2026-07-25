import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { classOffers } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Sirve el cartel (imagen) de una oferta a usuarios con sesión. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return new Response("No autorizado", { status: 401 });

  const id = Number((await params).id);
  if (!id) return new Response("No encontrado", { status: 404 });

  const [o] = await db
    .select({ data: classOffers.imageData, mime: classOffers.imageMime })
    .from(classOffers)
    .where(eq(classOffers.id, id))
    .limit(1);
  if (!o || !o.data) return new Response("No encontrado", { status: 404 });

  const bytes = Buffer.from(o.data, "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": o.mime || "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
