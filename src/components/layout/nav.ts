import {
  LayoutDashboard,
  GraduationCap,
  MessageCircle,
  CalendarDays,
  CalendarPlus,
  Trophy,
  Flag,
  TrendingUp,
  Bell,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/jwt";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Si está definido, solo estos roles ven el item. */
  roles?: Role[];
  /** Se muestra en la barra inferior móvil. El resto vive en el menú de la navbar. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, primary: true },
  { href: "/clases", label: "Clases", icon: GraduationCap, primary: true },
  { href: "/reservar", label: "Reservar", icon: CalendarPlus, roles: ["alumno"] },
  { href: "/chat", label: "Chat", icon: MessageCircle, primary: true },
  { href: "/eventos", label: "Eventos", icon: CalendarDays, primary: true },
  { href: "/clasificaciones", label: "Clasificaciones", icon: Trophy },
  { href: "/campo", label: "Campo", icon: Flag },
  { href: "/mejora", label: "Mejora tu juego", icon: TrendingUp },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true, primary: true },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter(
    (i) => (!i.adminOnly || role === "admin") && (!i.roles || i.roles.includes(role)),
  );
}
