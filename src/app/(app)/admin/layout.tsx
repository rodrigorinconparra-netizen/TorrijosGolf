import { requireAdmin } from "@/lib/auth/session";
import { pendingAdminRequests } from "@/lib/queries";
import { AdminTabs } from "./tabs";

export const metadata = { title: "Admin" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  const pendingRequests = await pendingAdminRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Panel de administración
        </h1>
        <p className="mt-1 text-sm text-muted">
          Control total del club: usuarios, clases, horarios e informes.
        </p>
      </div>
      <AdminTabs pendingRequests={pendingRequests} />
      {children}
    </div>
  );
}
