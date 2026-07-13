import { BroadcastForm } from "./broadcast-form";
import { isPushConfigured } from "@/lib/push";
import { isMailConfigured } from "@/lib/mail";

export const metadata = { title: "Avisos" };

export default function AdminBroadcastPage() {
  const push = isPushConfigured();
  const mail = isMailConfigured();

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="font-semibold">Enviar aviso</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Llega a todo el club o solo a alumnos/profesores. Siempre aparece en la
          app{push ? ", se envía como notificación push" : ""} y, si lo marcas,
          también por email.
        </p>
        <BroadcastForm mailEnabled={mail} />
        {!push || !mail ? (
          <p className="mt-4 text-xs text-faint">
            {!push ? "Push nativas sin configurar (variables FCM_* en .env). " : ""}
            {!mail ? "Email sin configurar (RESEND_API_KEY en .env)." : ""}
          </p>
        ) : null}
      </section>
    </div>
  );
}
