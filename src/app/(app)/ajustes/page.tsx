import { eq } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { logoutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ProfileForm, PasswordForm } from "./forms";
import { TeacherProfileForm } from "@/components/teacher-profile-form";
import {
  togglePushAction,
  toggleDiscoverableAction,
  toggleGroupAddableAction,
  updateMyTeacherProfileAction,
} from "./actions";

export const metadata = { title: "Ajustes" };

const ROLE_LABEL = { admin: "Admin", profesor: "Profesor", alumno: "Alumno" } as const;

export default async function SettingsPage() {
  const session = await requireSession();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Tu perfil y preferencias" />

      <section className="glass p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Perfil</h2>
          <Badge tone={user.role === "alumno" ? "neutral" : "accent"}>
            {ROLE_LABEL[user.role]}
          </Badge>
        </div>
        <p className="mb-4 mt-1 text-sm text-muted">{user.email}</p>
        <ProfileForm
          defaults={{
            name: user.name,
            phone: user.phone ?? "",
            license: user.license ?? "",
          }}
        />
      </section>

      {user.role === "profesor" ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Perfil público de profesor</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Cuéntales a los alumnos quién eres y en qué destacas.
          </p>
          <TeacherProfileForm
            action={updateMyTeacherProfileAction}
            defaults={{
              title: user.title ?? "",
              specialties: user.specialties ?? "",
              experienceYears: user.experienceYears?.toString() ?? "",
              bio: user.bio ?? "",
            }}
          />
        </section>
      ) : null}

      <section className="glass p-6">
        <h2 className="font-semibold">Seguridad</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Cambia tu contraseña.</p>
        <PasswordForm />
      </section>

      <section className="glass p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Notificaciones push</h2>
            <p className="mt-1 text-sm text-muted">
              Recibe avisos del club en tu móvil (app instalada).
            </p>
          </div>
          <form action={togglePushAction}>
            <input type="hidden" name="enabled" value={(!user.pushEnabled).toString()} />
            <button
              type="submit"
              role="switch"
              aria-checked={user.pushEnabled}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                user.pushEnabled ? "bg-accent" : "bg-sand-deep"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  user.pushEnabled ? "left-6" : "left-1"
                }`}
              />
            </button>
          </form>
        </div>
      </section>

      <section className="glass p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Aparecer en búsquedas</h2>
            <p className="mt-1 text-sm text-muted">
              Si lo desactivas, otras personas no podrán encontrarte en el buscador
              del chat para iniciar una conversación nueva. Tus grupos y chats
              existentes no se ven afectados.
            </p>
          </div>
          <form action={toggleDiscoverableAction}>
            <input
              type="hidden"
              name="enabled"
              value={(!user.discoverable).toString()}
            />
            <button
              type="submit"
              role="switch"
              aria-checked={user.discoverable}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                user.discoverable ? "bg-accent" : "bg-sand-deep"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  user.discoverable ? "left-6" : "left-1"
                }`}
              />
            </button>
          </form>
        </div>
      </section>

      <section className="glass p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Que me añadan a grupos</h2>
            <p className="mt-1 text-sm text-muted">
              Si lo desactivas, otras personas no podrán añadirte a grupos de chat
              que creen. Los grupos de tus clases te añaden igualmente: los gestiona
              el club.
            </p>
          </div>
          <form action={toggleGroupAddableAction}>
            <input
              type="hidden"
              name="enabled"
              value={(!user.groupAddable).toString()}
            />
            <button
              type="submit"
              role="switch"
              aria-checked={user.groupAddable}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                user.groupAddable ? "bg-accent" : "bg-sand-deep"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  user.groupAddable ? "left-6" : "left-1"
                }`}
              />
            </button>
          </form>
        </div>
      </section>

      <form action={logoutAction}>
        <button type="submit" className="btn-danger w-full sm:w-auto">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </form>
    </>
  );
}
