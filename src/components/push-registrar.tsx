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
        let fcmToken = token.value;
        // En iOS el token de registro es de APNs; FCM necesita el suyo propio.
        if (Capacitor.getPlatform() === "ios") {
          try {
            const { FCM } = await import("@capacitor-community/fcm");
            const r = await FCM.getToken();
            fcmToken = r.token;
          } catch {
            /* nos quedamos con el token APNs si FCM falla */
          }
        }
        if (!cancelled) {
          await registerDeviceTokenAction(fcmToken, Capacitor.getPlatform());
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
