"use server";

import { getSession } from "@/lib/auth/session";
import { saveDeviceToken } from "@/lib/push";

/** Guarda el token push FCM del dispositivo para el usuario con sesión. */
export async function registerDeviceTokenAction(
  token: string,
  platform: string | null,
): Promise<void> {
  const session = await getSession();
  if (!session || !token) return;
  await saveDeviceToken(session.userId, token, platform);
}
