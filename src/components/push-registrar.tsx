"use client";

import { useEffect } from "react";
import { registerDeviceTokenAction } from "@/app/(app)/push-actions";

/**
 * En el shell nativo (Capacitor), pide permiso de notificaciones y registra el
 * token FCM del dispositivo para este usuario. En web es no-op.
 */
export function PushRegistrar() {
  useEffect(() => {
    let cancelled = false;

    async function register() {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { PushNotifications } = await import("@capacitor/push-notifications");

      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt") {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== "granted" || cancelled) return;

      await PushNotifications.addListener("registration", async (token) => {
        // Android da el token FCM directamente; iOS da el de APNs. (Para push
        // por FCM en iOS habría que reintroducir Firebase; ver PUBLICAR.md.)
        if (!cancelled) {
          await registerDeviceTokenAction(token.value, Capacitor.getPlatform());
        }
      });

      await PushNotifications.register();
    }

    register().catch(() => {
      /* push es best-effort */
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
