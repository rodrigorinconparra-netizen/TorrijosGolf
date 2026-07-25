import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth/jwt";

const AUTH_PAGES = ["/login", "/register"];
// Las páginas legales deben ser accesibles sin cuenta (revisión App Store, RGPD).
const PUBLIC_PAGES = ["/privacidad", "/terminos", "/soporte", "/cuenta-eliminada"];
const ADMIN_PREFIX = "/admin";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (PUBLIC_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Sin sesión → solo páginas de auth
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Con sesión → fuera de login/register
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // El panel de administración es solo para admins
  if (session && pathname.startsWith(ADMIN_PREFIX) && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Corre en todo excepto rutas API, internals de Next y estáticos.
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|webmanifest)$).*)",
  ],
};
