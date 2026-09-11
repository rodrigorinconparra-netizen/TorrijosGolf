"use client";

/**
 * Registro de notificaciones push nativas.
 *
 * TEMPORALMENTE DESACTIVADO. El plugin `@capacitor/push-notifications` requiere
 * Firebase (google-services.json en Android, GoogleService-Info.plist en iOS)
 * para funcionar; sin él, en Android crashea la app al arrancar (motivo del
 * rechazo previo en Google Play). Cuando se configure Firebase, reinstalar el
 * plugin (ver PUBLICAR.md sección 5) y devolver aquí la lógica de
 * PushNotifications.checkPermissions/requestPermissions/register + listener de
 * "registration" que llama a `registerDeviceTokenAction`.
 *
 * Mientras tanto: los avisos in-app y por email siguen funcionando; solo las
 * push del móvil quedan inactivas.
 */
export function PushRegistrar() {
  return null;
}
