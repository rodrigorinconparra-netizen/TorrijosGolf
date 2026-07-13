import { SignJWT, jwtVerify } from "jose";

/**
 * Helpers JWT edge-safe (sin next/headers ni APIs de node) para poder usarlos
 * tanto desde el middleware como desde código de servidor.
 */

export const SESSION_COOKIE = "torrijos_session";

export type Role = "admin" | "profesor" | "alumno";

export interface SessionPayload {
  userId: number;
  email: string;
  name: string;
  role: Role;
}

/**
 * La clave de firma. En producción AUTH_SECRET DEBE estar definida — si no,
 * fallamos ruidosamente en vez de usar en silencio un secreto conocido y
 * falsificable. En desarrollo caemos a un secreto fijo por comodidad.
 */
function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET no está definida. Configura un valor aleatorio fuerte en el entorno.",
      );
    }
    return new TextEncoder().encode("dev-insecure-secret-change-me-in-env");
  }
  return new TextEncoder().encode(s);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
