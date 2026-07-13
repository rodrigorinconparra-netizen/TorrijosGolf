import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { searchPeople } from "@/lib/chat";

/** Busca personas visibles para iniciar un chat. */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ people: [] }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const mode = params.get("mode") === "group" ? "group" : "dm";
  const people = await searchPeople(user.userId, q, mode);
  return NextResponse.json({ people });
}
