import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rankings } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Sirve el PDF de una clasificación (solo usuarios con sesión). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return new Response("No autorizado", { status: 401 });

  const id = Number((await params).id);
  if (!id) return new Response("No encontrado", { status: 404 });

  const [r] = await db
    .select({
      data: rankings.data,
      fileName: rankings.fileName,
      mimeType: rankings.mimeType,
    })
    .from(rankings)
    .where(eq(rankings.id, id))
    .limit(1);
  if (!r) return new Response("No encontrado", { status: 404 });

  const bytes = Buffer.from(r.data, "base64");
  const safeName = encodeURIComponent(r.fileName);
  return new Response(bytes, {
    headers: {
      "Content-Type": r.mimeType || "application/pdf",
      // inline: se abre en el visor; el usuario puede descargar desde ahí.
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
