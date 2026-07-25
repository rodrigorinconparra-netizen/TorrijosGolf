import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Cuenta eliminada" };

export default function AccountDeletedPage() {
  return (
    <div className="glass p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-positive/12 text-positive">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Cuenta eliminada</h1>
      <p className="mt-2 text-sm text-muted">
        Tu cuenta y todos tus datos se han eliminado permanentemente de Torrijos
        Golf. Gracias por haber estado con nosotros.
      </p>
      <Link href="/register" className="btn-primary mt-6 w-full justify-center">
        Crear una cuenta nueva
      </Link>
      <Link
        href="/login"
        className="mt-3 block text-sm font-medium text-accent hover:underline"
      >
        Volver al inicio de sesión
      </Link>
    </div>
  );
}
